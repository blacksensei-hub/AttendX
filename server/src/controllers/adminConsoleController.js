// server/src/controllers/adminConsoleController.js
const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, User, Class, Session, Attendance, Enrollment, AuditEvent, FraudFlag,
} = require('../models');
const metrics  = require('../services/metricsService');
const settings = require('../services/settingsService');
const { resolveRange } = require('../services/calendarService');
const { sendDigest } = require('../services/digestService');
const { heartbeats, startedAt } = require('../services/opsFeed');
const { emailStats } = require('../services/emailService');
const { audit } = require('../services/auditService');
const { success, error } = require('../utils/apiResponse');

/**
 * ═════════════════════════════════════════════════════════════════
 * The admin console's shared endpoints: the overview, policy
 * settings, the ⌘K search, the live operations snapshot and the
 * system health check.
 * ═════════════════════════════════════════════════════════════════
 */

// Tables added by server/sql/2026-09-27_admin_console.sql. The health
// check reports any that are missing, i.e. the migration hasn't run.
const MIGRATION_TABLES = [
  'audit_events', 'institution_settings', 'semesters', 'calendar_events',
  'scan_attempts', 'fraud_flags', 'announcements', 'announcement_receipts',
];

const safe = (p, fallback) => p.catch(() => fallback);

// ── Overview ────────────────────────────────────────────────────
exports.overview = async (req, res) => {
  try {
    const range = await resolveRange({});
    const [overall, trend, atRisk, counts, live, recent, flags, pendingInvites] = await Promise.all([
      metrics.overall(range),
      metrics.weeklyTrend(range),
      metrics.atRisk(range, { limit: 1000 }),
      Promise.all([
        User.count({ where: { role: 'student', is_active: true } }),
        User.count({ where: { role: 'lecturer', is_active: true } }),
        Class.count({ where: { is_active: true } }),
      ]),
      Session.findAll({
        where: { status: 'open' },
        include: [{ model: Class, as: 'class', attributes: ['id', 'name', 'code'],
          include: [{ model: User, as: 'lecturer', attributes: ['name'] }] }],
        order: [['open_at', 'DESC']],
        limit: 6,
      }),
      safe(AuditEvent.findAll({ order: [['created_at', 'DESC']], limit: 8 }), []),
      safe(FraudFlag.findAll({
        where: { status: 'open' },
        attributes: ['severity', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
        group: ['severity'], raw: true,
      }), []),
      safe(User.count({ where: { invite_token_hash: { [Op.ne]: null } } }), 0),
    ]);

    const liveIds = live.map(s => s.id);
    const marked = liveIds.length ? await Attendance.findAll({
      where: { session_id: liveIds },
      attributes: ['session_id', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      group: ['session_id'], raw: true,
    }) : [];
    const enrolled = live.length ? await Enrollment.findAll({
      where: { class_id: live.map(s => s.class_id).filter(Boolean) },
      attributes: ['class_id', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      group: ['class_id'], raw: true,
    }) : [];

    const openFlags = { high: 0, medium: 0, low: 0 };
    for (const f of flags) openFlags[f.severity] = Number(f.n);

    return res.json(success({
      range: { label: range.label },
      kpis: {
        rate:           overall.rate,
        sessions:       overall.sessions,
        atRisk:         metrics.distinctStudents(atRisk),
        students:       counts[0],
        lecturers:      counts[1],
        classes:        counts[2],
        liveSessions:   live.length,
        openFlags,
        pendingInvites,
      },
      trend: trend.slice(-12),
      live: live.map(s => ({
        id: s.id, title: s.title, openAt: s.open_at,
        className: s.class?.name ?? s.class_name_snapshot, code: s.class?.code ?? null,
        lecturer: s.class?.lecturer?.name ?? null,
        marked:   Number(marked.find(m => m.session_id === s.id)?.n ?? 0),
        enrolled: Number(enrolled.find(e => e.class_id === s.class_id)?.n ?? 0),
      })),
      recent,
    }));
  } catch (err) {
    console.error('[Overview] failed:', err.message);
    return res.status(500).json(error('Could not load the overview'));
  }
};

// ── Policy settings ─────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const [values, lastDigest] = await Promise.all([settings.loadAll(), settings.getInternal('digest.last_sent_at')]);
    const schema = Object.fromEntries(Object.entries(settings.SCHEMA).map(([k, s]) => [k, { ...s }]));
    return res.json(success({ schema, values, digest: { lastSentAt: lastDigest } }));
  } catch (err) {
    return res.status(500).json(error('Could not load settings'));
  }
};

exports.saveSettings = async (req, res) => {
  try {
    const changed = await settings.setMany(req.body?.values ?? {}, req.user.id);
    if (changed.length) {
      await audit(req, {
        action:  'settings.updated',
        target:  { type: 'settings', label: 'Policy settings' },
        summary: changed.map(([k, a, b]) => `${settings.SCHEMA[k].label}: ${a} → ${b}`).join('; '),
        changes: Object.fromEntries(changed.map(([k, a, b]) => [k, [a, b]])),
      });
    }
    return res.json(success({ values: await settings.loadAll(), changed: changed.length },
      changed.length ? 'Settings saved' : 'Nothing changed'));
  } catch (err) {
    return res.status(400).json(error(err.message || 'Could not save settings'));
  }
};

exports.testDigest = async (req, res) => {
  try {
    const me = await User.findByPk(req.user.id, { attributes: ['name', 'email'] });
    const result = await sendDigest({ onlyTo: me });
    if (!result.sent) return res.status(502).json(error('The digest could not be emailed. Check the email settings on the Health page.'));
    await audit(req, { action: 'digest.sent', target: { type: 'digest', label: me.email }, summary: `Test digest for ${result.periodLabel} sent to ${me.email}` });
    return res.json(success(result, `Sent to ${me.email}`));
  } catch (err) {
    console.error('[Digest] test:', err.message);
    return res.status(500).json(error('Could not build the digest'));
  }
};

// ── ⌘K search ───────────────────────────────────────────────────
exports.search = async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json(success({ users: [], classes: [], sessions: [] }));
    const like = { [Op.iLike]: `%${q}%` };
    const [users, classes, sessions] = await Promise.all([
      User.findAll({
        where: { [Op.or]: [{ name: like }, { email: like }, { student_id: like }] },
        attributes: ['id', 'name', 'email', 'role', 'student_id', 'is_active', 'bound_mobile_device_id'],
        limit: 6, order: [['name', 'ASC']],
      }),
      Class.findAll({
        where: { [Op.or]: [{ name: like }, { code: like }, { department: like }] },
        attributes: ['id', 'name', 'code', 'department'],
        limit: 5, order: [['name', 'ASC']],
      }),
      Session.findAll({
        where: { [Op.or]: [{ title: like }, { class_name_snapshot: like }] },
        attributes: ['id', 'title', 'class_name_snapshot', 'status', 'open_at'],
        limit: 5, order: [['open_at', 'DESC']],
      }),
    ]);
    return res.json(success({ users, classes, sessions }));
  } catch (err) {
    return res.status(500).json(error('Search failed'));
  }
};

