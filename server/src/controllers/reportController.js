const { Session, Attendance, Class, User, sequelize } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { Op, QueryTypes }  = require('sequelize');

// ─── Shared: which sessions count for a student ───────────────
//
// A student is expected at every CLOSED session of a class they are
// enrolled in, held after they enrolled. No attendance row means
// absent (sessions closed before absences were written at close
// time). A session from before they enrolled only appears if they
// actually attended it. History, the CSV export and the dashboard
// stats all use this, so their numbers always agree.
function studentScope(studentId, { status, from, to } = {}) {
  const conditions = [
    `e.student_id = :studentId`,
    `s.status = 'closed'`,
    `(a.status IN ('present', 'late') OR s.open_at >= COALESCE(e.enrolled_at, s.open_at))`,
  ];
  const replacements = { studentId };

  if (status === 'absent') {
    conditions.push(`(a.id IS NULL OR a.status = 'absent')`);
  } else if (status === 'present' || status === 'late') {
    conditions.push(`a.status = :status`);
    replacements.status = status;
  }
  if (from) {
    conditions.push(`s.open_at >= :from`);
    replacements.from = from;
  }
  if (to) {
    conditions.push(`s.open_at < (CAST(:to AS date) + INTERVAL '1 day')`);
    replacements.to = to;
  }
  return { where: conditions.join(' AND '), replacements };
}

const STUDENT_FROM = `
  FROM enrollments e
  INNER JOIN sessions   s ON s.class_id   = e.class_id
  LEFT  JOIN attendance a ON a.session_id = s.id
                          AND a.student_id = e.student_id
`;

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);

// Lecturer report endpoints must only ever expose the caller's own
// classes. Classes are deactivated rather than deleted, so ownership
// always comes from classes.lecturer_id.
const ownsClass = (classId, lecturerId) =>
  classId ? Class.findOne({ where: { id: classId, lecturer_id: lecturerId }, attributes: ['id', 'name'] }) : null;

