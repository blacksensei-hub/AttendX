// server/src/services/sessionLifecycle.js
const { Enrollment, Attendance, User } = require('../models');
const { sendSessionClosedEmails }      = require('./emailService');

/**
 * ═════════════════════════════════════════════════════════════════
 * What happens after a session closes, in one place.
 *
 * A session can close three ways: the lecturer's Close button, the
 * scheduler's auto-close when close_at passes, and an admin's
 * force-close. Only the first used to write 'absent' rows for the
 * students who never scanned, so absences from auto-closed and
 * force-closed sessions were invisible to history, reports and
 * at-risk detection. All three now call finalizeClose().
 * ═════════════════════════════════════════════════════════════════
 */

/**
 * Write an 'absent' attendance row for every enrolled student who has
 * no row for this session yet. Returns how many rows were created.
 *
 * ignoreDuplicates makes it safe against a scan that raced the close:
 * if that student's row landed first, the insert is skipped instead of
 * failing the whole batch.
 */
async function backfillAbsences(session) {
  const enrollments = await Enrollment.findAll({
    where:      { class_id: session.class_id },
    attributes: ['student_id'],
  });
  const existing = await Attendance.findAll({
    where:      { session_id: session.id },
    attributes: ['student_id'],
  });
  const marked    = new Set(existing.map(a => a.student_id));
  const absentees = enrollments.map(e => e.student_id).filter(id => !marked.has(id));

  if (absentees.length === 0) return 0;

  await Attendance.bulkCreate(
    absentees.map(studentId => ({
      session_id: session.id,
      student_id: studentId,
      status:     'absent',
      marked_at:  session.closed_at ?? new Date(),
    })),
    { ignoreDuplicates: true },
  );
  return absentees.length;
}

/**
 * Email every enrolled student their result for the session.
 * Never throws: an email problem must not fail whatever closed it.
 */
async function notifySessionClosed(session, cls) {
  try {
    const className = cls?.name ?? session.class_name_snapshot ?? 'your class';

    const enrollments = await Enrollment.findAll({
      where:   { class_id: session.class_id },
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email'] }],
    });
    const attendance = await Attendance.findAll({ where: { session_id: session.id } });

    const statusMap = {};
    attendance.forEach(r => { statusMap[r.student_id] = r.status; });

    const records = enrollments
      .filter(e => e.student)
      .map(e => ({
        studentEmail: e.student.email,
        studentName:  e.student.name,
        status:       statusMap[e.student.id] ?? 'absent',
      }));

    if (records.length === 0) return;

    await sendSessionClosedEmails({
      className,
      sessionTitle: session.title,
      closedAt:     session.closed_at ?? new Date().toISOString(),
      records,
    });
  } catch (err) {
    console.warn('[Session] Closed-session emails skipped:', err.message);
  }
}

/**
 * Run everything that follows a close. The caller has already set
 * status: 'closed' and closed_at on the session.
 */
async function finalizeClose(session, { cls, io } = {}) {
  try {
    const created = await backfillAbsences(session);
    if (created > 0) {
      console.log(`[Session] Backfilled ${created} absent record(s) for session ${session.id}`);
    }
  } catch (err) {
    // The status update already succeeded and matters more; log and move on.
    console.error('[Session] Absent backfill failed (non-critical):', err.message);
  }

  io?.to(`session:${session.id}`).emit('session:closed', { sessionId: session.id });

  // Fire and forget: summary emails can take a while
  notifySessionClosed(session, cls);
}

module.exports = { backfillAbsences, notifySessionClosed, finalizeClose };
