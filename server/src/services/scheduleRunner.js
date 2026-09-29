const { ClassSchedule, Class, Session, Enrollment, User, UserPreference } = require('../models');
const { Op } = require('sequelize');
const { sendSessionOpenedEmail, sendClassReminderEmail } = require('./emailService');
const { createNotification } = require('./notificationService');
const { blockingEventOn } = require('./calendarService');
const { opsEmit, beat } = require('./opsFeed');

// The scheduler polls every 60 seconds. For each active schedule,
// it checks if NOW matches the scheduled day + time. If it does AND
// a session hasn't been triggered for this slot yet today, it opens
// a new session and fires the reminder emails.
function startScheduleRunner(io) {
  console.log('[ScheduleRunner] Recurring session scheduler started — polling every 60 seconds');

  setInterval(async () => {
    beat('scheduleRunner');
    try {
      await processScheduledSlots(io);
      await sendUpcomingReminders(io);
    } catch (err) {
      console.error('[ScheduleRunner] Error:', err.message);
    }
  }, 60_000);
}

// ─── Open sessions that are due right now ────────────────────
async function processScheduledSlots(io) {
  const now    = new Date();
  const today  = now.getDay();                         // 0=Sun..6=Sat
  const hhmm   = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Holidays, breaks and exam periods marked "no sessions" in the
  // admin calendar stop every timetabled session that day.
  if (await blockingEventOn(now)) return;

  // Find active schedules where day_of_week matches today AND start_time
  // falls within the current minute (or up to 1 minute ago, to handle
  // cases where the scheduler runs slightly off-beat).
  const schedules = await ClassSchedule.findAll({
    where: {
      is_active:   true,
      day_of_week: today,
    },
    include: [{ model: Class, as: 'class' }],
  });

  for (const sched of schedules) {
    // Convert the start_time to a comparable "HH:MM" string
    const scheduleTime = sched.start_time.substring(0, 5);
    if (scheduleTime !== hhmm) continue;

    // Ensure we don't double-trigger the same slot on the same day.
    // If last_triggered was within the past 23 hours, skip this slot.
    if (sched.last_triggered) {
      const hoursSince = (now - new Date(sched.last_triggered)) / (1000 * 60 * 60);
      if (hoursSince < 23) continue;
    }

    await openScheduledSession(sched, io);
  }
}

// ─── Open a session for a scheduled slot ──────────────────────
async function openScheduledSession(sched, io) {
  try {
    const now    = new Date();
    const closeAt = new Date(now.getTime() + sched.duration_mins * 60 * 1000);

    // A lecturer may already have opened this class by hand.
    const alreadyOpen = await Session.findOne({ where: { class_id: sched.class_id, status: 'open' } });
    if (alreadyOpen) {
      await sched.update({ last_triggered: now });
      return;
    }

    const session = await Session.create({
      class_id:           sched.class_id,
      title:              `Scheduled session — ${dayName(sched.day_of_week)}`,
      status:             'open',
      open_at:            now,
      close_at:           closeAt,
      late_threshold:     sched.late_threshold,
      qr_interval:        sched.qr_interval,
      // Scheduled sessions used to skip these, which silently turned
      // the classroom location check off for every timetabled session.
      geo_lat:            sched.class?.geo_lat    ?? null,
      geo_lng:            sched.class?.geo_lng    ?? null,
      geo_radius:         sched.class?.geo_radius ?? null,
      class_name_snapshot: sched.class?.name ?? 'Unknown class',
    });

    // Update last_triggered so we don't re-open the same slot
    await sched.update({ last_triggered: now });

    // Notify enrolled students via WebSocket
    // Only this class's room hears about it (this used to go to every
    // connected user, lecturer and student alike).
    io?.to(`class:${sched.class_id}`).emit('session:scheduled-opened', {
      sessionId: session.id,
      classId:   sched.class_id,
      className: sched.class?.name,
    });
    opsEmit('ops:session', {
      type: 'opened', sessionId: session.id,
      className: sched.class?.name ?? 'A class', code: sched.class?.code ?? null, scheduled: true,
    });

    // Send email notifications to all enrolled students
    const enrollments = await Enrollment.findAll({
      where: { class_id: sched.class_id },
      include: [{ model: User, as: 'student', attributes: ['name', 'email'] }],
    });

    // Guarded so an unavailable email service can't abort the loop and skip
    // the confirmation log — the session is already open at this point.
    try {
      enrollments.forEach(e => {
        sendSessionOpenedEmail({
          to:           e.student?.email,
          studentName:  e.student?.name,
          className:    sched.class?.name,
          sessionTitle: session.title,
        }).catch(err =>
          console.error(`[Email] Scheduled open error for ${e.student?.email}:`, err.message)
        );
      });
    } catch (err) {
      console.warn('[ScheduleRunner] Opened email batch skipped:', err.message);
    }

    console.log(`[ScheduleRunner] Opened scheduled session for "${sched.class?.name}" (${enrollments.length} students notified)`);
  } catch (err) {
    console.error('[ScheduleRunner] openScheduledSession error:', err.message);
  }
}

// ─── Remind students before each scheduled session ────────────
// Each student picks how long before class (user_preferences:
// 10, 30 or 60 minutes, or off); no preference means 10. Every lead
// time is checked each minute, so a student hears exactly once, at
// their own lead time, by in-app notification and email.
const LEAD_MINUTES = [10, 30, 60];

async function sendUpcomingReminders(io) {
  const now = new Date();
  for (const lead of LEAD_MINUTES) {
    const at    = new Date(now.getTime() + lead * 60 * 1000);
    const hhmm  = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;

    // No reminder for a session that won't open.
    if (await blockingEventOn(at)) continue;

    const schedules = await ClassSchedule.findAll({
      where:   { is_active: true, day_of_week: at.getDay() },
      include: [{ model: Class, as: 'class' }],
    });

    for (const sched of schedules) {
      if (sched.start_time.substring(0, 5) !== hhmm) continue;

      const enrollments = await Enrollment.findAll({
        where:   { class_id: sched.class_id },
        include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email', 'is_active'] }],
      });
      const ids = enrollments.map(e => e.student_id);
      // Before the preferences table exists everyone gets the default.
      const prefs = ids.length
        ? await UserPreference.findAll({ where: { user_id: ids }, attributes: ['user_id', 'reminder_minutes'] }).catch(() => [])
        : [];
      const leadOf = new Map(prefs.map(p => [p.user_id, p.reminder_minutes]));

      for (const e of enrollments) {
        if (!e.student?.is_active || (leadOf.get(e.student_id) ?? 10) !== lead) continue;
        const className = sched.class?.name ?? 'Your class';
        const location  = sched.class?.location_name ?? null;
        createNotification(io, {
          userId:  e.student_id,
          type:    'class_reminder',
          title:   `${className} starts in ${lead} minutes`,
          message: `At ${hhmm}${location ? ` in ${location}` : ''}. Scan in when the session opens.`,
          data:    { classId: sched.class_id, scheduleId: sched.id },
        }).catch(err => console.warn('[ScheduleRunner] Reminder notice failed:', err.message));
        sendClassReminderEmail({
          to: e.student.email, studentName: e.student.name, className, startTime: hhmm, minutes: lead, location,
        });
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function dayName(dow) {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow];
}

module.exports = { startScheduleRunner };