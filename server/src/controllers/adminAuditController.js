// server/src/controllers/adminAuditController.js
const { ImpersonationLog, User } = require('../models');
const { success, error }         = require('../utils/apiResponse');
const { Op, literal, fn, col }   = require('sequelize');

console.log('[AuditController] Module loaded');

// ─────────────────────────────────────────────────────────────
// GET /api/admin/audit
// ─────────────────────────────────────────────────────────────
exports.getAuditLogs = async (req, res) => {
  console.log('[Audit] getAuditLogs called with query:', req.query);
  try {
    const {
      page    = 1,
      limit   = 20,
      adminId,
      status,
      from,
      to,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const where  = {};

    if (adminId)          where.admin_id  = adminId;
    if (status === 'active') where.ended_at = null;
    if (status === 'ended')  where.ended_at = { [Op.ne]: null };

    if (from || to) {
      where.started_at = {};
      if (from) where.started_at[Op.gte] = new Date(from);
      if (to)   where.started_at[Op.lte] = new Date(to);
    }

    console.log('[Audit] fetching logs with where:', where);

    // Fetch logs with admin and target user details
    const logs = await ImpersonationLog.findAll({
      where,
      limit:  Number(limit),
      offset,
      order:  [['started_at', 'DESC']],
      include: [
        { model: User, as: 'admin',      attributes: ['id', 'name', 'email'] },
        { model: User, as: 'targetUser', attributes: ['id', 'name', 'email', 'role'] },
      ],
    });

    const total = await ImpersonationLog.count({ where });

    console.log(`[Audit] found ${logs.length} logs, total ${total}`);

    const formatted = logs.map(log => {
      const plain      = log.toJSON();
      const durationMs = plain.ended_at
        ? new Date(plain.ended_at) - new Date(plain.started_at)
        : null;
      return {
        ...plain,
        durationMin: durationMs !== null ? Math.round(durationMs / 60_000) : null,
      };
    });

    return res.json(success({
      logs:       formatted,
      total,
      page:       Number(page),
      totalPages: Math.max(1, Math.ceil(total / Number(limit))),
    }));

  } catch (err) {
    console.error('[Audit] getAuditLogs error:', err.message);
    console.error('[Audit] stack:', err.stack);
    return res.status(500).json(error('Failed to load audit logs'));
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/audit/admins
// Returns admins who have ever impersonated someone.
// Uses two simple queries instead of GROUP BY to avoid Sequelize
// complexity with associations.
// ─────────────────────────────────────────────────────────────
exports.getAdminList = async (req, res) => {
  console.log('[Audit] getAdminList called');
  try {
    // Step 1: get distinct admin IDs from the log table
    const rows = await ImpersonationLog.findAll({
      attributes: ['admin_id'],
      group:      ['admin_id'],
      raw:        true,
    });

    const adminIds = rows.map(r => r.admin_id).filter(Boolean);
    console.log('[Audit] distinct admin IDs:', adminIds);

    if (adminIds.length === 0) {
      return res.json(success({ admins: [] }));
    }

    // Step 2: fetch those users
    const admins = await User.findAll({
      where:      { id: adminIds },
      attributes: ['id', 'name', 'email'],
    });

    return res.json(success({ admins: admins.map(a => a.toJSON()) }));

  } catch (err) {
    console.error('[Audit] getAdminList error:', err.message);
    console.error('[Audit] stack:', err.stack);
    return res.status(500).json(error('Failed to load admin list'));
  }
};