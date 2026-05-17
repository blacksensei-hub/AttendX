const { Session, Attendance, Class, User, Enrollment } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { Op, QueryTypes }  = require('sequelize');

// ─── Lecturer dashboard stats ─────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const classes = await Class.findAll({
      where:   { lecturer_id: req.user.id },
      include: [{ model: User, as: 'students', attributes: ['id'] }],
    });

    const classIds = classes.map(c => c.id);
    const sessions = await Session.findAll({
      where: { class_id: classIds, status: 'closed' },
    });

    let totalPresent = 0, totalRecords = 0;
    for (const session of sessions) {
      const records  = await Attendance.findAll({ where: { session_id: session.id } });
      totalPresent  += records.filter(r => r.status !== 'absent').length;
      totalRecords  += records.length;
    }

    const avgAttendance = totalRecords > 0
      ? Math.round((totalPresent / totalRecords) * 100)
      : 0;

    return res.json(success({ avgAttendance, totalSessions: sessions.length }));
  } catch (err) {
    console.error('DASHBOARD STATS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student personal stats ───────────────────────────────────
exports.getStudentStats = async (req, res) => {
  try {
    const records = await Attendance.findAll({
      where: { student_id: req.user.id },
    });

    const present = records.filter(r => r.status === 'present').length;
    const late    = records.filter(r => r.status === 'late').length;
    const total   = records.length;

    return res.json(success({
      present,
      late,
      absent:        0,
      totalSessions: total,
      onTimeRate:    total > 0 ? Math.round((present / total) * 100) : 0,
      thisMonth:     total > 0 ? Math.round(((present + late) / total) * 100) : 0,
      trend:         [],
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

    const cls = await Class.findByPk(classId);
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

    // Enrich each session with attendance counts AND the critical
    // classId field — the frontend uses its presence to determine
    // whether the parent class still exists or was deleted.
    const enriched = await Promise.all(sessions.map(async s => {
      const records = await Attendance.findAll({ where: { session_id: s.id } });
      return {
        id:        s.id,
        classId:   s.class?.id ?? null,   // null if the class was deleted
        title:     s.title,
        className: s.class?.name ?? s.class_name_snapshot ?? 'Deleted class',
        status:    s.status,
        openAt:    s.open_at,
        closedAt:  s.closed_at,
        present:   records.filter(r => r.status === 'present').length,
        late:      records.filter(r => r.status === 'late').length,
        total:     records.length,
      };
    }));

    return res.json(success({ sessions: enriched }));
  } catch (err) {
    console.error('GET ALL SESSIONS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student attendance history ───────────────────────────────
// Uses a raw query so we can LEFT JOIN attendance — students who never
// marked a session appear with status 'absent' rather than being omitted.
// The key fix is casting a.id to text so COALESCE works correctly when
// mixing UUID and text types (PostgreSQL is strict about type matching).
exports.getStudentHistory = async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const studentId = req.user.id;
    const { status, from, to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Use parameterised replacements to prevent SQL injection — never
    // interpolate user input directly into SQL strings.
    const conditions = [
      `e.student_id = :studentId`,
      `s.status = 'closed'`,
    ];
    const replacements = { studentId };

    if (status === 'absent') {
      conditions.push(`a.id IS NULL`);
    } else if (status === 'present') {
      conditions.push(`a.status = 'present'`);
    } else if (status === 'late') {
      conditions.push(`a.status = 'late'`);
    }

    if (from) {
      conditions.push(`s.open_at >= :from`);
      replacements.from = from;
    }
    if (to) {
      conditions.push(`s.open_at <= :to`);
      replacements.to = `${to} 23:59:59`;
    }

    const where = conditions.join(' AND ');

    // COALESCE fix: cast a.id to text so both sides are the same type.
    // a.id is UUID, the concatenation produces text — without ::text the
    // query crashes with "COALESCE types uuid and text cannot be matched".
    const records = await sequelize.query(`
      SELECT
        COALESCE(a.id::text, s.id::text || '-' || e.student_id::text) AS id,
        s.id                  AS "sessionId",
        s.title               AS "sessionTitle",
        s.class_name_snapshot AS "className",
        s.open_at             AS "openAt",
        a.marked_at,
        COALESCE(a.status, 'absent')                                   AS status
      FROM enrollments e
      INNER JOIN sessions  s ON s.class_id  = e.class_id
      LEFT  JOIN attendance a ON a.session_id = s.id
                              AND a.student_id = e.student_id
      WHERE ${where}
      ORDER BY s.open_at DESC
      LIMIT :limit OFFSET :offset
    `, {
      replacements: { ...replacements, limit: parseInt(limit), offset },
      type:         QueryTypes.SELECT,
    });

    const countResult = await sequelize.query(`
      SELECT COUNT(*) AS total
      FROM enrollments e
      INNER JOIN sessions  s ON s.class_id  = e.class_id
      LEFT  JOIN attendance a ON a.session_id = s.id
                              AND a.student_id = e.student_id
      WHERE ${where}
    `, {
      replacements,
      type: QueryTypes.SELECT,
    });

    const total      = parseInt(countResult[0].total);
    const totalPages = Math.ceil(total / parseInt(limit));

    return res.json(success({ records, total, totalPages, page: parseInt(page) }));
  } catch (err) {
    console.error('GET STUDENT HISTORY ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Clear student history ────────────────────────────────────
exports.clearStudentHistory = async (req, res) => {
  try {
    const deleted = await Attendance.destroy({
      where: { student_id: req.user.id },
    });
    return res.json(success(
      { deleted },
      `${deleted} attendance record${deleted !== 1 ? 's' : ''} cleared`
    ));
  } catch (err) {
    console.error('CLEAR HISTORY ERROR:', err.message);
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
      if (!s) return res.status(404).json(error('Session not found'));
      sessions = [s];
    } else if (classId) {
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
exports.exportStudentHistoryCSV = async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const where = { student_id: req.user.id };

    if (status) where.status = status;
    if (from || to) {
      where.marked_at = {};
      if (from) where.marked_at[Op.gte] = new Date(from);
      if (to)   where.marked_at[Op.lte] = new Date(to);
    }

    const records = await Attendance.findAll({
      where,
      include: [{
        model:    Session,
        as:       'session',
        include: [{
          model:      Class,
          as:         'class',
          attributes: ['name'],
          required:   false,
        }],
      }],
      order: [['marked_at', 'DESC']],
    });

    const rows = records.map(r => ({
      Class:    r.session?.class?.name ?? r.session?.class_name_snapshot ?? 'Deleted class',
      Session:  r.session?.title || 'Attendance session',
      Status:   r.status,
      MarkedAt: r.marked_at
        ? new Date(r.marked_at).toLocaleString('en-GB')
        : '—',
    }));

    const { Parser } = require('json2csv');
    const csv = new Parser().parse(rows);
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
      if (!s) return res.status(404).json(error('Session not found'));
      sessions    = [s];
      reportTitle = s.class_name_snapshot ?? 'Session Report';
    } else if (classId) {
      const cls   = await Class.findByPk(classId);
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

    const session = await Session.findByPk(sessionId, {
      include: [{ model: Class, as: 'class' }],
    });
    if (!session) return res.status(404).json(error('Session not found'));

    const cls = await Class.findOne({
      where: { id: session.class_id, lecturer_id: req.user.id },
    });

    if (!cls) {
      const lecturerClasses = await Class.findAll({
        where: { lecturer_id: req.user.id },
      });
      const classIds = lecturerClasses.map(c => c.id);
      if (!classIds.includes(session.class_id)) {
        return res.status(403).json(error('Not authorized to delete this report'));
      }
    }

    await Attendance.destroy({ where: { session_id: sessionId } });
    await session.destroy();

    return res.json(success(null, 'Session report deleted'));
  } catch (err) {
    console.error('DELETE SESSION REPORT ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};