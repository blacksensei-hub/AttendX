const {
  Attendance, AttendanceAdjustment, Session,
  Class, User, Enrollment,
} = require('../models');
const { success, error } = require('../utils/apiResponse');
const { QueryTypes }     = require('sequelize');

// ─── Adjust a student's attendance status ─────────────────────
// The lecturer picks a new status and provides a mandatory reason.
// Every change is permanently logged in attendance_adjustments so
// there is a full audit trail of who changed what and why.
exports.adjustAttendance = async (req, res) => {
  try {
    const { attendanceId }        = req.params;
    const { newStatus, reason }   = req.body;

    if (!['present', 'late', 'absent'].includes(newStatus))
      return res.status(400).json(error('Status must be present, late, or absent'));

    if (!reason?.trim())
      return res.status(400).json(error('A reason is required for manual adjustments'));

    const attendance = await Attendance.findByPk(attendanceId);
    if (!attendance)
      return res.status(404).json(error('Attendance record not found'));

    // Verify the session belongs to one of this lecturer's classes
    const session = await Session.findByPk(attendance.session_id);
    const cls     = await Class.findOne({
      where: { id: session?.class_id, lecturer_id: req.user.id },
    });
    if (!cls)
      return res.status(403).json(error('Not authorized to adjust this record'));

    // No point adjusting if the status isn't changing
    if (attendance.status === newStatus)
      return res.status(400).json(error(`Student is already marked ${newStatus}`));

    const oldStatus = attendance.status;

    // Update the attendance record
    await attendance.update({ status: newStatus });

    // Write an immutable audit log entry
    await AttendanceAdjustment.create({
      attendance_id: attendanceId,
      session_id:    attendance.session_id,
      student_id:    attendance.student_id,
      adjusted_by:   req.user.id,
      old_status:    oldStatus,
      new_status:    newStatus,
      reason:        reason.trim(),
    });

    return res.json(success(
      { attendance },
      `Attendance updated from ${oldStatus} to ${newStatus}`
    ));
  } catch (err) {
    console.error('ADJUST ATTENDANCE ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Mark absent student as attending ────────────────────────
// A student who was absent has no attendance record at all.
// This endpoint creates one and logs the adjustment.
exports.addAbsentAttendance = async (req, res) => {
  try {
    const { sessionId, studentId } = req.params;
    const { newStatus, reason }    = req.body;

    if (!['present', 'late'].includes(newStatus))
      return res.status(400).json(error('Status must be present or late'));

    if (!reason?.trim())
      return res.status(400).json(error('A reason is required for manual adjustments'));

    // Verify session belongs to this lecturer
    const session = await Session.findByPk(sessionId);
    const cls     = await Class.findOne({
      where: { id: session?.class_id, lecturer_id: req.user.id },
    });
    if (!cls)
      return res.status(403).json(error('Not authorized to adjust this record'));

    // Prevent creating a duplicate if the student already has a record
    const existing = await Attendance.findOne({
      where: { session_id: sessionId, student_id: studentId },
    });
    if (existing)
      return res.status(409).json(error('Student already has an attendance record — use the edit button instead'));

    // Verify the student is enrolled
    const enrolled = await Enrollment.findOne({
      where: { student_id: studentId, class_id: session.class_id },
    });
    if (!enrolled)
      return res.status(403).json(error('Student is not enrolled in this class'));

    const attendance = await Attendance.create({
      session_id: sessionId,
      student_id: studentId,
      status:     newStatus,
      ip_address: null,
      device_id:  null,
    });

    // Log the adjustment — old_status is 'absent' since no record existed
    await AttendanceAdjustment.create({
      attendance_id: attendance.id,
      session_id:    sessionId,
      student_id:    studentId,
      adjusted_by:   req.user.id,
      old_status:    'absent',
      new_status:    newStatus,
      reason:        reason.trim(),
    });

    return res.json(success(
      { attendance },
      `Student marked as ${newStatus}`
    ));
  } catch (err) {
    console.error('ADD ABSENT ATTENDANCE ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get audit trail for a session ───────────────────────────
// Returns the full history of every manual adjustment made to any
// student's attendance in a given session, newest first.
exports.getSessionAuditTrail = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sequelize } = require('../models');

    // Verify this session belongs to the lecturer
    const session = await Session.findByPk(sessionId);
    const cls     = await Class.findOne({
      where: { id: session?.class_id, lecturer_id: req.user.id },
    });
    if (!cls)
      return res.status(403).json(error('Not authorized'));

    const trail = await sequelize.query(`
      SELECT
        aa.id,
        aa.old_status  AS "oldStatus",
        aa.new_status  AS "newStatus",
        aa.reason,
        aa.created_at  AS "adjustedAt",

        -- Student who was adjusted
        s.id           AS "student.id",
        s.name         AS "student.name",
        s.email        AS "student.email",
        s.student_id   AS "student.studentId",

        -- Lecturer who made the adjustment
        l.id           AS "adjustedBy.id",
        l.name         AS "adjustedBy.name"

      FROM attendance_adjustments aa
      INNER JOIN users s ON s.id = aa.student_id
      INNER JOIN users l ON l.id = aa.adjusted_by

      WHERE aa.session_id = :sessionId

      ORDER BY aa.created_at DESC
    `, {
      replacements: { sessionId },
      type:         QueryTypes.SELECT,
      nest:         true,
    });

    return res.json(success({ trail }));
  } catch (err) {
    console.error('GET AUDIT TRAIL ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get full attendance list for a session ───────────────────
// Returns every enrolled student with their current status and
// whether their record was manually adjusted. Used by the
// lecturer's adjustment UI to show the full session roster.
exports.getSessionRoster = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { sequelize } = require('../models');

    // Verify this session belongs to the lecturer
    const session = await Session.findByPk(sessionId);
    const cls     = await Class.findOne({
      where: { id: session?.class_id, lecturer_id: req.user.id },
    });
    if (!cls)
      return res.status(403).json(error('Not authorized'));

    // Join enrollments → users → attendance so every enrolled student
    // appears even if they were absent (no attendance record).
    const roster = await sequelize.query(`
      SELECT
        u.id          AS "studentId",
        u.name        AS "studentName",
        u.email       AS "studentEmail",
        u.student_id  AS "studentIdDisplay",
        a.id          AS "attendanceId",
        COALESCE(a.status, 'absent') AS status,
        a.marked_at   AS "markedAt",

        -- Flag whether this record was manually adjusted
        EXISTS (
          SELECT 1 FROM attendance_adjustments aa
          WHERE aa.attendance_id = a.id
        ) AS "wasAdjusted"

      FROM enrollments e
      INNER JOIN users      u ON u.id         = e.student_id
      LEFT  JOIN attendance a ON a.session_id = :sessionId
                              AND a.student_id = u.id

      WHERE e.class_id = :classId

      ORDER BY u.name ASC
    `, {
      replacements: { sessionId, classId: session.class_id },
      type:         QueryTypes.SELECT,
    });

    return res.json(success({
      roster,
      session: {
        id:        session.id,
        title:     session.title,
        className: session.class_name_snapshot ?? cls.name,
        openAt:    session.open_at,
        status:    session.status,
      },
    }));
  } catch (err) {
    console.error('GET SESSION ROSTER ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};