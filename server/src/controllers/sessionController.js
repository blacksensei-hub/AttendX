// server/src/controllers/sessionController.js

const { notifyEnrolledStudents } = require('../services/notificationService');
const { Session, Class, Enrollment, Attendance, QRToken, User } = require('../models');
const { generateToken }          = require('../services/qrService');
const { success, error }         = require('../utils/apiResponse');
const { Op }                     = require('sequelize');
const { sendSessionOpenedEmail } = require('../services/emailService');
const { finalizeClose }          = require('../services/sessionLifecycle');

// ─── Ownership ────────────────────────────────────────────────
// The live QR token, the live roster and the session details are the
// lecturer's alone. Handing the current QR token to any signed-in user
// let a student fetch it from home and mark themselves present, which
// defeats the whole scan-in-the-room design.
async function findOwnedSession(sessionId, lecturerId) {
  const session = await Session.findByPk(sessionId);
  if (!session) return null;
  const cls = await Class.findOne({ where: { id: session.class_id, lecturer_id: lecturerId } });
  return cls ? { session, cls } : null;
}

// ─── Open session ─────────────────────────────────────────────
exports.openSession = async (req, res) => {
  try {
    const { classId, title, late_threshold, qr_interval, close_after } = req.body;

    const cls = await Class.findOne({
      where: { id: classId, lecturer_id: req.user.id },
    });
    if (!cls) return res.status(404).json(error('Class not found or unauthorized'));

    const existingOpen = await Session.findOne({
      where: { class_id: classId, status: 'open' },
    });
    if (existingOpen)
      return res.status(409).json(error('A session is already open for this class'));

    const closeAt = close_after
      ? new Date(Date.now() + close_after * 60 * 1000)
      : null;

    const session = await Session.create({
      class_id:            classId,
      title:               title || null,
      late_threshold:      late_threshold ?? 15,
      qr_interval:         qr_interval    ?? 5,
      close_at:            closeAt,
      geo_lat:             cls.geo_lat    ?? null,
      geo_lng:             cls.geo_lng    ?? null,
      geo_radius:          cls.geo_radius ?? null,
      class_name_snapshot: cls.name,
    });

    // Generate first QR token
    try {
      await generateToken(session.id, session.qr_interval);
    } catch (tokenErr) {
      console.error('[Session] generateToken error:', tokenErr);
      // Don't fail the whole request — the QR page will retry
    }

    const io = req.app.get('io');

    io?.to(`class:${classId}`).emit('session:opened', {
      sessionId: session.id,
      className: cls.name,
      title:     session.title,
    });

    // Fetch enrolled students for notifications + emails
    let enrollments = [];
    try {
      enrollments = await Enrollment.findAll({
        where:   { class_id: classId },
        include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email'] }],
      });
    } catch (enrollErr) {
      console.error('[Session] Enrollment fetch error:', enrollErr);
    }

    // In-app notifications — fire and forget
    notifyEnrolledStudents(io, classId, {
      type:    'session_opened',
      title:   '🔴 Attendance session opened',
      message: `${cls.name} has started an attendance session. Mark your attendance now!`,
      data:    { sessionId: session.id, classId, className: cls.name },
    }).catch(err => console.error('[Session] Notify error:', err.message));

    // Emails — fire and forget, and wrapped so a synchronous throw
    // inside the .map() (e.g. an undefined email function) can never
    // reach the outer try/catch and turn a successful open into a 500.
    // See: emailService.js clobber incident.
    try {
      Promise.allSettled(
        enrollments
          .filter(e => e.student)
          .map(e => sendSessionOpenedEmail({
            to:           e.student.email,
            studentName:  e.student.name,
            className:    cls.name,
            sessionTitle: session.title,
          }))
      ).catch(err => console.warn('[Session] Opened email batch failed:', err.message));
    } catch (err) {
      console.warn('[Session] Opened email batch skipped:', err.message);
    }

    // Use toJSON() to avoid Sequelize circular reference issues
    return res.status(201).json(success({ session: session.toJSON() }, 'Session opened'));

  } catch (err) {
    console.error('[Session] openSession error:', err);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Close session (manual) ───────────────────────────────────
exports.closeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findByPk(sessionId);
    if (!session) return res.status(404).json(error('Session not found'));

    const cls = await Class.findByPk(session.class_id);
    if (cls && cls.lecturer_id !== req.user.id)
      return res.status(403).json(error('Not your session'));

    await session.update({ status: 'closed', closed_at: new Date() });

    // Absences, the live-page socket event and the summary emails all
    // happen in finalizeClose, shared with auto-close and admin
    // force-close so every path records who didn't scan.
    await finalizeClose(session, { cls, io: req.app.get('io') });

    return res.json(success({ session: session.toJSON() }, 'Session closed'));
  } catch (err) {
    console.error('[Session] closeSession error:', err);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get current QR token ─────────────────────────────────────
exports.getCurrentQR = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const owned   = await findOwnedSession(sessionId, req.user.id);
    const session = owned?.session;
    if (!session || session.status !== 'open')
      return res.status(404).json(error('No active session'));

    // Only REUSE an existing token if it still has a comfortable margin of
    // life left; otherwise mint a fresh one. This buffer MUST exceed the
    // grace that qrService.generateToken bakes into every token:
    //
    //     expires_at = now + (qr_interval + 2) seconds   // 2s grace
    //
    // The lecturer's display polls for the next token at ~qr_interval, when
    // the current token still has ~2s of that grace remaining. A plain
    // `expires_at > now` check (or any buffer ≤ 2s) therefore hands the SAME
    // token back, making the code linger for two windows before rotating.
    // 3s (2s grace + ~1s poll-timing jitter) guarantees the boundary poll
    // gets a genuinely fresh token, so the QR and its code rotate each cycle.
    // (Safe for the UI's 3s minimum interval: a fresh token's life is
    // interval + 2 ≥ 5s, comfortably above this buffer.)
    const REUSE_BUFFER_MS = 3000;
    const cutoff = new Date(Date.now() + REUSE_BUFFER_MS);

    let qr = await QRToken.findOne({
      where: {
        session_id: sessionId,
        used:       false,
        expires_at: { [Op.gt]: cutoff },
      },
      order: [['issued_at', 'DESC']],
    });

    if (!qr) qr = await generateToken(sessionId, session.qr_interval);

    return res.json(success({ token: qr.token, expiresAt: qr.expires_at }));
  } catch (err) {
    console.error('[Session] getCurrentQR error:', err);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get session with metadata ────────────────────────────────
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const owned = await findOwnedSession(sessionId, req.user.id);
    if (!owned) return res.status(404).json(error('Session not found'));
    const { session, cls } = owned;

    const enrollmentCount = await Enrollment.count({
      where: { class_id: session.class_id },
    });

    return res.json(success({
      session: {
        ...session.toJSON(),
        class: cls?.toJSON() ?? null,
        enrollmentCount,
      },
    }));
  } catch (err) {
    console.error('[Session] getSession error:', err);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get live attendance for a session ───────────────────────
exports.getLiveAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!(await findOwnedSession(sessionId, req.user.id)))
      return res.status(404).json(error('Session not found'));

    const records = await Attendance.findAll({
      where:   { session_id: sessionId },
      include: [{ association: 'student', attributes: ['id', 'name', 'email', 'student_id'] }],
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
    console.error('[Session] getLiveAttendance error:', err);
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

    // One extra query rather than N — fetch every attendance row this
    // student already has for these specific open sessions, then look
    // each session up in that set below. Lets the dashboard show
    // "Attendance marked" instead of a "Mark" button the moment a scan
    // succeeds, without the client having to track that state itself
    // (which would be lost on app restart or a second device).
    const sessionIds = sessions.map(s => s.id);
    const existingMarks = sessionIds.length
      ? await Attendance.findAll({
          where: {
            // Explicit Op.in rather than relying on Sequelize's implicit
            // array-to-IN coercion — that worked inconsistently and was
            // the actual cause of a confirmed bug: a real, correctly-
            // written attendance row (verified directly in the DB) was
            // still not being matched here, leaving markedStatus null
            // and the dashboard showing "Mark" for a session the student
            // had already scanned.
            session_id: { [Op.in]: sessionIds },
            student_id: req.user.id,
          },
          attributes: ['session_id', 'status'],
        })
      : [];
    const markedBySessionId = new Map(
      existingMarks.map(a => [a.session_id, a.status])
    );


    const result = sessions.map(s => ({
      id:            s.id,
      classId:       s.class_id,
      className:     s.class?.name,
      title:         s.title,
      openAt:        s.open_at,
      // null when not yet marked; 'present' | 'late' when it has been.
      markedStatus:  markedBySessionId.get(s.id) ?? null,
    }));

    return res.json(success({ sessions: result }));
  } catch (err) {
    console.error('[Session] getActiveSessions error:', err);
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
    console.error('[Session] getLecturerActiveSessions error:', err);
    return res.status(500).json(error('Server error'));
  }
};