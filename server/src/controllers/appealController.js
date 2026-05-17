const { Appeal, Session, Attendance, Enrollment, User, Class } = require('../models');
const { success, error } = require('../utils/apiResponse');
const nodemailer         = require('nodemailer');

// ─── Nodemailer transporter ───────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Student: submit an appeal ────────────────────────────────
exports.submitAppeal = async (req, res) => {
  try {
    const { sessionId, reason } = req.body;
    const studentId = req.user.id;

    if (!reason?.trim())
      return res.status(400).json(error('Please provide a reason for your appeal'));

    const session = await Session.findByPk(sessionId);
    if (!session)
      return res.status(404).json(error('Session not found'));

    if (session.status === 'open')
      return res.status(400).json(error('Cannot appeal an active session'));

    const enrolled = await Enrollment.findOne({
      where: { student_id: studentId, class_id: session.class_id },
    });
    if (!enrolled)
      return res.status(403).json(error('You were not enrolled in this class'));

    const existing = await Appeal.findOne({
      where: { student_id: studentId, session_id: sessionId },
    });
    if (existing)
      return res.status(409).json(error('You have already submitted an appeal for this session'));

    const attendance = await Attendance.findOne({
      where: { student_id: studentId, session_id: sessionId },
    });

    if (attendance?.status === 'present')
      return res.status(400).json(error('You are already marked present for this session'));

    const appeal = await Appeal.create({
      student_id:    studentId,
      session_id:    sessionId,
      attendance_id: attendance?.id ?? null,
      reason:        reason.trim(),
    });

    return res.status(201).json(success({ appeal }, 'Appeal submitted successfully'));
  } catch (err) {
    console.error('SUBMIT APPEAL ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student: get their own appeals ──────────────────────────
exports.getMyAppeals = async (req, res) => {
  try {
    const appeals = await Appeal.findAll({
      where: { student_id: req.user.id },
      include: [{
        model:      Session,
        as:         'session',
        foreignKey: 'session_id',
        attributes: ['id', 'title', 'class_name_snapshot', 'open_at', 'status'],
      }],
      order: [['created_at', 'DESC']],
    });

    return res.json(success({ appeals }));
  } catch (err) {
    console.error('GET MY APPEALS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Lecturer: get all appeals for their classes ──────────────
// Uses raw SQL because Sequelize's association inference was incorrectly
// joining appeals → appeals instead of appeals → users regardless of
// how associations were declared. Raw SQL is the only reliable fix.
exports.getLecturerAppeals = async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const { QueryTypes } = require('sequelize');

    const appeals = await sequelize.query(`
      SELECT
        a.id,
        a.student_id,
        a.session_id,
        a.attendance_id,
        a.reason,
        a.status,
        a.lecturer_note,
        a.reviewed_at,
        a.reviewed_by,
        a.created_at,
        a.updated_at,

        u.id          AS "student.id",
        u.name        AS "student.name",
        u.email       AS "student.email",
        u.student_id  AS "student.student_id",

        s.id                  AS "session.id",
        s.title               AS "session.title",
        s.class_name_snapshot AS "session.class_name_snapshot",
        s.open_at             AS "session.open_at",
        s.class_id            AS "session.class_id"

      FROM appeals a
      INNER JOIN users    u ON u.id = a.student_id
      INNER JOIN sessions s ON s.id = a.session_id
      INNER JOIN classes  c ON c.id = s.class_id

      WHERE c.lecturer_id = :lecturerId

      ORDER BY
        CASE a.status WHEN 'pending' THEN 0 ELSE 1 END ASC,
        a.created_at DESC
    `, {
      replacements: { lecturerId: req.user.id },
      type:         QueryTypes.SELECT,
      nest:         true,
    });

    const pendingCount = appeals.filter(a => a.status === 'pending').length;

    return res.json(success({ appeals, pendingCount }));
  } catch (err) {
    console.error('GET LECTURER APPEALS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Lecturer: approve or reject an appeal ───────────────────
// When approving, the lecturer explicitly chooses whether to mark
// the student as 'present' or 'late' — we never assume present.
// The chosen status is sent from the frontend alongside the decision.
exports.reviewAppeal = async (req, res) => {
  try {
    const { appealId }                          = req.params;
    const { decision, status, lecturer_note }   = req.body;

    if (!['approved', 'rejected'].includes(decision))
      return res.status(400).json(error('Decision must be "approved" or "rejected"'));

    // When approving, the lecturer must pick present or late explicitly.
    // We reject the request if this is missing so the frontend is forced
    // to always provide a deliberate choice rather than falling back silently.
    if (decision === 'approved' && !['present', 'late'].includes(status))
      return res.status(400).json(error('Approval requires a status of "present" or "late"'));

    const appeal = await Appeal.findByPk(appealId, {
      include: [
        {
          model:      User,
          as:         'student',
          foreignKey: 'student_id',
          attributes: ['id', 'name', 'email'],
        },
        {
          model:      Session,
          as:         'session',
          foreignKey: 'session_id',
          attributes: ['id', 'title', 'class_name_snapshot', 'class_id'],
        },
      ],
    });
    if (!appeal)
      return res.status(404).json(error('Appeal not found'));

    // Verify this appeal belongs to one of the requesting lecturer's classes
    const cls = await Class.findOne({
      where: { id: appeal.session.class_id, lecturer_id: req.user.id },
    });
    if (!cls)
      return res.status(403).json(error('Not authorized to review this appeal'));

    // Prevent double-reviewing an already reviewed appeal
    if (appeal.status !== 'pending')
      return res.status(400).json(error('This appeal has already been reviewed'));

    await appeal.update({
      status:        decision,
      lecturer_note: lecturer_note?.trim() || null,
      reviewed_at:   new Date(),
      reviewed_by:   req.user.id,
    });

    // If approved — update or create the attendance record using the
    // lecturer's explicitly chosen status (present or late)
    if (decision === 'approved') {
      if (appeal.attendance_id) {
        // Student already had an attendance record (e.g. was late) —
        // update it to the lecturer's chosen status
        await Attendance.update(
          { status },
          { where: { id: appeal.attendance_id } }
        );
      } else {
        // Student was fully absent — create a brand new attendance record
        // with the lecturer's chosen status
        await Attendance.create({
          session_id: appeal.session_id,
          student_id: appeal.student_id,
          status,
          ip_address: null,
          device_id:  null,
        });
      }
    }

    // Email the student the outcome — fire and forget so it never blocks
    sendAppealOutcomeEmail({
      to:             appeal.student.email,
      studentName:    appeal.student.name,
      className:      appeal.session.class_name_snapshot ?? 'your class',
      sessionTitle:   appeal.session.title,
      decision,
      approvedStatus: status,
      lecturerNote:   lecturer_note,
    }).catch(err =>
      console.error('[Email] Appeal outcome error:', err.message)
    );

    return res.json(success({ appeal }, `Appeal ${decision} successfully`));
  } catch (err) {
    console.error('REVIEW APPEAL ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Lecturer: delete all appeals for their classes ───────────
exports.deleteAllLecturerAppeals = async (req, res) => {
  try {
    const { sequelize } = require('../models');
    const { QueryTypes } = require('sequelize');

    const appealRows = await sequelize.query(`
      SELECT a.id
      FROM appeals a
      INNER JOIN sessions s ON s.id = a.session_id
      INNER JOIN classes  c ON c.id = s.class_id
      WHERE c.lecturer_id = :lecturerId
    `, {
      replacements: { lecturerId: req.user.id },
      type:         QueryTypes.SELECT,
    });

    if (appealRows.length === 0)
      return res.json(success({ deleted: 0 }, 'No appeals to delete'));

    const ids = appealRows.map(a => a.id);

    const deleted = await Appeal.destroy({ where: { id: ids } });

    return res.json(success(
      { deleted },
      `${deleted} appeal${deleted !== 1 ? 's' : ''} deleted`
    ));
  } catch (err) {
    console.error('DELETE ALL APPEALS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Appeal outcome email ─────────────────────────────────────
async function sendAppealOutcomeEmail({
  to, studentName, className, sessionTitle,
  decision, approvedStatus, lecturerNote,
}) {
  const approved     = decision === 'approved';
  const color        = approved ? '#10b981' : '#ef4444';
  const label        = approved ? 'Approved ✅' : 'Rejected ❌';
  const statusColor  = approvedStatus === 'present' ? '#10b981' : '#f59e0b';
  const subject      = approved
    ? `✅ Appeal approved — ${className}`
    : `❌ Appeal rejected — ${className}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f4f6fb;
                 font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#f4f6fb;padding:40px 20px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:560px;background:#fff;border-radius:16px;
                        overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td style="background:#2563eb;padding:28px 32px;">
                <span style="color:#fff;font-size:18px;font-weight:600;">
                  AttendX
                </span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 16px;color:#0f172a;
                            font-size:20px;font-weight:700;">
                  Attendance appeal outcome
                </h2>
                <p style="color:#374151;font-size:15px;
                           line-height:1.6;margin:0 0 20px;">
                  Hi <strong>${studentName}</strong>,<br><br>
                  Your attendance appeal for
                  <strong style="color:#2563eb;">${className}</strong>
                  ${sessionTitle ? `(${sessionTitle})` : ''}
                  has been reviewed.
                </p>

                <!-- Summary card -->
                <table cellpadding="0" cellspacing="0"
                       style="background:#f8faff;border-radius:10px;
                              padding:16px 20px;margin-bottom:20px;width:100%;">
                  <!-- Decision row -->
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:6px 0;">
                      Decision
                    </td>
                    <td style="text-align:right;">
                      <span style="background:${color}18;color:${color};
                                    padding:4px 14px;border-radius:99px;
                                    font-size:13px;font-weight:700;">
                        ${label}
                      </span>
                    </td>
                  </tr>

                  <!-- New attendance status row — only shown when approved -->
                  ${approved && approvedStatus ? `
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:6px 0;">
                      New attendance status
                    </td>
                    <td style="text-align:right;">
                      <span style="background:${statusColor}18;color:${statusColor};
                                    padding:3px 12px;border-radius:99px;
                                    font-size:13px;font-weight:700;
                                    text-transform:capitalize;">
                        ${approvedStatus}
                      </span>
                    </td>
                  </tr>
                  ` : ''}

                  <!-- Lecturer note row — only shown when provided -->
                  ${lecturerNote ? `
                  <tr>
                    <td colspan="2" style="padding-top:12px;">
                      <p style="color:#64748b;font-size:12px;
                                 text-transform:uppercase;margin:0 0 4px;">
                        Lecturer's note
                      </p>
                      <p style="color:#374151;font-size:14px;
                                 background:#fff;border-radius:8px;
                                 padding:10px 12px;
                                 border:1px solid #e2e8f0;margin:0;">
                        ${lecturerNote}
                      </p>
                    </td>
                  </tr>
                  ` : ''}
                </table>

                <!-- Outcome message -->
                ${approved ? `
                <p style="color:#10b981;font-size:14px;
                           background:#f0fdf4;
                           border-left:3px solid #10b981;
                           padding:10px 14px;
                           border-radius:0 6px 6px 0;margin:0;">
                  Your attendance has been updated to
                  <strong style="text-transform:capitalize;">
                    ${approvedStatus}
                  </strong>.
                  This change is now reflected in your attendance history.
                </p>
                ` : `
                <p style="color:#64748b;font-size:14px;margin:0;">
                  Your attendance status remains unchanged.
                  If you have further questions, please speak with
                  your lecturer directly.
                </p>
                `}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #f0f2f8;">
                <p style="margin:0;color:#94a3b8;font-size:12px;">
                  This email was sent by AttendX.
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`[Email] Appeal outcome sent to ${to}`);
  } catch (err) {
    console.error(`[Email] Failed to send appeal outcome to ${to}:`, err.message);
  }
}