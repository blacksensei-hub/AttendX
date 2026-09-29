// server/src/services/digestService.js
const { Op } = require('sequelize');
const { User, FraudFlag, Announcement, Attendance } = require('../models');
const metrics  = require('./metricsService');
const settings = require('./settingsService');
const { resolveRange } = require('./calendarService');
const { sendDigestEmail } = require('./emailService');
const { beat } = require('./opsFeed');

/**
 * ═════════════════════════════════════════════════════════════════
 * The weekly admin digest: last week's numbers in one email.
 *
 * A poller checks every five minutes whether it is the configured day
 * and hour and the digest hasn't gone out today, so a restart during
 * that hour can't send it twice. Admins can also send themselves a
 * copy from the settings page.
 * ═════════════════════════════════════════════════════════════════
 */

async function buildDigest() {
  const to   = new Date();
  const from = new Date(to.getTime() - 7 * 86_400_000);
  const week = { from, to };
  const prev = { from: new Date(from.getTime() - 7 * 86_400_000), to: from };

  const [now, before, classes, semester] = await Promise.all([
    metrics.overall(week),
    metrics.overall(prev),
    metrics.perClass(week),
    resolveRange({}),
  ]);
  const atRisk = await metrics.atRisk(semester);

  let flags = { high: 0, medium: 0, low: 0 };
  let sentAnnouncements = 0;
  try {
    const open = await FraudFlag.findAll({ where: { status: 'open' }, attributes: ['severity'] });
    for (const f of open) flags[f.severity] = (flags[f.severity] ?? 0) + 1;
    sentAnnouncements = await Announcement.count({ where: { status: 'sent', sent_at: { [Op.gte]: from } } });
  } catch { /* admin console tables not migrated yet */ }

  const [scans, newUsers] = await Promise.all([
    // Absences are rows too (written when a session closes); scans are not.
    Attendance.count({ where: { marked_at: { [Op.gte]: from }, status: ['present', 'late'] } }),
    User.count({ where: { created_at: { [Op.gte]: from } } }),
  ]);

  const delta = now.rate - before.rate;
  const lowest = classes.filter(c => c.sessions > 0).sort((a, b) => a.rate - b.rate).slice(0, 3);
  const fmtDay = d => d.toUTCString().slice(5, 11);

  return {
    periodLabel: `${fmtDay(from)} to ${fmtDay(to)}`,
    sections: [
      { heading: 'Attendance', rows: [
        ['Attendance rate', `${now.rate}% (${delta >= 0 ? '+' : ''}${Math.round(delta * 10) / 10} pts on the week before)`],
        ['Sessions held', String(now.sessions)],
        ['Scans recorded', String(scans)],
      ] },
      { heading: 'Needs attention', rows: [
        [`Students at risk (${semester.label})`, String(metrics.distinctStudents(atRisk))],
        ['Open fraud flags', `${flags.high} high, ${flags.medium} medium, ${flags.low} low`],
        ...lowest.map(c => [`Lowest: ${c.name}`, `${c.rate}%`]),
      ] },
      { heading: 'Activity', rows: [
        ['New accounts', String(newUsers)],
        ['Announcements sent', String(sentAnnouncements)],
      ] },
    ],
  };
}

async function sendDigest({ onlyTo } = {}) {
  const digest = await buildDigest();
  const admins = onlyTo
    ? [onlyTo]
    : await User.findAll({ where: { role: 'admin', is_active: true }, attributes: ['name', 'email'] });
  let sent = 0;
  for (const a of admins) {
    if (await sendDigestEmail({ to: a.email, name: a.name, ...digest })) sent += 1;
  }
  if (!onlyTo) await settings.setInternal('digest.last_sent_at', new Date().toISOString()).catch(() => {});
  return { sent, recipients: admins.length, periodLabel: digest.periodLabel };
}

function startDigestScheduler() {
  setInterval(async () => {
    beat('digest');
    try {
      const all = await settings.loadAll();
      if (!all['digest.enabled']) return;
      const now = new Date();
      if (now.getDay() !== all['digest.weekday'] || now.getHours() !== all['digest.hour']) return;
      const last = await settings.getInternal('digest.last_sent_at');
      if (last && new Date(last).toDateString() === now.toDateString()) return;
      const result = await sendDigest();
      console.log(`[Digest] sent to ${result.sent}/${result.recipients} admins`);
    } catch (err) {
      console.error('[Digest] scheduler:', err.message);
    }
  }, 5 * 60_000);
}

module.exports = { buildDigest, sendDigest, startDigestScheduler };
