// server/src/controllers/adminAtRiskController.js

const { Op } = require('sequelize');
const {
  User, Class, Enrollment, Session, Attendance, Notification,
} = require('../models');
const { success, error } = require('../utils/apiResponse');
const emailService        = require('../services/emailService');

const APPROACHING_BAND      = 5;
const MIN_SESSIONS_FOR_EVAL = 3;
const DROPOUT_CONSECUTIVE   = 2;

// ─── GET /api/admin/at-risk ──────────────────────────────────
exports.getAtRisk = async (req, res) => {
  try {
    const [classes, closedSessions, enrollments] = await Promise.all([
      Class.findAll({
        include: [{
          model:      User,
          as:         'lecturer',
          attributes: ['id', 'name', 'email'],   // ← 'name' not 'full_name'
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
          attributes: ['id', 'name', 'email', 'student_id', 'is_active'], // ← 'name'
        }],
      }),
    ]);

    if (closedSessions.length === 0) {
      return res.json(success({
        belowThreshold:  [],
        approaching:     [],
        recentDropouts:  [],
        summary: { totalAtRisk: 0, belowCount: 0, approachingCount: 0, dropoutCount: 0 },
      }));
    }

    const allAttendance = await Attendance.findAll({
      where: {
        session_id: { [Op.in]: closedSessions.map(s => s.id) },
        status:     { [Op.in]: ['present', 'late'] },
      },
      attributes: ['student_id', 'session_id'],
    });

    const attendedByStudent = new Map();
    for (const a of allAttendance) {
      if (!attendedByStudent.has(a.student_id)) {
        attendedByStudent.set(a.student_id, new Set());
      }
      attendedByStudent.get(a.student_id).add(a.session_id);
    }

    const sessionsByClass = new Map();
    for (const s of closedSessions) {
      if (!sessionsByClass.has(s.class_id)) sessionsByClass.set(s.class_id, []);
      sessionsByClass.get(s.class_id).push(s);
    }

    const enrollmentsByClass = new Map();
    for (const e of enrollments) {
      if (!enrollmentsByClass.has(e.class_id)) enrollmentsByClass.set(e.class_id, []);
      enrollmentsByClass.get(e.class_id).push(e);
    }

    const belowThreshold = [];
    const approaching    = [];
    const recentDropouts = [];

    for (const cls of classes) {
      const classSessions    = sessionsByClass.get(cls.id)    || [];
      const classEnrollments = enrollmentsByClass.get(cls.id) || [];

      if (classSessions.length === 0) continue;

      const threshold     = Number(cls.attendance_threshold) || 75;
      const totalSessions = classSessions.length;
      const className     = cls.name || cls.title || `Class ${cls.id}`;

      for (const enr of classEnrollments) {
        if (!enr.student || !enr.student.is_active) continue;

        const attendedSet   = attendedByStudent.get(enr.student.id) || new Set();
        const attendedCount = classSessions.filter(s => attendedSet.has(s.id)).length;
        const percentage    = Math.round((attendedCount / totalSessions) * 1000) / 10;

        const studentInfo = {
          studentId:     enr.student.id,
          studentName:   enr.student.name,           // ← .name
          studentEmail:  enr.student.email,
          studentNumber: enr.student.student_id,
          classId:       cls.id,
          className,
          classCode:     cls.code,
          lecturerId:    cls.lecturer?.id,
          lecturerName:  cls.lecturer?.name,          // ← .name
          lecturerEmail: cls.lecturer?.email,
          attendedCount,
          totalSessions,
          percentage,
          threshold,
        };

        if (totalSessions >= MIN_SESSIONS_FOR_EVAL) {
          if (percentage < threshold) {
            belowThreshold.push(studentInfo);
          } else if (percentage < threshold + APPROACHING_BAND) {
            approaching.push(studentInfo);
          }
        }

        if (totalSessions >= DROPOUT_CONSECUTIVE) {
          let consecutiveMissed = 0;
          for (const s of classSessions) {
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

    belowThreshold.sort((a, b) => a.percentage - b.percentage);
    approaching.sort((a, b)    => a.percentage - b.percentage);
    recentDropouts.sort((a, b) => b.consecutiveMissed - a.consecutiveMissed);

    return res.json(success({
      belowThreshold,
      approaching,
      recentDropouts,
      summary: {
        totalAtRisk:      belowThreshold.length + approaching.length,
        belowCount:       belowThreshold.length,
        approachingCount: approaching.length,
        dropoutCount:     recentDropouts.length,
      },
    }));

  } catch (err) {
    console.error('[AtRisk] getAtRisk failed:', err);
    return res.status(500).json(error('Failed to compute at-risk students'));
  }
};

// ─── Hydrate helper ──────────────────────────────────────────
async function hydrate(userId, classId) {
  const [student, klass] = await Promise.all([
    User.findByPk(userId),
    Class.findByPk(classId, {
      include: [{ model: User, as: 'lecturer' }],
    }),
  ]);

  if (!student || student.role !== 'student') {
    const e = new Error('Student not found'); e.statusCode = 404; throw e;
  }
  if (!klass) {
    const e = new Error('Class not found'); e.statusCode = 404; throw e;
  }

  const enrollment = await Enrollment.findOne({
    where: { student_id: userId, class_id: classId },
  });
  if (!enrollment) {
    const e = new Error('Student is not enrolled in this class');
    e.statusCode = 400; throw e;
  }

  const closedSessions = await Session.findAll({
    where: { class_id: classId, status: 'closed' },
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
  const percentage = total > 0
    ? Math.round((attendedCount / total) * 1000) / 10
    : 0;
  const threshold  = Number(klass.attendance_threshold) || 75;
  const className  = klass.name || klass.title || `Class ${klass.id}`;

  return { student, klass, className, attendedCount, total, percentage, threshold };
}

// ─── POST /api/admin/at-risk/notify-student/:userId/:classId ─
exports.notifyStudent = async (req, res) => {
  try {
    const { userId, classId } = req.params;
    const ctx = await hydrate(userId, classId);

    emailService.sendAtRiskStudentEmail({
      to:            ctx.student.email,
      studentName:   ctx.student.name,              // ← .name
      className:     ctx.className,
      percentage:    ctx.percentage,
      threshold:     ctx.threshold,
      attendedCount: ctx.attendedCount,
      totalSessions: ctx.total,
    }).catch(e => console.error('[AtRisk] email failed:', e.message));

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

    return res.json(success({
      notified: 'student',
      email:    ctx.student.email,
      snapshot: {
        percentage:    ctx.percentage,
        threshold:     ctx.threshold,
        attendedCount: ctx.attendedCount,
        totalSessions: ctx.total,
      },
    }));

  } catch (err) {
    console.error('[AtRisk] notifyStudent failed:', err);
    return res.status(err.statusCode || 400).json(error(err.message || 'Failed to notify student'));
  }
};

// ─── POST /api/admin/at-risk/notify-lecturer/:userId/:classId
exports.notifyLecturer = async (req, res) => {
  try {
    const { userId, classId } = req.params;
    const ctx = await hydrate(userId, classId);

    if (!ctx.klass.lecturer || !ctx.klass.lecturer.email) {
      return res.status(400).json(error('This class has no assigned lecturer'));
    }

    emailService.sendAtRiskLecturerEmail({
      to:            ctx.klass.lecturer.email,
      lecturerName:  ctx.klass.lecturer.name,       // ← .name
      studentName:   ctx.student.name,              // ← .name
      studentNumber: ctx.student.student_id,
      studentEmail:  ctx.student.email,
      className:     ctx.className,
      percentage:    ctx.percentage,
      threshold:     ctx.threshold,
      attendedCount: ctx.attendedCount,
      totalSessions: ctx.total,
    }).catch(e => console.error('[AtRisk] email failed:', e.message));

    try {
      await Notification.create({
        user_id: ctx.klass.lecturer.id,
        type:    'at_risk_alert',
        title:   `Student at risk in ${ctx.className}`,
        message: `${ctx.student.name}`
               + (ctx.student.student_id ? ` (${ctx.student.student_id})` : '')
               + ` is at ${ctx.percentage}% — below the ${ctx.threshold}% threshold.`,
        is_read: false,
      });
    } catch (e) {
      console.error('[AtRisk] notification skipped:', e.message);
    }

    return res.json(success({
      notified: 'lecturer',
      email:    ctx.klass.lecturer.email,
      snapshot: {
        percentage:    ctx.percentage,
        threshold:     ctx.threshold,
        attendedCount: ctx.attendedCount,
        totalSessions: ctx.total,
      },
    }));

  } catch (err) {
    console.error('[AtRisk] notifyLecturer failed:', err);
    return res.status(err.statusCode || 400).json(error(err.message || 'Failed to notify lecturer'));
  }
};