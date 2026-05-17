const jwt                       = require('jsonwebtoken');
const { User, ImpersonationLog } = require('../models');
const { success, error }        = require('../utils/apiResponse');

/**
 * ════════════════════════════════════════════════════════════════════
 * Admin Impersonation Controller
 *
 * Three actions:
 *   • start  — admin → target user. Issues an impersonation token that
 *              carries impersonated_by + impersonation_id claims so any
 *              downstream controller can recognize the elevated context.
 *
 *   • stop   — anyone holding an impersonation token. Reads the
 *              impersonated_by claim, fetches the admin, fills in the
 *              audit log's ended_at, and issues a fresh admin token.
 *
 *   • listLogs — admin only. Powers the audit dashboard.
 *
 * Token lifecycle:
 *
 *   normal admin token ──[start]──> impersonation token ──[stop]──> fresh admin token
 *                                          │
 *                                          ├─ token expires naturally
 *                                          │  → 401 → /login (audit log left
 *                                          │    with null ended_at; cleanup job
 *                                          │    can backfill later)
 *                                          │
 *                                          └─ admin closes browser → on return,
 *                                             persisted state still shows
 *                                             impersonation; banner is visible;
 *                                             admin clicks "Stop" to recover
 *
 * Why we don't trust the client to "remember" the original admin token:
 *   The clean way is server-controlled. The impersonation token's
 *   impersonated_by claim is the source of truth for "who was the admin".
 *   On stop we look that up server-side and issue a brand new admin
 *   token. That way:
 *     • the original token's expiry doesn't matter
 *     • the admin can stop impersonating after any duration as long as
 *       their account still exists and is active
 *     • the client never holds two valid tokens at once
 * ════════════════════════════════════════════════════════════════════
 */

// ─── Start impersonation ──────────────────────────────────────────────
exports.start = async (req, res) => {
  try {
    // Block chained impersonation — admins must stop their current
    // impersonation before starting a new one. This keeps the audit
    // log clean (one row per session) and prevents nested-token
    // confusion that would be a nightmare to debug.
    if (req.user.impersonated_by) {
      return res.status(409).json(error(
        'You are already impersonating someone. Stop the current session first.'
      ));
    }

    const { userId } = req.params;
    const { reason } = req.body || {};

    // No-op: cannot impersonate self. Not strictly dangerous, just
    // pointless and would create a confusing log entry.
    if (userId === req.user.id) {
      return res.status(400).json(error('You cannot impersonate yourself.'));
    }

    const target = await User.findByPk(userId);
    if (!target) {
      return res.status(404).json(error('User not found'));
    }
    if (!target.is_active) {
      return res.status(400).json(error(
        'Cannot impersonate a deactivated user.'
      ));
    }
    // Hard rule: admins cannot impersonate other admins. This blocks
    // the privilege-escalation chain where compromising one admin
    // account would let the attacker silently act as any other admin.
    if (target.role === 'admin') {
      return res.status(403).json(error(
        'Cannot impersonate another admin.'
      ));
    }

    // Create the audit log row first — we need its id to embed in the
    // JWT so every subsequent request during this session can be
    // attributed back to the originating impersonation event.
    const log = await ImpersonationLog.create({
      admin_id:       req.user.id,
      target_user_id: target.id,
      started_at:     new Date(),
      reason:         reason || null,
      ip:             req.ip,
      user_agent:     req.get('user-agent') || null,
    });

    // Sign the impersonation token. It carries the TARGET user's id
    // and role (so all normal controllers behave as if the target user
    // is logged in) plus two extra claims that authenticate.js exposes
    // as req.user.impersonated_by and req.user.impersonation_id.
    const token = jwt.sign(
      {
        id:               target.id,
        role:             target.role,
        impersonated_by:  req.user.id,
        impersonation_id: log.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Fetch the admin user so the client can render "[admin] is viewing
    // as [target]" in the impersonation banner without a second API call.
    const admin = await User.findByPk(req.user.id);

    return res.json(success({
      user: {
        id:         target.id,
        name:       target.name,
        email:      target.email,
        role:       target.role,
        avatar_url: target.avatar_url,
      },
      token,
      originalUser: {
        id:         admin.id,
        name:       admin.name,
        email:      admin.email,
        role:       admin.role,
        avatar_url: admin.avatar_url,
      },
      impersonationId: log.id,
    }, `Now viewing as ${target.name}.`));

  } catch (err) {
    console.error('Impersonation start error:', err);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Stop impersonation ───────────────────────────────────────────────
exports.stop = async (req, res) => {
  try {
    // Reject if the current token is not an impersonation token. This
    // can only happen if a client calls /stop while not impersonating —
    // either a UI bug or a misuse of the endpoint. Returning 400 makes
    // it obvious to the caller what went wrong.
    if (!req.user.impersonated_by) {
      return res.status(400).json(error(
        'You are not currently impersonating anyone.'
      ));
    }

    const adminId = req.user.impersonated_by;
    const logId   = req.user.impersonation_id;

    // Fill in ended_at on the audit row. We do this BEFORE issuing the
    // new admin token so that if the token-issue step fails for some
    // reason (e.g. JWT_SECRET rotated), the log still reflects that
    // the impersonation has ended, which is the safer default for
    // audit purposes.
    if (logId) {
      await ImpersonationLog.update(
        { ended_at: new Date() },
        { where: { id: logId } }
      );
    }

    // Look up the admin. Edge cases handled:
    //   • Admin account was deleted while impersonating — bail.
    //   • Admin account was deactivated while impersonating — bail.
    // In either case the user has to log in afresh; they can't return
    // to an account that no longer exists or has been suspended.
    const admin = await User.findByPk(adminId);
    if (!admin) {
      return res.status(404).json(error(
        'Admin account no longer exists. Please log in again.'
      ));
    }
    if (!admin.is_active) {
      return res.status(403).json(error(
        'Admin account is deactivated. Please log in again.'
      ));
    }

    // Issue a fresh, normal admin token — no impersonated_by claim.
    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.json(success({
      user: {
        id:         admin.id,
        name:       admin.name,
        email:      admin.email,
        role:       admin.role,
        avatar_url: admin.avatar_url,
      },
      token,
    }, 'Returned to your admin account.'));

  } catch (err) {
    console.error('Impersonation stop error:', err);
    return res.status(500).json(error('Server error'));
  }
};

// ─── List impersonation logs ──────────────────────────────────────────
// Powers the future audit dashboard. Sorted newest-first; capped at 100
// rows per request so the payload stays small. Pagination can be added
// when row count makes it worth the effort.
exports.listLogs = async (req, res) => {
  try {
    const logs = await ImpersonationLog.findAll({
      include: [
        { model: User, as: 'admin',      attributes: ['id', 'name', 'email'] },
        { model: User, as: 'targetUser', attributes: ['id', 'name', 'email', 'role'] },
      ],
      order: [['started_at', 'DESC']],
      limit: 100,
    });
    return res.json(success({ logs }));
  } catch (err) {
    console.error('Impersonation listLogs error:', err);
    return res.status(500).json(error('Server error'));
  }
};