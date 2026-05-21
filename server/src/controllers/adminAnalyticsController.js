// server/src/controllers/adminAnalyticsController.js
const { User, Class, Session, Attendance,
        Enrollment }    = require('../models');
const { success, error } = require('../utils/apiResponse');
const { Op, fn, col, literal } = require('sequelize');

// ─────────────────────────────────────────────────────────────
// GET /api/admin/analytics
// Returns all chart data in one request.
// ─────────────────────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const days = Number(req.query.days ?? 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // ── Run all queries in parallel ───────────────────────────
    const [
      sessionsRaw,
      classes,
      allAttendance,
      userCounts,
      recentSessions,
    ] = await Promise.all([
      // All closed sessions with their open_at date
      Session.findAll({
        where:      { status: 'closed', open_at: { [Op.gte]: since } },
        attributes: ['id', 'open_at', 'class_id'],
        raw:        true,
      }),
      // All classes with name and threshold
      Class.findAll({
        attributes: ['id', 'name', 'attendance_threshold'],
        raw:        true,
      }),
      // All attendance rows for closed sessions in range
      Attendance.findAll({
        attributes: ['session_id', 'status'],
        raw:        true,
      }),
      // User counts by role
      Promise.all([
        User.count({ where: { role: 'student'  } }),
        User.count({ where: { role: 'lecturer' } }),
        User.count({ where: { role: 'admin'    } }),
      ]),
      // Session counts per day for chart
      Session.findAll({
        where:      { open_at: { [Op.gte]: since } },
        attributes: [
          [fn('DATE', col('open_at')), 'date'],
          [fn('COUNT', col('id')),     'count'],
        ],
        group: [fn('DATE', col('open_at'))],
        order: [[fn('DATE', col('open_at')), 'ASC']],
        raw:   true,
      }),
    ]);

    // ── Sessions over time — fill gaps with 0 ────────────────
    const dateMap = new Map(recentSessions.map(r => [r.date, Number(r.count)]));
    const sessionsOverTime = [];
    for (let d = 0; d < days; d++) {
      const date = new Date(since.getTime() + d * 24 * 60 * 60 * 1000);
      const key  = date.toISOString().slice(0, 10);
      sessionsOverTime.push({
        date:  key,
        label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        count: dateMap.get(key) ?? 0,
      });
    }

    // ── Attendance by class ───────────────────────────────────
    // Build lookup: sessionId → classId
    const sessionClassMap = new Map(sessionsRaw.map(s => [s.id, s.class_id]));

    // Build per-class attendance counters
    const classStats = new Map();
    for (const cls of classes) {
      classStats.set(cls.id, {
        name:      cls.name,
        threshold: Number(cls.attendance_threshold) || 75,
        present:   0,
        late:      0,
        absent:    0,
        total:     0,
      });
    }

    // Count attendance per class from raw attendance rows
    for (const a of allAttendance) {
      const classId = sessionClassMap.get(a.session_id);
      if (!classId || !classStats.has(classId)) continue;
      const c = classStats.get(classId);
      c.total++;
      if (a.status === 'present') c.present++;
      else if (a.status === 'late')    c.late++;
      else                              c.absent++;
    }

    const attendanceByClass = [...classStats.values()]
      .filter(c => c.total > 0)
      .map(c => ({
        name:      c.name,
        threshold: c.threshold,
        present:   c.present,
        late:      c.late,
        absent:    c.absent,
        total:     c.total,
        rate:      Math.round(((c.present + c.late) / c.total) * 100),
      }))
      .sort((a, b) => b.rate - a.rate);

    // ── Platform-wide status breakdown ────────────────────────
    const totalPresent = allAttendance.filter(a => a.status === 'present').length;
    const totalLate    = allAttendance.filter(a => a.status === 'late').length;
    const totalAbsent  = allAttendance.filter(a => a.status === 'absent').length;

    const statusBreakdown = [
      { name: 'Present', value: totalPresent, color: '#10b981' },
      { name: 'Late',    value: totalLate,    color: '#f59e0b' },
      { name: 'Absent',  value: totalAbsent,  color: '#ef4444' },
    ].filter(s => s.value > 0);

    // ── User breakdown ────────────────────────────────────────
    const [students, lecturers, admins] = userCounts;
    const userBreakdown = [
      { name: 'Students',  value: students,  color: '#2563eb' },
      { name: 'Lecturers', value: lecturers, color: '#7c3aed' },
      { name: 'Admins',    value: admins,    color: '#0891b2' },
    ].filter(u => u.value > 0);

    // ── Overall platform attendance rate ─────────────────────
    const totalMarked = totalPresent + totalLate + totalAbsent;
    const platformRate = totalMarked > 0
      ? Math.round(((totalPresent + totalLate) / totalMarked) * 100)
      : 0;

    return res.json(success({
      sessionsOverTime,
      attendanceByClass,
      statusBreakdown,
      userBreakdown,
      summary: {
        totalSessions:    sessionsRaw.length,
        totalAttendance:  totalMarked,
        platformRate,
        days,
      },
    }));

  } catch (err) {
    console.error('[Analytics] getAnalytics error:', err);
    return res.status(500).json(error('Failed to load analytics'));
  }
};