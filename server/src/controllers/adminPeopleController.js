// server/src/controllers/adminPeopleController.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User } = require('../models');
const { audit } = require('../services/auditService');
const { newInvite, inviteLink, emailInvite } = require('../services/inviteService');
const { checkDeviceResets } = require('../services/fraudService');
const { success, error } = require('../utils/apiResponse');

/**
 * ═════════════════════════════════════════════════════════════════
 * Bulk account work for admins: CSV import with invites, bulk actions
 * on the Users table, and re-sending an invite.
 *
 * Import is two calls with the same rows: a dry run that validates
 * every row and reports problems per line, then the real import, which
 * creates only the valid rows in one transaction. Imported accounts get
 * an unusable password and a 7-day invite link to choose their own.
 * ═════════════════════════════════════════════════════════════════
 */

const IMPORT_ROLES = ['student', 'lecturer'];
const MAX_ROWS     = 2000;
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function validateRows(rows) {
  const norm = rows.map((r, i) => ({
    line:       Number(r.line) || i + 2,
    name:       String(r.name ?? '').trim(),
    email:      String(r.email ?? '').trim().toLowerCase(),
    role:       String(r.role ?? 'student').trim().toLowerCase() || 'student',
    studentId:  String(r.studentId ?? r.student_id ?? '').trim(),
    department: String(r.department ?? '').trim(),
  }));

  const emails = norm.map(r => r.email).filter(Boolean);
  const ids    = norm.filter(r => r.role === 'student').map(r => r.studentId).filter(Boolean);
  const [takenEmails, takenIds] = await Promise.all([
    emails.length ? User.findAll({ where: { email: { [Op.in]: emails } }, attributes: ['email'] }) : [],
    ids.length    ? User.findAll({ where: { student_id: { [Op.in]: ids } }, attributes: ['student_id'] }) : [],
  ]);
  const emailInDb = new Set(takenEmails.map(u => u.email));
  const idInDb    = new Set(takenIds.map(u => u.student_id));
  const seenEmail = new Set();
  const seenId    = new Set();

  return norm.map(r => {
    const errors = [];
    if (r.name.length < 2) errors.push('Name is missing');
    if (!EMAIL_RE.test(r.email)) errors.push('Email is not valid');
    else if (emailInDb.has(r.email)) errors.push('Email already has an account');
    else if (seenEmail.has(r.email)) errors.push('Email appears twice in this file');
    if (!IMPORT_ROLES.includes(r.role)) errors.push('Role must be student or lecturer');
    if (r.role === 'student') {
      if (!/^\d{10}$/.test(r.studentId)) errors.push('Student ID must be 10 digits');
      else if (idInDb.has(r.studentId)) errors.push('Student ID already registered');
      else if (seenId.has(r.studentId)) errors.push('Student ID appears twice in this file');
    }
    seenEmail.add(r.email);
    if (r.studentId) seenId.add(r.studentId);
    return { ...r, errors };
  });
}

exports.importUsers = async (req, res) => {
  try {
    const { rows, dryRun = true, sendInvites = true } = req.body ?? {};
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json(error('No rows to import'));
    if (rows.length > MAX_ROWS)
      return res.status(400).json(error(`Import at most ${MAX_ROWS} rows at a time`));

    const checked = await validateRows(rows);
    const valid   = checked.filter(r => r.errors.length === 0);
    const summary = { total: checked.length, valid: valid.length, invalid: checked.length - valid.length };

    if (dryRun) return res.json(success({ summary, rows: checked }));
    if (valid.length === 0) return res.status(400).json(error('None of the rows are valid'));

    // One unusable password for the batch: a random secret that is
    // hashed and then discarded, so nobody can sign in until they use
    // their invite (login also refuses accounts with a pending invite).
    const placeholder = await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 10);
    const invites = new Map();

    const created = await sequelize.transaction(async (transaction) => {
      const records = valid.map(r => {
        const invite = newInvite();
        invites.set(r.email, invite);
        return {
          name:              r.name,
          email:             r.email,
          password:          placeholder,
          role:              r.role,
          student_id:        r.role === 'student' ? r.studentId : null,
          department:        r.department || null,
          invite_token_hash: invite.hash,
          invite_expires_at: invite.expiresAt,
          invited_at:        new Date(),
        };
      });
      return User.bulkCreate(records, { transaction });
    });

    const result = created.map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role,
      inviteLink: inviteLink(invites.get(u.email).token),
    }));

    // Emails go out after the response; a big import shouldn't hold the request.
    if (sendInvites) {
      (async () => {
        for (let i = 0; i < created.length; i += 5) {
          await Promise.all(created.slice(i, i + 5).map(u => emailInvite(u, invites.get(u.email))));
        }
      })().catch(err => console.error('[Import] invite emails:', err.message));
    }

    const roles = created.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {});
    await audit(req, {
      action:  'users.imported',
      target:  { type: 'users', label: `${created.length} accounts` },
      summary: `Imported ${created.length} account${created.length === 1 ? '' : 's'}${summary.invalid ? `, skipped ${summary.invalid} invalid row${summary.invalid === 1 ? '' : 's'}` : ''}`,
      changes: { roles, invitesEmailed: Boolean(sendInvites) },
    });

    return res.status(201).json(success({
      summary: { ...summary, created: created.length },
      created: result,
      emailing: Boolean(sendInvites),
    }, `${created.length} account${created.length === 1 ? '' : 's'} created`));
  } catch (err) {
    console.error('[Import] failed:', err.message);
    return res.status(500).json(error('Import failed. Nothing was created.'));
  }
};

