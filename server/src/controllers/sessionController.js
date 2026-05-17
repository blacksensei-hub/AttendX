const { notifyEnrolledStudents } = require('../services/notificationService');
const { Session, Class, Enrollment, Attendance, QRToken, User } = require('../models');
const { generateToken }          = require('../services/qrService');
const { success, error }         = require('../utils/apiResponse');
const { Op }                     = require('sequelize');
const {
  sendSessionOpenedEmail,
  sendSessionClosedEmails,
} = require('../services/emailService');

// ─── Shared helper: notify students when a session closes ─────
// Called by both closeSession (manual) and the background scheduler
// (auto-close) so the logic is identical in both cases.
async function notifySessionClosed(session, cls) {
  try {
    const className = cls?.name ?? session.class_name_snapshot ?? 'your class';

    // Fetch every enrolled student with their user details
    const enrollments = await Enrollment.findAll({
      where:   { class_id: session.class_id },
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email'] }],
    });

    // Fetch all attendance records for this session so we know
    // who marked and what their status was
    const attendanceRecords = await Attendance.findAll({
      where: { session_id: session.id },
    });

    // Build a lookup map from student_id → status for O(1) access
    const statusMap = {};
    attendanceRecords.forEach(r => { statusMap[r.student_id] = r.status; });

    // Every enrolled student gets an email — those who never marked
    // attendance are included with status 'absent' rather than omitted
    const records = enrollments
      .filter(e => e.student)
      .map(e => ({
        studentEmail: e.student.email,
        studentName:  e.student.name,
        status:       statusMap[e.student.id] ?? 'absent',
      }));

    if (records.length === 0) return;

    // Fire and forget — a slow email server should never delay
    // the API response or block the scheduler's next cycle
    sendSessionClosedEmails({
      className,
      sessionTitle: session.title,
      closedAt:     session.closed_at ?? new Date().toISOString(),
      records,
    }).catch(err =>
      console.error('[Session] Closed email batch error:', err.message)
    );
  } catch (err) {
    console.error('[Session] notifySessionClosed error:', err.message);
  }
}

// Export so the scheduler can call the same function for auto-closes
exports.notifySessionClosed = notifySessionClosed;

