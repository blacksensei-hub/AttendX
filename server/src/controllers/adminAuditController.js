// server/src/controllers/adminAuditController.js
const { Op } = require('sequelize');
const { AuditEvent } = require('../models');
const { ACTIONS } = require('../services/auditService');
const { success, error } = require('../utils/apiResponse');

// Filters shared by the list and the CSV export.
//   action   exact action, or a group prefix ending in "." ("user.")
//   actor    user id of whoever did it
//   q        free text over the summary, target and actor name
//   from/to  YYYY-MM-DD, inclusive
function buildWhere({ action, actor, targetType, targetId, q, from, to }) {
  const where = {};
  if (action) where.action = action.endsWith('.') ? { [Op.startsWith]: action } : action;
  if (actor) where.actor_id = actor;
  if (targetType) where.target_type = targetType;
  if (targetId) where.target_id = String(targetId);
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = new Date(`${from}T00:00:00Z`);
    if (to)   where.created_at[Op.lt]  = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000);
  }
  if (q) {
    const like = { [Op.iLike]: `%${q}%` };
    where[Op.or] = [{ summary: like }, { target_label: like }, { actor_name: like }];
  }
  return where;
}

exports.list = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 40));
    const { count, rows } = await AuditEvent.findAndCountAll({
      where:  buildWhere(req.query),
      order:  [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json(success({
      events:     rows,
      total:      count,
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      actions:    ACTIONS,
    }));
  } catch (err) {
    console.error('[Audit] list:', err.message);
    return res.status(500).json(error('Could not load the audit trail'));
  }
};

exports.exportCsv = async (req, res) => {
  try {
    const rows = await AuditEvent.findAll({
      where: buildWhere(req.query),
      order: [['created_at', 'DESC']],
      limit: 5000,
    });
    const { Parser } = require('json2csv');
    const csv = new Parser({
      fields: ['Time', 'Actor', 'Role', 'On behalf of', 'Action', 'Target', 'Summary', 'IP'],
    }).parse(rows.map(e => ({
      'Time':         new Date(e.created_at).toISOString(),
      'Actor':        e.actor_name ?? 'System',
      'Role':         e.actor_role ?? '',
      'On behalf of': e.on_behalf_of ?? '',
      'Action':       ACTIONS[e.action] ?? e.action,
      'Target':       e.target_label ?? e.target_id ?? '',
      'Summary':      e.summary ?? '',
      'IP':           e.ip ?? '',
    })));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendx-audit-trail.csv');
    return res.send(csv);
  } catch (err) {
    console.error('[Audit] export:', err.message);
    return res.status(500).json(error('Export failed'));
  }
};
