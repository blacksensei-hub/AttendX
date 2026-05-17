const { Op }     = require('sequelize');
const { Session, Class, Enrollment, Attendance } = require('../models');
const {
  sendSessionClosingSoonEmail,
  sendSessionClosedEmails,
} = require('./emailService');
const { createNotification } = require('./notificationService');

// Track which sessions we have already sent the "closing soon" warning for
// so we don't spam students with repeated warnings on every poll cycle.
// This is an in-memory Set — it resets on server restart, but that's fine
// because we only need to track warnings within a single server run.
const warnedSessions = new Set();

/**
 * The main scheduler function. Called every 30 seconds by the interval
 * set up in startSessionScheduler(). It does two things:
 *
 * 1. Finds sessions whose close_at time is within 2 minutes and sends
 *    a "closing soon" warning to all enrolled students.
 *
 * 2. Finds sessions whose close_at time has passed and closes them,
 *    then sends a summary email to all enrolled students.
 */
async function runScheduler(io) {
  try {
    const now = new Date();

    // ── Find sessions to warn (closing in ≤ 2 minutes) ────────
    const warnBefore = new Date(now.getTime() + 2 * 60 * 1000); // 2 mins from now

    const sessionsSoonToClose = await Session.findAll({
      where: {
        status:   'open',
        close_at: {
          [Op.gt]: now,          // not yet closed
          [Op.lte]: warnBefore,  // but closing within 2 minutes
        },
      },
      include: [{ model: Class, as: 'class', required: false }],
    });

    for (const session of sessionsSoonToClose) {
      // Skip if we've already warned for this session in this server run
      if (warnedSessions.has(session.id)) continue;
      warnedSessions.add(session.id);

      const className = session.class?.name ?? session.class_name_snapshot ?? 'your class';
      console.log(`[Scheduler] Sending closing soon warning for session ${session.id} (${className})`);

      // Fetch enrolled students
      const enrollments = await Enrollment.findAll({
        where:   { class_id: session.class_id },
        include: [{ association: 'student', attributes: ['id', 'name', 'email'] }],
      });

      // Send in-app notifications
      for (const e of enrollments) {
        if (!e.student) continue;
        try {
          await createNotification(io, {
            userId:  e.student.id,
            type:    'session_closing_soon',
            title:   '⏰ Session closing in 2 minutes',
            message: `${className} attendance session is closing very soon!`,
            data:    { sessionId: session.id, className },
          });
        } catch (err) {
          console.warn('[Scheduler] Notification failed:', err.message);
        }
      }

      // Send closing soon emails — fire and forget
      Promise.allSettled(
        enrollments
          .filter(e => e.student)
          .map(e => sendSessionClosingSoonEmail({
            to:          e.student.email,
            studentName: e.student.name,
            className,
          }))
      ).catch(err => console.error('[Scheduler] Closing soon email error:', err.message));
    }

    // ── Find sessions to auto-close (close_at has passed) ─────
    const sessionsToClose = await Session.findAll({
      where: {
        status:   'open',
        close_at: { [Op.lte]: now }, // close_at is in the past
      },
      include: [{ model: Class, as: 'class', required: false }],
    });

    for (const session of sessionsToClose) {
      const className = session.class?.name ?? session.class_name_snapshot ?? 'your class';
      console.log(`[Scheduler] Auto-closing session ${session.id} (${className})`);

      // Mark the session as closed in the database
      await session.update({ status: 'closed', closed_at: now });

      // Notify the lecturer's live session page via WebSocket
      io?.to(`session:${session.id}`).emit('session:closed', { sessionId: session.id });

      // Remove from warned set since it's now closed
      warnedSessions.delete(session.id);

      // Fetch enrolled students and their attendance records
      const enrollments = await Enrollment.findAll({
        where:   { class_id: session.class_id },
        include: [{ association: 'student', attributes: ['id', 'name', 'email'] }],
      });

      const attendanceRecords = await Attendance.findAll({
        where: { session_id: session.id },
      });

      const statusMap = {};
      attendanceRecords.forEach(r => { statusMap[r.student_id] = r.status; });

      const records = enrollments
        .filter(e => e.student)
        .map(e => ({
          studentEmail: e.student.email,
          studentName:  e.student.name,
          status:       statusMap[e.student.id] ?? 'absent',
        }));

      // Send session closed summary emails — fire and forget
      if (records.length > 0) {
        sendSessionClosedEmails({
          className,
          sessionTitle: session.title,
          closedAt:     now.toISOString(),
          records,
        }).catch(err =>
          console.error('[Scheduler] Session closed email error:', err.message)
        );
      }
    }

  } catch (err) {
    console.error('[Scheduler] Error:', err.message);
  }
}

/**
 * Start the background scheduler. Call this once when the server starts,
 * passing the Socket.io instance so the scheduler can emit WebSocket events.
 *
 * The scheduler runs immediately on start (to catch any sessions that should
 * have closed while the server was down) and then every 30 seconds after that.
 */
function startSessionScheduler(io) {
  console.log('[Scheduler] Session auto-close scheduler started — polling every 30 seconds');

  // Run immediately on server start to catch any overdue sessions
  runScheduler(io);

  // Then run every 30 seconds
  setInterval(() => runScheduler(io), 30 * 1000);
}

module.exports = { startSessionScheduler };