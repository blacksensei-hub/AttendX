// server/src/controllers/adminAtRiskController.js
//
// Computes at-risk students across every class and lets the admin
// trigger one-click email notifications to either the student or
// their lecturer. All heavy lifting happens in this single file so
// the existing adminController.js stays untouched.

const { Op } = require('sequelize');
const {
  User,
  Class,
  Enrollment,
  Session,
  Attendance,
  Notification,
} = require('../models');
const { success, error } = require('../utils/apiResponse');
const emailService = require('../services/emailService');

// ─── Tunables ────────────────────────────────────────────────
// "Approaching" is the early-warning band immediately above the
// class threshold. Sit inside this band and you're on the watch
// list before you actually drop below the line.
const APPROACHING_BAND      = 5;   // percentage points above threshold
const MIN_SESSIONS_FOR_EVAL = 3;   // need at least N closed sessions before % is meaningful
const DROPOUT_CONSECUTIVE   = 2;   // missed this many in a row → "recent dropout"

// ─────────────────────────────────────────────────────────────
// GET /api/admin/at-risk
// Returns three buckets: belowThreshold, approaching, recentDropouts.
// Open sessions are deliberately excluded — a session still in
// progress would unfairly mark students as absent.
// ─────────────────────────────────────────────────────────────
exports.getAtRisk = async (req, res) => {
  try {
    // Pull the four datasets we need in parallel — this whole
    // computation runs in 4 queries no matter how many students.
    const [classes, closedSessions, enrollments] = await Promise.all([
      Class.findAll({
        include: [{
          model:      User,
          as:         'lecturer',
          attributes: ['id', 'full_name', 'email'],
        }],
      }),
      Session.findAll({
        where:      { status: 'closed' },
        attributes: ['id', 'class_id', 'created_at'],
        order:      [['created_at', 'DESC']],
      }),
      Enrollment.findAll({
        include: [{
          model:      User,
          as:         'student',
          attributes: ['id', 'full_name', 'email', 'student_id', 'is_active'],
        }],
      }),
    ]);

    // Short-circuit: no closed sessions means nothing to evaluate.
    if (closedSessions.length === 0) {
      return success(res, {
        belowThreshold:  [],
        approaching:     [],
        recentDropouts:  [],
        summary: { totalAtRisk: 0, belowCount: 0, approachingCount: 0, dropoutCount: 0 },
      });
    }

    // One query for every relevant attendance row.
    const allAttendance = await Attendance.findAll({
      where: {
        session_id: { [Op.in]: closedSessions.map(s => s.id) },
        status:     { [Op.in]: ['present', 'late'] },
      },
      attributes: ['student_id', 'session_id'],
    });

    // Lookup map: studentId → Set<sessionId> they actually attended.
    const attendedByStudent = new Map();
    for (const a of allAttendance) {
      if (!attendedByStudent.has(a.student_id)) {
        attendedByStudent.set(a.student_id, new Set());
      }
      attendedByStudent.get(a.student_id).add(a.session_id);
    }

    // Group sessions by class (DESC order preserved).
    const sessionsByClass = new Map();
    for (const s of closedSessions) {
      if (!sessionsByClass.has(s.class_id)) sessionsByClass.set(s.class_id, []);
      sessionsByClass.get(s.class_id).push(s);
    }

    // Group enrollments by class.
    const enrollmentsByClass = new Map();
    for (const e of enrollments) {
      if (!enrollmentsByClass.has(e.class_id)) enrollmentsByClass.set(e.class_id, []);
      enrollmentsByClass.get(e.class_id).push(e);
    }

    const belowThreshold  = [];
    const approaching     = [];
    const recentDropouts  = [];

    // Walk every (class, student) pair and bucket where appropriate.
    for (const cls of classes) {
      const classSessions    = sessionsByClass.get(cls.id)    || [];
      const classEnrollments = enrollmentsByClass.get(cls.id) || [];

      if (classSessions.length === 0) continue;

      const threshold     = Number(cls.attendance_threshold) || 75;
      const totalSessions = classSessions.length;
      const className     = cls.name || cls.title || `Class ${cls.id}`;

      for (const enr of classEnrollments) {
        if (!enr.student || !enr.student.is_active) continue;

        const attendedSet  = attendedByStudent.get(enr.student.id) || new Set();
        const attendedCount = classSessions.filter(s => attendedSet.has(s.id)).length;
        const percentage    = Math.round((attendedCount / totalSessions) * 1000) / 10;

        const studentInfo = {
          studentId:     enr.student.id,
          studentName:   enr.student.full_name,
          studentEmail:  enr.student.email,
          studentNumber: enr.student.student_id,
          classId:       cls.id,
          className,
          classCode:     cls.code,
          lecturerId:    cls.lecturer?.id,
          lecturerName:  cls.lecturer?.full_name,
          lecturerEmail: cls.lecturer?.email,
          attendedCount,
          totalSessions,
          percentage,
          threshold,
        };

        // Percentage-based buckets only fire after MIN_SESSIONS_FOR_EVAL.
        // Below that we don't have enough data to fairly judge anyone.
        if (totalSessions >= MIN_SESSIONS_FOR_EVAL) {
          if (percentage < threshold) {
            belowThreshold.push(studentInfo);
          } else if (percentage < threshold + APPROACHING_BAND) {
            approaching.push(studentInfo);
          }
        }

        // Dropout check is independent — even with just 2 sessions
        // missing both consecutively is meaningful.
        if (totalSessions >= DROPOUT_CONSECUTIVE) {
          let consecutiveMissed = 0;
          for (const s of classSessions) {           // already DESC by created_at
            if (!attendedSet.has(s.id)) consecutiveMissed++;
            else break;
          }
          if (consecutiveMissed >= DROPOUT_CONSECUTIVE) {
            recentDropouts.push({
              ...studentInfo,
              consecutiveMissed,
              lastMissedDate: classSessions[0].created_at,
            });
          }
        }
      }
    }

    // Sort: most concerning at the top of each list.
    belowThreshold.sort((a, b) => a.percentage - b.percentage);
    approaching.sort((a, b)    => a.percentage - b.percentage);
    recentDropouts.sort((a, b) => b.consecutiveMissed - a.consecutiveMissed);

    return success(res, {
      belowThreshold,
      approaching,
      recentDropouts,
      summary: {
        totalAtRisk:      belowThreshold.length + approaching.length,
        belowCount:       belowThreshold.length,
        approachingCount: approaching.length,
        dropoutCount:     recentDropouts.length,
      },
    });
  } catch (err) {
    console.error('[AtRisk] getAtRisk failed:', err);
    return error(res, 'Failed to compute at-risk students', 500);
  }
};