// Re-issues a pending invite (the old link stops working).
exports.resendInvite = async (req, res) => {
  try {
    const user = await User.scope('withPassword').findByPk(req.params.id);
    if (!user) return res.status(404).json(error('User not found'));
    if (!user.invite_token_hash)
      return res.status(400).json(error('This account has already been set up'));

    const invite = newInvite();
    await user.update({ invite_token_hash: invite.hash, invite_expires_at: invite.expiresAt, invited_at: new Date() });
    const emailed = await emailInvite(user, invite);
    await audit(req, {
      action: 'user.invited',
      target: { type: 'user', id: user.id, label: user.email },
      summary: `New invite link issued${emailed ? ' and emailed' : ''}`,
    });
    return res.json(success({ inviteLink: inviteLink(invite.token), emailed }, emailed ? 'Invite sent' : 'Invite link created (email failed)'));
  } catch (err) {
    console.error('[Invite] resend:', err.message);
    return res.status(500).json(error('Could not create an invite'));
  }
};

const BULK_ACTIONS = ['activate', 'deactivate', 'role', 'reset_device'];

exports.bulkUpdate = async (req, res) => {
  try {
    const { ids, action, role } = req.body ?? {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json(error('No users selected'));
    if (ids.length > 500) return res.status(400).json(error('Select at most 500 users at a time'));
    if (!BULK_ACTIONS.includes(action)) return res.status(400).json(error('Unknown action'));
    if (action === 'role' && !['student', 'lecturer', 'admin'].includes(role))
      return res.status(400).json(error('Choose a valid role'));

    // Admins can never bulk-edit their own account.
    const targetIds = ids.filter(id => id !== req.user.id);
    const users = await User.findAll({ where: { id: targetIds } });
    const io = req.app.get('io');
    let updated = 0;

    for (const user of users) {
      if (action === 'activate' && !user.is_active) {
        await user.update({ is_active: true }); updated += 1;
      } else if (action === 'deactivate' && user.is_active) {
        await user.update({ is_active: false }); updated += 1;
      } else if (action === 'role' && user.role !== role) {
        await user.update({ role }); updated += 1;
      } else if (action === 'reset_device' && user.bound_mobile_device_id) {
        await user.update({
          bound_mobile_device_id: null, mobile_device_bound_at: null,
          token_version: user.token_version + 1,
        });
        io?.to(`user:${user.id}`).emit('auth:force_logout', {
          reason: 'Your phone registration was reset by an administrator.',
        });
        await audit(req, {
          action: 'user.device_reset',
          target: { type: 'user', id: user.id, label: user.email },
          summary: 'Phone registration reset (bulk)',
        });
        await checkDeviceResets(user.id);
        updated += 1;
      }
    }

    const verb = { activate: 'Activated', deactivate: 'Deactivated', role: `Set role to ${role} for`, reset_device: 'Reset the phone of' }[action];
    await audit(req, {
      action:  'users.bulk_updated',
      target:  { type: 'users', label: `${updated} accounts` },
      summary: `${verb} ${updated} account${updated === 1 ? '' : 's'}`,
      changes: { action, role: role ?? null, ids: users.map(u => u.id) },
    });
    return res.json(success(
      { updated, skipped: ids.length - updated },
      `${verb} ${updated} account${updated === 1 ? '' : 's'}`,
    ));
  } catch (err) {
    console.error('[Bulk] failed:', err.message);
    return res.status(500).json(error('Bulk update failed'));
  }
};
