// server/src/services/emailService.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || 'AttendX <onboarding@resend.dev>';

// ─── Core send helper ─────────────────────────────────────────
async function sendMail({ to, subject, html }) {
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(error.message);
    console.log(`[Email] Sent "${subject}" to ${to}`);
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
  }
}

// ─── Base HTML template ───────────────────────────────────────
function buildEmailHTML(title, bodyHTML) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 20px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#2563eb;padding:28px 32px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:rgba(255,255,255,0.2);border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;font-size:18px;font-weight:700;color:#ffffff;padding:0 10px;">A</td>
                  <td style="padding-left:12px;color:#ffffff;font-size:18px;font-weight:600;">AttendX</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:700;">${title}</h2>
                ${bodyHTML}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #f0f2f8;">
                <p style="margin:0;color:#94a3b8;font-size:12px;">
                  This email was sent by AttendX. If you did not expect it, you can safely ignore it.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

// ─── 1. Session opened ────────────────────────────────────────
async function sendSessionOpenedEmail({ to, studentName, className, sessionTitle }) {
  const title = 'Attendance session is now open';
  const body  = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi <strong>${studentName}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Your lecturer has opened an attendance session for <strong style="color:#2563eb;">${className}</strong>
      ${sessionTitle ? `— <em>${sessionTitle}</em>` : ''}. Mark your attendance now before the session closes.
    </p>
    <a href="${process.env.CLIENT_URL}/student"
       style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">
      Mark attendance →
    </a>
  `;
  await sendMail({ to, subject: `📍 Attendance open — ${className}`, html: buildEmailHTML(title, body) });
}

// ─── 2. Attendance confirmed ──────────────────────────────────
async function sendAttendanceConfirmedEmail({ to, studentName, className, status, markedAt }) {
  const title = 'Attendance confirmed';
  const formattedTime = new Date(markedAt).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const statusColor = status === 'present' ? '#10b981' : '#f59e0b';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi <strong>${studentName}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">Your attendance for <strong style="color:#2563eb;">${className}</strong> has been recorded.</p>
    <table cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:10px;padding:16px 20px;margin-bottom:20px;width:100%;">
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Status</td>
          <td style="text-align:right;"><span style="background:${statusColor}18;color:${statusColor};padding:3px 12px;border-radius:99px;font-size:13px;font-weight:700;">${statusLabel}</span></td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Class</td>
          <td style="color:#0f172a;font-size:13px;font-weight:500;text-align:right;">${className}</td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Marked at</td>
          <td style="color:#0f172a;font-size:13px;text-align:right;">${formattedTime}</td></tr>
    </table>
  `;
  await sendMail({ to, subject: `✅ Attendance recorded — ${className}`, html: buildEmailHTML(title, body) });
}

