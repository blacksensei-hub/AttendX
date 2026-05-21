// server/src/controllers/classController.js
const { Class, Enrollment, User, Session,
        Attendance, ClassSchedule } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { Op }             = require('sequelize');

// ─── Generate a unique class code ─────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ─── Lecturer: get all their classes ──────────────────────────
exports.getMyClasses = async (req, res) => {
  try {
    const classes = await Class.findAll({
      where: { lecturer_id: req.user.id },
      include: [
        {
          model:    Session,
          as:       'sessions',
          required: false,
          where:    { status: 'open' },
          limit:    1,
        },
        {
          model:      ClassSchedule,
          as:         'schedules',
          required:   false,
          attributes: ['id', 'day_of_week', 'start_time',
                       'duration_mins', 'is_active'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const enriched = await Promise.all(classes.map(async cls => {
      const enrollmentCount = await Enrollment.count({
        where: { class_id: cls.id },
      });
      const activeSession = cls.sessions?.[0] ?? null;
      return { ...cls.toJSON(), enrollmentCount, activeSession };
    }));

    return res.json(success({ classes: enriched }));
  } catch (err) {
    console.error('GET CLASSES ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Create a class ───────────────────────────────────────────
exports.createClass = async (req, res) => {
  try {
    const {
      name, description, department, location_name,
      geo_lat, geo_lng, geo_radius,
    } = req.body;

    if (geo_lat && (geo_lat < -90  || geo_lat > 90))
      return res.status(400).json(error('Latitude must be between -90 and 90'));
    if (geo_lng && (geo_lng < -180 || geo_lng > 180))
      return res.status(400).json(error('Longitude must be between -180 and 180'));

    const code = generateCode();
    const cls  = await Class.create({
      name, description, department, location_name,
      geo_lat:    geo_lat    || null,
      geo_lng:    geo_lng    || null,
      geo_radius: geo_radius ?? 100,
      code,
      lecturer_id: req.user.id,
    });

    return res.status(201).json(success({ class: cls }, 'Class created'));
  } catch (err) {
    console.error('CREATE CLASS ERROR:', err.message);
    return res.status(500).json(error(err.message));
  }
};

// ─── Delete a class ───────────────────────────────────────────
exports.deleteClass = async (req, res) => {
  try {
    const cls = await Class.findOne({
      where: { id: req.params.id, lecturer_id: req.user.id },
    });
    if (!cls) return res.status(404).json(error('Class not found'));

    await Session.update(
      { class_name_snapshot: cls.name },
      { where: { class_id: cls.id } }
    );
    await cls.destroy();
    return res.json(success(null, 'Class deleted'));
  } catch (err) {
    console.error('DELETE CLASS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get class details ────────────────────────────────────────
exports.getClassDetail = async (req, res) => {
  try {
    const cls = await Class.findByPk(req.params.id, {
      include: [{
        model:      User,
        as:         'students',
        attributes: ['id', 'name', 'email', 'student_id'],
      }],
    });
    if (!cls) return res.status(404).json(error('Class not found'));
    return res.json(success({ class: cls }));
  } catch (err) {
    console.error('GET CLASS DETAIL ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student: join a class by code ────────────────────────────
exports.joinClass = async (req, res) => {
  try {
    const { code } = req.body;
    const cls = await Class.findOne({ where: { code } });
    if (!cls) return res.status(404).json(error('Invalid class code'));

    const already = await Enrollment.findOne({
      where: { student_id: req.user.id, class_id: cls.id },
    });
    if (already)
      return res.status(409).json(error('Already enrolled in this class'));

    await Enrollment.create({ student_id: req.user.id, class_id: cls.id });
    return res.status(201).json(success({ class: cls }, 'Joined class successfully'));
  } catch (err) {
    console.error('JOIN CLASS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student: get enrolled classes ────────────────────────────
exports.getEnrolledClasses = async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { student_id: req.user.id },
    });
    const classIds = enrollments.map(e => e.class_id);
    if (classIds.length === 0)
      return res.json(success({ classes: [] }));

    const classes = await Class.findAll({ where: { id: classIds } });
    return res.json(success({ classes }));
  } catch (err) {
    console.error('GET ENROLLED CLASSES ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Lecturer: student performance for a class ────────────────
// GET /api/classes/:id/performance
//
// Returns every enrolled student with their running attendance
// percentage, risk level, and per-session breakdown.
exports.getClassPerformance = async (req, res) => {
  try {
    const { id: classId } = req.params;

    const cls = await Class.findOne({
      where: { id: classId, lecturer_id: req.user.id },
    });
    if (!cls) return res.status(404).json(error('Class not found'));

    const threshold = Number(cls.attendance_threshold) || 75;
    const WARN_BAND = 5;

    // All closed sessions oldest-first (determines session order in breakdown)
    const sessions = await Session.findAll({
      where:      { class_id: classId, status: 'closed' },
      attributes: ['id', 'title', 'open_at', 'closed_at'],
      order:      [['open_at', 'ASC']],
    });

    // All enrolled students
    const enrollments = await Enrollment.findAll({
      where:   { class_id: classId },
      include: [{
        model:      User,
        as:         'student',
        attributes: ['id', 'name', 'email', 'student_id'],
      }],
    });

    const totalSessions = sessions.length;

    // No closed sessions yet — return empty stats
    if (totalSessions === 0) {
      const students = enrollments.filter(e => e.student).map(e => ({
        studentId:     e.student.id,
        studentName:   e.student.name,
        studentEmail:  e.student.email,
        studentNumber: e.student.student_id,
        attendedCount: 0,
        totalSessions: 0,
        percentage:    0,
        risk:          'none',
        sessions:      [],
      }));
      return res.json(success({
        class:         { id: cls.id, name: cls.name, code: cls.code, threshold },
        students,
        totalSessions: 0,
        summary: { total: students.length, safe: 0, warning: 0, danger: 0, none: students.length, avgPercentage: 0 },
      }));
    }

    // Single query for all attendance rows
    const sessionIds    = sessions.map(s => s.id);
    const allAttendance = await Attendance.findAll({
      where:      { session_id: { [Op.in]: sessionIds } },
      attributes: ['student_id', 'session_id', 'status'],
    });

    // studentId → sessionId → status
    const attendanceMap = new Map();
    for (const a of allAttendance) {
      if (!attendanceMap.has(a.student_id))
        attendanceMap.set(a.student_id, new Map());
      attendanceMap.get(a.student_id).set(a.session_id, a.status);
    }

    const students = enrollments
      .filter(e => e.student)
      .map(e => {
        const bySession     = attendanceMap.get(e.student.id) ?? new Map();
        const attendedCount = [...bySession.values()]
          .filter(s => s === 'present' || s === 'late').length;
        const percentage    = Math.round((attendedCount / totalSessions) * 100);

        const risk = totalSessions < 3
          ? 'none'
          : percentage >= threshold
            ? 'safe'
            : percentage >= threshold - WARN_BAND
              ? 'warning'
              : 'danger';

        const sessionBreakdown = sessions.map(s => ({
          sessionId: s.id,
          title:     s.title || 'Attendance session',
          openAt:    s.open_at,
          status:    bySession.get(s.id) ?? 'absent',
        }));

        return {
          studentId:     e.student.id,
          studentName:   e.student.name,
          studentEmail:  e.student.email,
          studentNumber: e.student.student_id,
          attendedCount,
          totalSessions,
          percentage,
          risk,
          sessions: sessionBreakdown,
        };
      })
      .sort((a, b) => a.percentage - b.percentage); // most at-risk first

    const safeCount   = students.filter(s => s.risk === 'safe').length;
    const warnCount   = students.filter(s => s.risk === 'warning').length;
    const dangerCount = students.filter(s => s.risk === 'danger').length;
    const noneCount   = students.filter(s => s.risk === 'none').length;
    const avgPct      = students.length
      ? Math.round(students.reduce((acc, s) => acc + s.percentage, 0) / students.length)
      : 0;

    return res.json(success({
      class:         { id: cls.id, name: cls.name, code: cls.code, threshold },
      students,
      totalSessions,
      summary: { total: students.length, safe: safeCount, warning: warnCount, danger: dangerCount, none: noneCount, avgPercentage: avgPct },
    }));

  } catch (err) {
    console.error('GET CLASS PERFORMANCE ERROR:', err);
    return res.status(500).json(error('Server error'));
  }
};