// ─── Lecturer dashboard stats ─────────────────────────────────
// One query: every closed session of the lecturer's classes, with how
// many enrolled students were expected and how many attended.
exports.getDashboardStats = async (req, res) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        s.id,
        s.open_at                                                    AS "openAt",
        COUNT(e.student_id)                                          AS expected,
        COUNT(a.id) FILTER (WHERE a.status IN ('present', 'late'))   AS attended
      FROM sessions s
      INNER JOIN classes     c ON c.id        = s.class_id
      INNER JOIN enrollments e ON e.class_id  = s.class_id
                              AND s.open_at  >= COALESCE(e.enrolled_at, s.open_at)
      LEFT  JOIN attendance  a ON a.session_id = s.id
                              AND a.student_id = e.student_id
      WHERE c.lecturer_id = :lecturerId
        AND s.status      = 'closed'
      GROUP BY s.id, s.open_at
    `, {
      replacements: { lecturerId: req.user.id },
      type:         QueryTypes.SELECT,
    });

    let expected = 0, attended = 0;
    const byDay = new Map();
    const since = Date.now() - 14 * 86400000;
    for (const r of rows) {
      const exp = Number(r.expected), att = Number(r.attended);
      expected += exp;
      attended += att;
      if (new Date(r.openAt).getTime() >= since) {
        const day = new Date(r.openAt).toISOString().slice(0, 10);
        const d = byDay.get(day) ?? { expected: 0, attended: 0 };
        d.expected += exp;
        d.attended += att;
        byDay.set(day, d);
      }
    }

    const trend = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, rate: pct(d.attended, d.expected) }));

    return res.json(success({
      avgAttendance: pct(attended, expected),
      totalSessions: rows.length,
      trend,
    }));
  } catch (err) {
    console.error('DASHBOARD STATS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student personal stats ───────────────────────────────────
exports.getStudentStats = async (req, res) => {
  try {
    const { where, replacements } = studentScope(req.user.id);
    const rows = await sequelize.query(`
      SELECT COALESCE(a.status, 'absent') AS status, s.open_at AS "openAt"
      ${STUDENT_FROM}
      WHERE ${where}
    `, { replacements, type: QueryTypes.SELECT });

    const present  = rows.filter(r => r.status === 'present').length;
    const late     = rows.filter(r => r.status === 'late').length;
    const absent   = rows.length - present - late;
    const attended = present + late;

    // This calendar month
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthRows  = rows.filter(r => new Date(r.openAt) >= monthStart);
    const monthAttended = monthRows.filter(r => r.status !== 'absent').length;

    // Weekly trend over the last 10 weeks (weeks with sessions only)
    const weeks = new Map();
    const tenWeeksAgo = now.getTime() - 70 * 86400000;
    for (const r of rows) {
      const t = new Date(r.openAt);
      if (t.getTime() < tenWeeksAgo) continue;
      const monday = new Date(t);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const w = weeks.get(key) ?? { held: 0, attended: 0 };
      w.held += 1;
      if (r.status !== 'absent') w.attended += 1;
      weeks.set(key, w);
    }
    const trend = [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, w]) => ({ date, rate: pct(w.attended, w.held) }));

    return res.json(success({
      present,
      late,
      absent,
      attended,
      totalSessions: rows.length,              // sessions the student was expected at
      attendanceRate: pct(attended, rows.length),
      onTimeRate:    pct(present, attended),   // of the sessions attended, how many on time
      thisMonth:     pct(monthAttended, monthRows.length),
      trend,
    }));
  } catch (err) {
    console.error('STUDENT STATS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Class summary (works even after class deletion) ──────────
exports.getClassSummary = async (req, res) => {
  try {
    const { classId } = req.params;

    const cls = await ownsClass(classId, req.user.id);
    if (!cls) return res.status(404).json(error('Class not found'));

    const sessions = await Session.findAll({ where: { class_id: classId } });

    const summary = await Promise.all(sessions.map(async s => {
      const records = await Attendance.findAll({
        where:   { session_id: s.id },
        include: [{
          model:      User,
          as:         'student',
          attributes: ['name', 'email', 'student_id'],
        }],
      });
      return {
        sessionId: s.id,
        title:     s.title,
        openAt:    s.open_at,
        closedAt:  s.closed_at,
        status:    s.status,
        present:   records.filter(r => r.status === 'present').length,
        late:      records.filter(r => r.status === 'late').length,
        absent:    records.filter(r => r.status === 'absent').length,
        total:     records.length,
        records:   records.map(r => ({
          name:      r.student?.name,
          email:     r.student?.email,
          studentId: r.student?.student_id,
          status:    r.status,
          markedAt:  r.marked_at,
        })),
      };
    }));

    return res.json(success({ summary, className: cls.name }));
  } catch (err) {
    console.error('CLASS SUMMARY ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── All sessions for a lecturer (including deleted classes) ──
// Returns every session the lecturer ever owned — even if the
// class itself was later deleted. We identify deleted classes by
// checking whether s.class exists in the join result.
exports.getAllSessions = async (req, res) => {
  try {
    const classes  = await Class.findAll({ where: { lecturer_id: req.user.id } });
    const classIds = classes.map(c => c.id);

    const sessions = await Session.findAll({
      where:   { class_id: classIds },
      include: [{
        model:      Class,
        as:         'class',
        required:   false,
        attributes: ['id', 'name', 'code'],
      }],
      order: [['open_at', 'DESC']],
    });

    // Attendance counts for every session in one grouped query
    // (this used to be one query per session).
    const counts = sessions.length
      ? await Attendance.findAll({
          where:      { session_id: sessions.map(s => s.id) },
          attributes: ['session_id', 'status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
          group:      ['session_id', 'status'],
          raw:        true,
        })
      : [];
    const tally = new Map();
    for (const c of counts) {
      const t = tally.get(c.session_id) ?? { present: 0, late: 0, total: 0 };
      if (c.status === 'present') t.present = Number(c.n);
      if (c.status === 'late')    t.late    = Number(c.n);
      t.total += Number(c.n);
      tally.set(c.session_id, t);
    }

    // classId is null when the class was deleted; the frontend uses
    // that to mark the session's class as deleted.
    const enriched = sessions.map(s => ({
      id:        s.id,
      classId:   s.class?.id ?? null,
      title:     s.title,
      className: s.class?.name ?? s.class_name_snapshot ?? 'Deleted class',
      status:    s.status,
      openAt:    s.open_at,
      closedAt:  s.closed_at,
      ...(tally.get(s.id) ?? { present: 0, late: 0, total: 0 }),
    }));

    return res.json(success({ sessions: enriched }));
  } catch (err) {
    console.error('GET ALL SESSIONS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student attendance history ───────────────────────────────
// Every expected session for the student (see studentScope), newest
// first, with absences derived where no row exists. All filters are
// bound as replacements, never interpolated.
exports.getStudentHistory = async (req, res) => {
  try {
    const { status, from, to, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const { where, replacements } = studentScope(req.user.id, { status, from, to });

    // a.id is a UUID and the fallback is text, so cast before COALESCE
    const records = await sequelize.query(`
      SELECT
        COALESCE(a.id::text, s.id::text || '-' || e.student_id::text) AS id,
        s.id                          AS "sessionId",
        s.title                       AS "sessionTitle",
        s.class_name_snapshot         AS "className",
        s.open_at                     AS "openAt",
        a.marked_at,
        COALESCE(a.status, 'absent')  AS status
      ${STUDENT_FROM}
      WHERE ${where}
      ORDER BY s.open_at DESC
      LIMIT :limit OFFSET :offset
    `, {
      replacements: { ...replacements, limit: limitNum, offset: (pageNum - 1) * limitNum },
      type:         QueryTypes.SELECT,
    });

    const [{ total }] = await sequelize.query(`
      SELECT COUNT(*) AS total
      ${STUDENT_FROM}
      WHERE ${where}
    `, { replacements, type: QueryTypes.SELECT });

    const totalNum = parseInt(total);
    return res.json(success({
      records,
      total:      totalNum,
      totalPages: Math.max(1, Math.ceil(totalNum / limitNum)),
      page:       pageNum,
    }));
  } catch (err) {
    console.error('GET STUDENT HISTORY ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Export CSV (lecturer — by session or class) ──────────────
exports.exportCSV = async (req, res) => {
  try {
    const { classId, sessionId } = req.query;
    let sessions;

    if (sessionId) {
      const s = await Session.findByPk(sessionId);
      if (!s || !(await ownsClass(s.class_id, req.user.id)))
        return res.status(404).json(error('Session not found'));
      sessions = [s];
    } else if (classId) {
      if (!(await ownsClass(classId, req.user.id)))
        return res.status(404).json(error('Class not found'));
      sessions = await Session.findAll({ where: { class_id: classId } });
    } else {
      return res.status(400).json(error('Provide classId or sessionId'));
    }

    const rows = [];
    for (const s of sessions) {
      const records = await Attendance.findAll({
        where:   { session_id: s.id },
        include: [{
          model:      User,
          as:         'student',
          attributes: ['name', 'email', 'student_id'],
        }],
      });
      records.forEach(r => {
        rows.push({
          Class:     s.class_name_snapshot ?? 'Deleted class',
          Session:   s.title || 'Attendance session',
          Date:      s.open_at
            ? new Date(s.open_at).toLocaleDateString('en-GB')
            : '—',
          StudentID: r.student?.student_id ?? '—',
          Student:   r.student?.name       ?? '—',
          Email:     r.student?.email      ?? '—',
          Status:    r.status,
          MarkedAt:  r.marked_at
            ? new Date(r.marked_at).toLocaleString('en-GB')
            : '—',
        });
      });
    }

    if (rows.length === 0) {
      rows.push({ Note: 'No attendance records found for this selection' });
    }

    const { Parser } = require('json2csv');
    const csv = new Parser().parse(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
    return res.send(csv);
  } catch (err) {
    console.error('EXPORT CSV ERROR:', err.message);
    return res.status(500).json(error('Export failed'));
  }
};

// ─── Export student history CSV ───────────────────────────────
// Same rows as the History page (studentScope), so derived absences
// are included and the date filter matches what the student sees.
exports.exportStudentHistoryCSV = async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const { where, replacements } = studentScope(req.user.id, { status, from, to });

    const records = await sequelize.query(`
      SELECT
        s.class_name_snapshot         AS "className",
        s.title                       AS "sessionTitle",
        s.open_at                     AS "openAt",
        a.marked_at,
        COALESCE(a.status, 'absent')  AS status
      ${STUDENT_FROM}
      WHERE ${where}
      ORDER BY s.open_at DESC
    `, { replacements, type: QueryTypes.SELECT });

    const rows = records.map(r => ({
      Class:    r.className || 'Deleted class',
      Session:  r.sessionTitle || 'Attendance session',
      Date:     new Date(r.openAt).toLocaleDateString('en-GB'),
      Status:   r.status,
      MarkedAt: r.marked_at ? new Date(r.marked_at).toLocaleString('en-GB') : '',
    }));

    // Explicit fields so an empty result still produces a header row
    // (json2csv throws on empty data without them).
    const { Parser } = require('json2csv');
    const csv = new Parser({ fields: ['Class', 'Session', 'Date', 'Status', 'MarkedAt'] }).parse(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=my-attendance.csv');
    return res.send(csv);
  } catch (err) {
    console.error('EXPORT STUDENT CSV ERROR:', err.message);
    return res.status(500).json(error('Export failed'));
  }
};

// ─── Export PDF (lecturer) ────────────────────────────────────
exports.exportPDF = async (req, res) => {
  try {
    const { classId, sessionId } = req.query;
    let sessions, reportTitle;

    if (sessionId) {
      const s = await Session.findByPk(sessionId);
      if (!s || !(await ownsClass(s.class_id, req.user.id)))
        return res.status(404).json(error('Session not found'));
      sessions    = [s];
      reportTitle = s.class_name_snapshot ?? 'Session Report';
    } else if (classId) {
      const cls   = await ownsClass(classId, req.user.id);
      if (!cls) return res.status(404).json(error('Class not found'));
      sessions    = await Session.findAll({ where: { class_id: classId } });
      reportTitle = cls?.name ?? 'Attendance Report';
    } else {
      return res.status(400).json(error('Provide classId or sessionId'));
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.pdf');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#1e40af').text('Attendance Report', { align: 'center' });
    doc.fontSize(14).fillColor('#374151').text(reportTitle, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#6b7280')
       .text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'right' });
    doc.moveDown();

    for (const s of sessions) {
      const records = await Attendance.findAll({
        where:   { session_id: s.id },
        include: [{
          model:      User,
          as:         'student',
          attributes: ['name', 'email', 'student_id'],
        }],
      });

      doc.fontSize(13).fillColor('#111827').font('Helvetica-Bold')
         .text(`Session: ${s.title || 'Attendance Session'}`);
      doc.fontSize(10).fillColor('#6b7280').font('Helvetica')
         .text(`Date: ${s.open_at
           ? new Date(s.open_at).toLocaleDateString('en-GB', {
               weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
             })
           : '—'}`);

      const present = records.filter(r => r.status === 'present').length;
      const late    = records.filter(r => r.status === 'late').length;
      const absent  = records.filter(r => r.status === 'absent').length;
      doc.text(`Present: ${present}  Late: ${late}  Absent: ${absent}  Total marked: ${records.length}`);
      doc.moveDown(0.5);

      if (records.length === 0) {
        doc.fontSize(10).fillColor('#9ca3af').text('No attendance records for this session.');
      } else {
        records.forEach((r, idx) => {
          const statusColor = r.status === 'present' ? '#10b981'
                            : r.status === 'late'    ? '#d97706' : '#ef4444';
          doc.fontSize(10).fillColor('#111827')
             .text(
               `${idx + 1}. ${r.student?.student_id ? `[${r.student.student_id}] ` : ''}` +
               `${r.student?.name ?? '—'} (${r.student?.email ?? '—'}) — `,
               { continued: true }
             )
             .fillColor(statusColor)
             .text(r.status.toUpperCase());
        });
      }
      doc.moveDown();
      if (doc.y > 700) doc.addPage();
    }

    doc.end();
  } catch (err) {
    console.error('EXPORT PDF ERROR:', err.message);
    return res.status(500).json(error('Export failed'));
  }
};

// ─── Delete session report ────────────────────────────────────
exports.deleteSessionReport = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findByPk(sessionId);
    if (!session) return res.status(404).json(error('Session not found'));

    if (!(await ownsClass(session.class_id, req.user.id))) {
      return res.status(403).json(error('Not authorized to delete this report'));
    }
    if (session.status !== 'closed') {
      return res.status(409).json(error('Close the session before deleting its report'));
    }

    await Attendance.destroy({ where: { session_id: sessionId } });
    await session.destroy();

    return res.json(success(null, 'Session report deleted'));
  } catch (err) {
    console.error('DELETE SESSION REPORT ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};