// ─── Open session ─────────────────────────────────────────────
exports.openSession = async (req, res) => {
  try {
    const { classId, title, late_threshold, qr_interval, close_after } = req.body;

    // Verify the class exists and belongs to this lecturer
    const cls = await Class.findOne({
      where: { id: classId, lecturer_id: req.user.id },
    });
    if (!cls) return res.status(404).json(error('Class not found or unauthorized'));

    // Prevent opening a second session while one is already running
    const existingOpen = await Session.findOne({
      where: { class_id: classId, status: 'open' },
    });
    if (existingOpen)
      return res.status(409).json(error('A session is already open for this class'));

    // Calculate the absolute auto-close timestamp from the relative minutes.
    // We store this in the database so the background scheduler can find it —
    // this is far more reliable than setTimeout which is lost on server restart.
    const closeAt = close_after
      ? new Date(Date.now() + close_after * 60 * 1000)
      : null;

    const session = await Session.create({
      class_id:            classId,
      title:               title || null,
      late_threshold:      late_threshold ?? 15,
      qr_interval:         qr_interval    ?? 5,
      close_at:            closeAt,
      geo_lat:             cls.geo_lat,
      geo_lng:             cls.geo_lng,
      geo_radius:          cls.geo_radius,
      class_name_snapshot: cls.name,
    });

    // Generate the first QR token immediately so the lecturer sees
    // a QR code the moment the session page loads
    await generateToken(session.id, session.qr_interval);

    const io = req.app.get('io');

    // Push a WebSocket event to any students already on their dashboard
    io?.to(`class:${classId}`).emit('session:opened', {
      sessionId: session.id,
      className: cls.name,
      title:     session.title,
    });

    // Fetch enrolled students once — reused for both notifications and emails
    const enrollments = await Enrollment.findAll({
      where:   { class_id: classId },
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email'] }],
    });

    // Create in-app bell notifications for all enrolled students.
    // Fire and forget — a notification failure must never block the response.
    notifyEnrolledStudents(io, classId, {
      type:    'session_opened',
      title:   '🔴 Attendance session opened',
      message: `${cls.name} has started an attendance session. Mark your attendance now!`,
      data:    { sessionId: session.id, classId, className: cls.name },
    }).catch(err => console.error('[Session] Notify error:', err.message));

    // Send session opened emails to all enrolled students in parallel.
    // Promise.allSettled ensures one failed email never blocks the rest.
    Promise.allSettled(
      enrollments
        .filter(e => e.student)
        .map(e => sendSessionOpenedEmail({
          to:           e.student.email,
          studentName:  e.student.name,
          className:    cls.name,
          sessionTitle: session.title,
        }))
    ).catch(err => console.error('[Session] Opened email batch error:', err.message));

    // NOTE: The 2-minute closing-soon warning and auto-close are both handled
    // by the background scheduler in sessionScheduler.js — no setTimeout needed.
    // The scheduler polls every 30 seconds and handles both reliably, even
    // surviving server restarts because it reads close_at from the database.

    return res.status(201).json(success({ session }, 'Session opened'));
  } catch (err) {
    console.error('OPEN SESSION ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Close session (manual) ───────────────────────────────────
exports.closeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findByPk(sessionId);
    if (!session) return res.status(404).json(error('Session not found'));

    // Verify ownership — the class may have been deleted, in which case
    // cls will be null. We only enforce ownership if the class still exists.
    const cls = await Class.findByPk(session.class_id);
    if (cls && cls.lecturer_id !== req.user.id)
      return res.status(403).json(error('Not your session'));

    await session.update({ status: 'closed', closed_at: new Date() });

    // Tell any open WebSocket connections that the session has ended
    req.app.get('io')
      ?.to(`session:${sessionId}`)
      .emit('session:closed', { sessionId });

    // Send summary emails to all enrolled students — non-blocking
    notifySessionClosed(session, cls);

    return res.json(success({ session }, 'Session closed'));
  } catch (err) {
    console.error('CLOSE SESSION ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get current QR token ─────────────────────────────────────
exports.getCurrentQR = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findByPk(sessionId);
    if (!session || session.status !== 'open')
      return res.status(404).json(error('No active session'));

    // Find the most recent unexpired token
    let qr = await QRToken.findOne({
      where: {
        session_id: sessionId,
        used:       false,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [['issued_at', 'DESC']],
    });

    // If no valid token exists, generate a fresh one
    if (!qr) qr = await generateToken(sessionId, session.qr_interval);

    return res.json(success({ token: qr.token, expiresAt: qr.expires_at }));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get session with metadata ────────────────────────────────
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findByPk(sessionId);
    if (!session) return res.status(404).json(error('Session not found'));

    const cls = await Class.findByPk(session.class_id);
    const enrollmentCount = await Enrollment.count({
      where: { class_id: session.class_id },
    });

    return res.json(success({
      session: { ...session.toJSON(), class: cls, enrollmentCount },
    }));
  } catch (err) {
    console.error('GET SESSION ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get live attendance for a session ───────────────────────
exports.getLiveAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const records = await Attendance.findAll({
      where:   { session_id: sessionId },
      include: [{ association: 'student', attributes: ['id','name','email','student_id'] }],
      order:   [['marked_at', 'DESC']],
    });

    const formatted = records.map(r => ({
      id:                r.id,
      studentId:         r.student_id,
      studentName:       r.student?.name,
      studentEmail:      r.student?.email,
      studentId_display: r.student?.student_id,
      status:            r.status,
      marked_at:         r.marked_at,
    }));

    return res.json(success({ records: formatted }));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student: get active sessions for enrolled classes ────────
exports.getActiveSessions = async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { student_id: req.user.id },
    });
    const classIds = enrollments.map(e => e.class_id);

    const sessions = await Session.findAll({
      where:   { class_id: classIds, status: 'open' },
      include: [{ association: 'class', attributes: ['name', 'code'] }],
    });

    const result = sessions.map(s => ({
      id:        s.id,
      classId:   s.class_id,
      className: s.class?.name,
      title:     s.title,
      openAt:    s.open_at,
    }));

    return res.json(success({ sessions: result }));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ─── Lecturer: get all currently open sessions ────────────────
exports.getLecturerActiveSessions = async (req, res) => {
  try {
    const classes = await Class.findAll({
      where: { lecturer_id: req.user.id },
    });
    const classIds = classes.map(c => c.id);

    const sessions = await Session.findAll({
      where:   { class_id: classIds, status: 'open' },
      include: [{
        model:      Class,
        as:         'class',
        attributes: ['name', 'code'],
      }],
      order: [['open_at', 'DESC']],
    });

    // Enrich each session with live counts — queries run in parallel
    // so total time is bounded by the slowest single session, not by
    // the sum of all sessions.
    const enriched = await Promise.all(sessions.map(async s => {
      const [records, enrollmentCount] = await Promise.all([
        Attendance.findAll({ where: { session_id: s.id } }),
        Enrollment.count({  where: { class_id: s.class_id } }),
      ]);

      return {
        id:              s.id,
        title:           s.title,
        className:       s.class?.name ?? s.class_name_snapshot,
        openAt:          s.open_at,
        closeAt:         s.close_at,
        qr_interval:     s.qr_interval,
        enrollmentCount,
        present:         records.filter(r => r.status === 'present').length,
        late:            records.filter(r => r.status === 'late').length,
        total:           records.length,
      };
    }));

    return res.json(success({ sessions: enriched }));
  } catch (err) {
    console.error('GET LECTURER ACTIVE SESSIONS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};