// ─── 3. Session closing soon ──────────────────────────────────
async function sendSessionClosingSoonEmail({ to, studentName, className }) {
  const title = 'Session closing in 2 minutes';
  const body  = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi <strong>${studentName}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
      The attendance session for <strong style="color:#2563eb;">${className}</strong>
      is closing in approximately <strong style="color:#ef4444;">2 minutes</strong>.
    </p>
    <a href="${process.env.CLIENT_URL}/student"
       style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">
      Mark attendance now →
    </a>
  `;
  await sendMail({ to, subject: `🚨 Last chance — ${className} closes in 2 minutes`, html: buildEmailHTML(title, body) });
}

// ─── 4. Session closed summary ────────────────────────────────
async function sendSessionClosedEmails({ className, sessionTitle, closedAt, records }) {
  const formattedTime = new Date(closedAt).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  await Promise.allSettled(records.map(record => {
    const statusColor = { present: '#10b981', late: '#f59e0b', absent: '#ef4444' }[record.status] ?? '#6b7280';
    const statusLabel = record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'Absent';
    const body = `
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi <strong>${record.studentName}</strong>,</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        The attendance session for <strong style="color:#2563eb;">${className}</strong> has now been closed.
      </p>
      <table cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:10px;padding:16px 20px;margin-bottom:20px;width:100%;">
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Your attendance status</td>
            <td style="text-align:right;"><span style="background:${statusColor}18;color:${statusColor};padding:4px 14px;border-radius:99px;font-size:13px;font-weight:700;">${statusLabel}</span></td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Class</td>
            <td style="color:#0f172a;font-size:13px;font-weight:500;text-align:right;">${className}</td></tr>
        <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Session closed at</td>
            <td style="color:#0f172a;font-size:13px;text-align:right;">${formattedTime}</td></tr>
      </table>
    `;
    return sendMail({ to: record.studentEmail, subject: `📋 Session closed — ${className} (${statusLabel})`, html: buildEmailHTML(`Session closed — ${className}`, body) });
  }));
}

// ─── 5. At-risk: student ──────────────────────────────────────
async function sendAtRiskStudentEmail({ to, studentName, className, percentage, threshold, attendedCount, totalSessions }) {
  const title = 'Your attendance needs attention';
  const body  = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi <strong>${studentName}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
      Your attendance for <strong style="color:#2563eb;">${className}</strong> has fallen below the required threshold.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:#fffaf0;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:20px;width:100%;">
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Your attendance</td>
          <td style="text-align:right;"><span style="background:#f59e0b18;color:#b45309;padding:4px 14px;border-radius:99px;font-size:14px;font-weight:700;">${percentage}%</span></td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Required threshold</td>
          <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${threshold}%</td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Sessions attended</td>
          <td style="color:#0f172a;font-size:13px;text-align:right;">${attendedCount} of ${totalSessions}</td></tr>
    </table>
  `;
  await sendMail({ to, subject: `⚠️ Attendance alert — ${className}`, html: buildEmailHTML(title, body) });
}

// ─── 6. At-risk: lecturer ─────────────────────────────────────
async function sendAtRiskLecturerEmail({ to, lecturerName, studentName, studentEmail, className, percentage, threshold, attendedCount, totalSessions }) {
  const title = 'Student at risk — intervention requested';
  const body  = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi <strong>${lecturerName}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
      A student in <strong style="color:#2563eb;">${className}</strong> has dropped below the attendance threshold.
    </p>
    <table cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:20px;width:100%;">
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Student</td>
          <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${studentName}</td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Email</td>
          <td style="text-align:right;"><a href="mailto:${studentEmail}" style="color:#2563eb;font-size:13px;">${studentEmail}</a></td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Attendance</td>
          <td style="text-align:right;"><span style="background:#ef444418;color:#b91c1c;padding:4px 14px;border-radius:99px;font-size:13px;font-weight:700;">${percentage}% (${attendedCount}/${totalSessions})</span></td></tr>
      <tr><td style="color:#64748b;font-size:13px;padding:6px 0;">Threshold</td>
          <td style="color:#0f172a;font-size:13px;text-align:right;">${threshold}%</td></tr>
    </table>
  `;
  await sendMail({ to, subject: `🚩 At-risk student — ${studentName} (${className})`, html: buildEmailHTML(title, body) });
}

// ─── 7. Announcement ─────────────────────────────────────────
async function sendAnnouncementEmail({ to, name, title, message, senderName }) {
  const body = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
    <p style="color:#374151;font-size:13px;margin:0 0 20px;color:#6b7280;">Message from <strong>${senderName}</strong> via AttendX</p>
    <div style="background:#f8faff;border-left:4px solid #7c3aed;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;color:#374151;font-size:15px;line-height:1.7;">
      ${message.replace(/\n/g, '<br/>')}
    </div>
    <a href="${process.env.CLIENT_URL}"
       style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">
      Open AttendX →
    </a>
  `;
  await sendMail({ to, subject: `📢 ${title}`, html: buildEmailHTML(title, body) });
}

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  sendSessionOpenedEmail,
  sendAttendanceConfirmedEmail,
  sendSessionClosingSoonEmail,
  sendSessionClosedEmails,
  sendAtRiskStudentEmail,
  sendAtRiskLecturerEmail,
  sendAnnouncementEmail,
};