// ── Live operations snapshot ────────────────────────────────────
// The wall loads this once, then stays current from socket events.
exports.ops = async (req, res) => {
  try {
    const since = new Date(Date.now() - 60 * 60_000);
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);

    const [open, perMinute, today, flags] = await Promise.all([
      sequelize.query(`
        SELECT s.id, s.title, s.open_at AS "openAt", s.close_at AS "closeAt",
               COALESCE(c.name, s.class_name_snapshot) AS "className", c.code,
               c.location_name AS "location", u.name AS lecturer,
               (SELECT count(*) FROM attendance a WHERE a.session_id = s.id)::int AS marked,
               (SELECT count(*) FROM enrollments e WHERE e.class_id = s.class_id)::int AS enrolled
        FROM sessions s
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN users   u ON u.id = c.lecturer_id
        WHERE s.status = 'open'
        ORDER BY s.open_at DESC
      `, { type: QueryTypes.SELECT }),
      sequelize.query(`
        SELECT date_trunc('minute', marked_at) AS minute, count(*)::int AS scans
        FROM attendance
        WHERE marked_at >= :since AND status IN ('present', 'late')
        GROUP BY 1 ORDER BY 1
      `, { replacements: { since }, type: QueryTypes.SELECT }),
      sequelize.query(`
        SELECT count(*)::int AS scans,
               count(*) FILTER (WHERE status = 'late')::int AS late,
               (SELECT count(*) FROM sessions WHERE open_at >= :dayStart)::int AS sessions
        FROM attendance
        WHERE marked_at >= :dayStart AND status IN ('present', 'late')
      `, { replacements: { dayStart }, type: QueryTypes.SELECT }),
      safe(FraudFlag.count({ where: { status: 'open' } }), 0),
    ]);

    return res.json(success({ open, perMinute, today: today[0], openFlags: flags }));
  } catch (err) {
    console.error('[Ops] snapshot:', err.message);
    return res.status(500).json(error('Could not load live operations'));
  }
};

// ── Health ──────────────────────────────────────────────────────
exports.health = async (req, res) => {
  const t0 = Date.now();
  let db = { ok: false, latencyMs: null, missingTables: MIGRATION_TABLES };
  try {
    // pg_tables, not information_schema: Sequelize rewrites any query
    // starting "SELECT table_name FROM information_schema.tables" into
    // bare arrays (it treats it as a SHOW TABLES).
    const rows = await sequelize.query(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename IN (:names)`,
      { replacements: { names: MIGRATION_TABLES }, type: QueryTypes.SELECT },
    );
    const present = new Set(rows.map(r => r.tablename));
    db = { ok: true, latencyMs: Date.now() - t0, missingTables: MIGRATION_TABLES.filter(t => !present.has(t)) };
  } catch (err) {
    db.error = err.message;
  }

  const io = req.app.get('io');
  const mem = process.memoryUsage();
  return res.json(success({
    api: {
      uptimeSec: Math.round(process.uptime()),
      startedAt,
      node:      process.version,
      env:       process.env.NODE_ENV ?? 'development',
      memoryMb:  Math.round(mem.rss / 1048576),
    },
    db,
    jobs:    heartbeats(),
    sockets: { connected: io?.engine?.clientsCount ?? 0 },
    email:   emailStats(),
  }));
};
