const { Class, Session, Attendance, Enrollment, User } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { QueryTypes }     = require('sequelize');
const nodemailer         = require('nodemailer');

// ─── Nodemailer transporter ───────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ─── Escape user-supplied text before embedding in email HTML ─
// Lecturers are trusted, but escaping keeps a stray < or & from
// breaking the markup, and avoids any HTML injection in the email.
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Get at-risk students for all of a lecturer's classes ─────
exports.getAtRiskStudents = async (req, res) => {
  try {
    const { sequelize } = require('../models');

    const atRisk = await sequelize.query(`
      SELECT
        c.id                   AS "classId",
        c.name                 AS "className",
        c.code                 AS "classCode",
        c.attendance_threshold AS "threshold",
        u.id                   AS "studentId",
        u.name                 AS "studentName",
        u.email                AS "studentEmail",
        u.student_id           AS "studentIdDisplay",

        COUNT(DISTINCT s.id)
          FILTER (WHERE s.status = 'closed')         AS "totalSessions",

        COUNT(DISTINCT a.session_id)
          FILTER (WHERE a.status IN ('present','late')) AS "attended",

        CASE
          WHEN COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed') = 0
          THEN 0
          ELSE ROUND(
            COUNT(DISTINCT a.session_id)
              FILTER (WHERE a.status IN ('present','late'))
            * 100.0
            / COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed')
          )
        END                    AS "attendanceRate"

      FROM classes    c
      INNER JOIN enrollments e ON e.class_id   = c.id
      INNER JOIN users       u ON u.id          = e.student_id
      LEFT  JOIN sessions    s ON s.class_id   = c.id
      LEFT  JOIN attendance  a ON a.session_id  = s.id
                               AND a.student_id = u.id

      WHERE c.lecturer_id = :lecturerId

      GROUP BY
        c.id, c.name, c.code, c.attendance_threshold,
        u.id, u.name, u.email, u.student_id

      HAVING
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed') > 0
        AND ROUND(
          COUNT(DISTINCT a.session_id)
            FILTER (WHERE a.status IN ('present','late'))
          * 100.0
          / COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed')
        ) < c.attendance_threshold

      ORDER BY c.name, "attendanceRate" ASC
    `, {
      replacements: { lecturerId: req.user.id },
      type:         QueryTypes.SELECT,
    });

    // Group rows by class so the frontend can render per-class lists
    const grouped = atRisk.reduce((acc, row) => {
      if (!acc[row.classId]) {
        acc[row.classId] = {
          classId:   row.classId,
          className: row.className,
          classCode: row.classCode,
          threshold: parseInt(row.threshold),
          students:  [],
        };
      }
      acc[row.classId].students.push({
        studentId:        row.studentId,
        studentName:      row.studentName,
        studentEmail:     row.studentEmail,
        studentIdDisplay: row.studentIdDisplay,
        totalSessions:    parseInt(row.totalSessions),
        attended:         parseInt(row.attended),
        attendanceRate:   parseInt(row.attendanceRate),
      });
      return acc;
    }, {});

    const classes     = Object.values(grouped);
    const totalAtRisk = atRisk.length;

    return res.json(success({ classes, totalAtRisk }));
  } catch (err) {
    console.error('GET AT RISK ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get a student's own attendance rate per class ────────────
exports.getMyAttendanceRates = async (req, res) => {
  try {
    const { sequelize } = require('../models');

    const rates = await sequelize.query(`
      SELECT
        c.id                   AS "classId",
        c.name                 AS "className",
        c.attendance_threshold AS "threshold",

        COUNT(DISTINCT s.id)
          FILTER (WHERE s.status = 'closed')           AS "totalSessions",

        COUNT(DISTINCT a.session_id)
          FILTER (WHERE a.status IN ('present','late')) AS "attended",

        CASE
          WHEN COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed') = 0
          THEN NULL
          ELSE ROUND(
            COUNT(DISTINCT a.session_id)
              FILTER (WHERE a.status IN ('present','late'))
            * 100.0
            / COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed')
          )
        END                    AS "attendanceRate"

      FROM enrollments e
      INNER JOIN classes    c ON c.id          = e.class_id
      LEFT  JOIN sessions   s ON s.class_id    = c.id
      LEFT  JOIN attendance a ON a.session_id  = s.id
                              AND a.student_id = e.student_id

      WHERE e.student_id = :studentId

      GROUP BY c.id, c.name, c.attendance_threshold
      ORDER BY c.name
    `, {
      replacements: { studentId: req.user.id },
      type:         QueryTypes.SELECT,
    });

    const formatted = rates.map(r => {
      const threshold      = parseInt(r.threshold) || 75;
      const attendanceRate = r.attendanceRate !== null
        ? parseInt(r.attendanceRate)
        : null;

      return {
        classId:        r.classId,
        className:      r.className,
        threshold,
        totalSessions:  parseInt(r.totalSessions),
        attended:       parseInt(r.attended),
        attendanceRate,
        atRisk:         attendanceRate !== null && attendanceRate < threshold,
      };
    });

    return res.json(success({ rates: formatted }));
  } catch (err) {
    console.error('GET MY RATES ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Send warning emails to all at-risk students in a class ───
exports.sendThresholdWarnings = async (req, res) => {
  try {
    const { classId, customMessage } = req.body;
    const { sequelize } = require('../models');

    if (!classId)
      return res.status(400).json(error('classId is required'));

    // Optional lecturer note. Trim and treat blank as "use the template".
    const personalNote =
      typeof customMessage === 'string' ? customMessage.trim() : '';

    // Verify the class belongs to this lecturer and fetch the threshold.
    // attendance_threshold is now defined on the Class model so it will
    // always be present. We fall back to 75 as a safety net in case the
    // column is somehow null in the database.
    const cls = await Class.findOne({
      where: { id: classId, lecturer_id: req.user.id },
    });
    if (!cls)
      return res.status(404).json(error('Class not found or unauthorized'));

    const threshold = cls.attendance_threshold ?? 75;

    // Find all enrolled students whose attendance is below the threshold
    const atRisk = await sequelize.query(`
      SELECT
        u.name  AS "studentName",
        u.email AS "studentEmail",

        COUNT(DISTINCT s.id)
          FILTER (WHERE s.status = 'closed')           AS "totalSessions",

        COUNT(DISTINCT a.session_id)
          FILTER (WHERE a.status IN ('present','late')) AS "attended",

        ROUND(
          COUNT(DISTINCT a.session_id)
            FILTER (WHERE a.status IN ('present','late'))
          * 100.0
          / NULLIF(
              COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed'),
              0
            )
        ) AS "attendanceRate"

      FROM enrollments e
      INNER JOIN users       u ON u.id         = e.student_id
      LEFT  JOIN sessions    s ON s.class_id   = e.class_id
      LEFT  JOIN attendance  a ON a.session_id = s.id
                              AND a.student_id = u.id

      WHERE e.class_id = :classId

      GROUP BY u.id, u.name, u.email

      HAVING
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed') > 0
        AND ROUND(
          COUNT(DISTINCT a.session_id)
            FILTER (WHERE a.status IN ('present','late'))
          * 100.0
          / NULLIF(
              COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed'),
              0
            )
        ) < :threshold
    `, {
      // Using a local variable for threshold — never reads it from the model
      // inline so we are guaranteed it is always a defined integer value.
      replacements: { classId, threshold },
      type:         QueryTypes.SELECT,
    });

    if (atRisk.length === 0)
      return res.json(success({ sent: 0 }, 'No at-risk students to notify'));

    // Send all emails in parallel — allSettled means one failed address
    // never prevents the rest from receiving their warning.
    const results = await Promise.allSettled(
      atRisk.map(student =>
        sendThresholdWarningEmail({
          to:             student.studentEmail,
          studentName:    student.studentName,
          className:      cls.name,
          attendanceRate: parseInt(student.attendanceRate),
          threshold,
          totalSessions:  parseInt(student.totalSessions),
          attended:       parseInt(student.attended),
          customMessage:  personalNote || null,
        })
      )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return res.json(success(
      { sent, failed },
      `Warning emails sent to ${sent} student${sent !== 1 ? 's' : ''}`
    ));
  } catch (err) {
    console.error('SEND WARNINGS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Update attendance threshold for a class ──────────────────
exports.updateThreshold = async (req, res) => {
  try {
    const { classId }   = req.params;
    const { threshold } = req.body;

    const val = parseInt(threshold);
    if (!val || val < 1 || val > 100)
      return res.status(400).json(error('Threshold must be between 1 and 100'));

    const cls = await Class.findOne({
      where: { id: classId, lecturer_id: req.user.id },
    });
    if (!cls)
      return res.status(404).json(error('Class not found or unauthorized'));

    await cls.update({ attendance_threshold: val });

    return res.json(success({ threshold: val }, 'Threshold updated'));
  } catch (err) {
    console.error('UPDATE THRESHOLD ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Threshold warning email ──────────────────────────────────
async function sendThresholdWarningEmail({
  to, studentName, className, attendanceRate, threshold,
  totalSessions, attended, customMessage,
}) {
  const sessionsNeeded = Math.max(
    0,
    Math.ceil((threshold / 100 * totalSessions) - attended)
  );

  // When the lecturer provides a personal note, show it in a quote block
  // in place of the generic warning paragraph. Otherwise use the template.
  const introBlock = customMessage
    ? `
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px;">
          Hi <strong>${escapeHtml(studentName)}</strong>,
        </p>
        <p style="color:#6b7280;font-size:13px;margin:0 0 12px;">
          A message from your lecturer regarding
          <strong style="color:#2563eb;">${escapeHtml(className)}</strong>:
        </p>
        <div style="background:#f8faff;border-left:4px solid #2563eb;
                    border-radius:0 10px 10px 0;padding:16px 20px;margin:0 0 20px;
                    color:#374151;font-size:15px;line-height:1.7;">
          ${escapeHtml(customMessage).replace(/\n/g, '<br/>')}
        </div>
      `
    : `
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
          Hi <strong>${escapeHtml(studentName)}</strong>,<br><br>
          Your attendance for
          <strong style="color:#2563eb;">${escapeHtml(className)}</strong>
          has dropped below the minimum required level.
          Immediate action is needed.
        </p>
      `;

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

            <!-- Red header -->
            <tr>
              <td style="background:#ef4444;padding:28px 32px;">
                <span style="color:#fff;font-size:18px;font-weight:600;">
                  ⚠️ AttendX — Attendance Warning
                </span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 16px;color:#0f172a;
                            font-size:20px;font-weight:700;">
                  Your attendance is below the required threshold
                </h2>

                ${introBlock}

                <!-- Stats card -->
                <table cellpadding="0" cellspacing="0"
                       style="background:#fef2f2;border-radius:10px;
                              padding:16px 20px;margin-bottom:20px;
                              width:100%;border:1px solid #fecaca;">
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:6px 0;">
                      Your attendance rate
                    </td>
                    <td style="text-align:right;">
                      <span style="background:#ef444418;color:#ef4444;
                                    padding:4px 14px;border-radius:99px;
                                    font-size:16px;font-weight:700;">
                        ${attendanceRate}%
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:6px 0;">
                      Required minimum
                    </td>
                    <td style="color:#0f172a;font-size:13px;
                                font-weight:600;text-align:right;">
                      ${threshold}%
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:6px 0;">
                      Sessions attended
                    </td>
                    <td style="color:#0f172a;font-size:13px;text-align:right;">
                      ${attended} of ${totalSessions}
                    </td>
                  </tr>
                </table>

                <!-- Action prompt -->
                <p style="color:#ef4444;font-size:14px;
                           background:#fef2f2;
                           border-left:3px solid #ef4444;
                           padding:10px 14px;
                           border-radius:0 6px 6px 0;margin:0 0 16px;">
                  You need to attend at least
                  <strong>
                    ${sessionsNeeded} more session${sessionsNeeded !== 1 ? 's' : ''}
                  </strong>
                  consecutively to bring your rate back above ${threshold}%.
                </p>

                <p style="color:#64748b;font-size:13px;margin:0;">
                  If you believe this is an error or have extenuating circumstances,
                  please contact your lecturer as soon as possible. You can also
                  submit an attendance appeal through the AttendX platform.
                </p>
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

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `⚠️ Attendance warning — ${className} (${attendanceRate}%)`,
    html,
  });
}