// ─────────────────────────────────────────────────────────────
// Helper: pull a fresh snapshot of one (student, class) pair
// before we send a notification. We never trust stale data from
// the request — we always recompute the percentage at send time.
// ─────────────────────────────────────────────────────────────
async function hydrate(userId, classId) {
  const [student, klass] = await Promise.all([
    User.findByPk(userId),
    Class.findByPk(classId, {
      include: [{ model: User, as: 'lecturer' }],
    }),
  ]);

  if (!student || student.role !== 'student') {
    const e = new Error('Student not found');
    e.statusCode = 404;
    throw e;
  }
  if (!klass) {
    const e = new Error('Class not found');
    e.statusCode = 404;
    throw e;
  }

  // Confirm the student is actually enrolled — reject phantom calls.
  const enrollment = await Enrollment.findOne({
    where: { student_id: userId, class_id: classId },
  });
  if (!enrollment) {
    const e = new Error('Student is not enrolled in this class');
    e.statusCode = 400;
    throw e;
  }

  // Recompute live attendance %.
  const closedSessions = await Session.findAll({
    where:      { class_id: classId, status: 'closed' },
    attributes: ['id'],
  });
  const sessionIds = closedSessions.map(s => s.id);

  let attendedCount = 0;
  if (sessionIds.length > 0) {
    const records = await Attendance.findAll({
      where: {
        student_id: userId,
        session_id: { [Op.in]: sessionIds },
        status:     { [Op.in]: ['present', 'late'] },
      },
      attributes: ['session_id'],
    });
    attendedCount = new Set(records.map(r => r.session_id)).size;
  }

  const total      = closedSessions.length;
  const percentage = total > 0 ? Math.round((attendedCount / total) * 1000) / 10 : 0;
  const threshold  = Number(klass.attendance_threshold) || 75;
  const className  = klass.name || klass.title || `Class ${klass.id}`;

  return { student, klass, className, attendedCount, total, percentage, threshold };
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/at-risk/notify-student/:userId/:classId
// Email + in-app nudge to the student.
// ─────────────────────────────────────────────────────────────
exports.notifyStudent = async (req, res) => {
  try {
    const { userId, classId } = req.params;
    const ctx = await hydrate(userId, classId);

    // Fire-and-forget — never block the response on SMTP latency.
    emailService.sendAtRiskStudentEmail({
      to:            ctx.student.email,
      studentName:   ctx.student.full_name,
      className:     ctx.className,
      percentage:    ctx.percentage,
      threshold:     ctx.threshold,
      attendedCount: ctx.attendedCount,
      totalSessions: ctx.total,
    }).catch(err =>
      console.error('[AtRisk] sendAtRiskStudentEmail failed:', err.message)
    );

    // Best-effort in-app notification — failure here must NOT
    // bubble up to the user-facing response.
    try {
      await Notification.create({
        user_id: ctx.student.id,
        type:    'at_risk',
        title:   'Attendance below threshold',
        message: `Your attendance for ${ctx.className} is at ${ctx.percentage}% `
               + `(threshold ${ctx.threshold}%). Please attend upcoming sessions.`,
        is_read: false,
      });
    } catch (e) {
      console.error('[AtRisk] notification skipped:', e.message);
    }

    return success(res, {
      notified: 'student',
      email:    ctx.student.email,
      snapshot: {
        percentage:    ctx.percentage,
        threshold:     ctx.threshold,
        attendedCount: ctx.attendedCount,
        totalSessions: ctx.total,
      },
    });
  } catch (err) {
    console.error('[AtRisk] notifyStudent failed:', err);
    return error(res, err.message || 'Failed to notify student', err.statusCode || 400);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/admin/at-risk/notify-lecturer/:userId/:classId
// Email + in-app nudge to the lecturer of the at-risk class.
// (No real "academic advisor" field on User yet, so v1 routes
// the alert to the class lecturer who already knows the student.)
// ─────────────────────────────────────────────────────────────
exports.notifyLecturer = async (req, res) => {
  try {
    const { userId, classId } = req.params;
    const ctx = await hydrate(userId, classId);

    if (!ctx.klass.lecturer || !ctx.klass.lecturer.email) {
      return error(res, 'This class has no assigned lecturer', 400);
    }

    emailService.sendAtRiskLecturerEmail({
      to:            ctx.klass.lecturer.email,
      lecturerName:  ctx.klass.lecturer.full_name,
      studentName:   ctx.student.full_name,
      studentNumber: ctx.student.student_id,
      studentEmail:  ctx.student.email,
      className:     ctx.className,
      percentage:    ctx.percentage,
      threshold:     ctx.threshold,
      attendedCount: ctx.attendedCount,
      totalSessions: ctx.total,
    }).catch(err =>
      console.error('[AtRisk] sendAtRiskLecturerEmail failed:', err.message)
    );

    try {
      await Notification.create({
        user_id: ctx.klass.lecturer.id,
        type:    'at_risk_alert',
        title:   `Student at risk in ${ctx.className}`,
        message: `${ctx.student.full_name}`
               + (ctx.student.student_id ? ` (${ctx.student.student_id})` : '')
               + ` is at ${ctx.percentage}% attendance — below the ${ctx.threshold}% threshold.`,
        is_read: false,
      });
    } catch (e) {
      console.error('[AtRisk] notification skipped:', e.message);
    }

    return success(res, {
      notified: 'lecturer',
      email:    ctx.klass.lecturer.email,
      snapshot: {
        percentage:    ctx.percentage,
        threshold:     ctx.threshold,
        attendedCount: ctx.attendedCount,
        totalSessions: ctx.total,
      },
    });
  } catch (err) {
    console.error('[AtRisk] notifyLecturer failed:', err);
    return error(res, err.message || 'Failed to notify lecturer', err.statusCode || 400);
  }
};