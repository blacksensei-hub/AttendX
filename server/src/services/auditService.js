// server/src/services/auditService.js
const { AuditEvent, User } = require('../models');

/**
 * ═════════════════════════════════════════════════════════════════
 * The audit trail: one row per sensitive action.
 *
 *   await audit(req, {
 *     action:  'user.role_changed',
 *     target:  { type: 'user', id: user.id, label: user.email },
 *     summary: 'Changed role from student to lecturer',
 *     changes: { role: ['student', 'lecturer'] },   // [before, after]
 *   });
 *
 * Who did it comes from the request. During a "view as" session the
 * token belongs to the impersonated user, so the admin behind it is
 * recorded in on_behalf_of. Names are snapshotted so the trail stays
 * readable after an account is deleted.
 *
 * Recording must never break the action being recorded: every error
 * is caught and logged, and the caller carries on.
 * ═════════════════════════════════════════════════════════════════
 */

// Stable action names, grouped for the audit page filters.
const ACTIONS = {
  'user.activated':          'Account activated',
  'user.deactivated':        'Account deactivated',
  'user.role_changed':       'Role changed',
  'user.deleted':            'Account deleted',
  'user.device_reset':       'Phone registration reset',
  'user.invited':            'Invite sent',
  'users.imported':          'Users imported',
  'users.bulk_updated':      'Bulk update',
  'impersonation.started':   'View as started',
  'impersonation.stopped':   'View as ended',
  'session.force_closed':    'Session force-closed',
  'session.report_deleted':  'Session report deleted',
  'attendance.adjusted':     'Attendance adjusted',
  'appeal.reviewed':         'Appeal reviewed',
  'class.deleted':           'Class deleted',
  'settings.updated':        'Policy settings changed',
  'semester.saved':          'Semester saved',
  'semester.archived':       'Semester archived',
  'semester.deleted':        'Semester deleted',
  'calendar.saved':          'Calendar event saved',
  'calendar.deleted':        'Calendar event deleted',
  'announcement.saved':      'Announcement saved',
  'announcement.sent':       'Announcement sent',
  'announcement.deleted':    'Announcement deleted',
  'fraud.reviewed':          'Fraud flag reviewed',
  'digest.sent':             'Weekly digest sent',
};

const nameCache = new Map();
async function actorSnapshot(id) {
  if (!id) return null;
  if (nameCache.has(id)) return nameCache.get(id);
  const user = await User.findByPk(id, { attributes: ['id', 'name', 'role'] });
  const snap = user ? { name: user.name, role: user.role } : null;
  if (nameCache.size > 500) nameCache.clear();
  nameCache.set(id, snap);
  return snap;
}

async function audit(req, { action, target = {}, summary = null, changes = null, actorId } = {}) {
  try {
    const id    = actorId ?? req?.user?.id ?? null;
    const actor = await actorSnapshot(id);
    await AuditEvent.create({
      actor_id:     id,
      actor_name:   actor?.name ?? null,
      actor_role:   actor?.role ?? req?.user?.role ?? null,
      on_behalf_of: req?.user?.impersonated_by ?? null,
      action,
      target_type:  target.type  ?? null,
      target_id:    target.id != null ? String(target.id) : null,
      target_label: target.label ? String(target.label).slice(0, 200) : null,
      summary,
      changes,
      ip:           req?.ip ?? null,
    });
  } catch (err) {
    console.warn(`[Audit] could not record ${action}:`, err.message);
  }
}

module.exports = { audit, ACTIONS };
