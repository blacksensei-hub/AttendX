const { ClassSchedule, Class, Session, Enrollment, User } = require('../models');
const { Op } = require('sequelize');
const { sendSessionOpenedEmail } = require('./emailService');

// The scheduler polls every 60 seconds. For each active schedule,
// it checks if NOW matches the scheduled day + time. If it does AND
// a session hasn't been triggered for this slot yet today, it opens
// a new session and fires the reminder emails.
function startScheduleRunner(io) {
  console.log('[ScheduleRunner] Recurring session scheduler started — polling every 60 seconds');

  setInterval(async () => {
    try {
      await processScheduledSlots(io);
      await sendUpcomingReminders();
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

    const session = await Session.create({
      class_id:           sched.class_id,
      title:              `Scheduled session — ${dayName(sched.day_of_week)}`,
      status:             'open',
      open_at:            now,
      close_at:           closeAt,
      late_threshold:     sched.late_threshold,
      qr_interval:        sched.qr_interval,
      class_name_snapshot: sched.class?.name ?? 'Unknown class',
    });

    // Update last_triggered so we don't re-open the same slot
    await sched.update({ last_triggered: now });

    // Notify enrolled students via WebSocket
    if (io) {
      io.emit('session:scheduled-opened', {
        sessionId: session.id,
        classId:   sched.class_id,
        className: sched.class?.name,
      });
    }

    // Send email notifications to all enrolled students
    const enrollments = await Enrollment.findAll({
      where: { class_id: sched.class_id },
      include: [{ model: User, as: 'student', attributes: ['name', 'email'] }],
    });

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

    console.log(`[ScheduleRunner] Opened scheduled session for "${sched.class?.name}" (${enrollments.length} students notified)`);
  } catch (err) {
    console.error('[ScheduleRunner] openScheduledSession error:', err.message);
  }
}

// ─── Send a reminder 10 minutes before each scheduled session ─
async function sendUpcomingReminders() {
  const now = new Date();
  const in10Min = new Date(now.getTime() + 10 * 60 * 1000);
  const today   = in10Min.getDay();
  const hhmm    = `${String(in10Min.getHours()).padStart(2, '0')}:${String(in10Min.getMinutes()).padStart(2, '0')}`;

  const schedules = await ClassSchedule.findAll({
    where: {
      is_active:   true,
      day_of_week: today,
    },
    include: [{ model: Class, as: 'class' }],
  });

  for (const sched of schedules) {
    const scheduleTime = sched.start_time.substring(0, 5);
    if (scheduleTime !== hhmm) continue;

    const enrollments = await Enrollment.findAll({
      where: { class_id: sched.class_id },
      include: [{ model: User, as: 'student', attributes: ['name', 'email'] }],
    });

    enrollments.forEach(e => {
      sendReminderEmail({
        to:          e.student?.email,
        studentName: e.student?.name,
        className:   sched.class?.name,
        startTime:   scheduleTime,
      }).catch(err =>
        console.error(`[Email] Reminder error for ${e.student?.email}:`, err.message)
      );
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function dayName(dow) {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow];
}

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendReminderEmail({ to, studentName, className, startTime }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
        <tr><td align="center">
          <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
            <tr><td style="background:#3b82f6;padding:24px 32px;color:#fff;font-weight:600;">
              ⏰ Class starting soon
            </td></tr>
            <tr><td style="padding:32px;">
              <p style="color:#374151;font-size:15px;">Hi <strong>${studentName}</strong>,</p>
              <p style="color:#374151;font-size:15px;line-height:1.6;">
                Your class <strong style="color:#2563eb;">${className}</strong>
                is starting in about <strong>10 minutes</strong> at <strong>${startTime}</strong>.
                Get ready to mark your attendance.
              </p>
              <a href="${process.env.CLIENT_URL}/student"
                 style="display:inline-block;background:#3b82f6;color:#fff;
                        padding:12px 24px;border-radius:10px;text-decoration:none;
                        font-weight:600;margin-top:8px;">
                Open AttendX →
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>
  `;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `⏰ ${className} starts in 10 minutes`,
    html,
  });
}

module.exports = { startScheduleRunner };