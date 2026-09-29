// server/src/services/inviteService.js
const crypto = require('crypto');
const { sendInviteEmail } = require('./emailService');

/**
 * Invite links for accounts an admin creates. The raw token only ever
 * exists in the link; the database keeps its SHA-256 hash, so a leaked
 * database can't be used to take over pending accounts.
 */
const INVITE_DAYS = 7;

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

function newInvite() {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    hash:      hashToken(token),
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  };
}

const inviteLink = (token) => `${String(process.env.CLIENT_URL ?? '').replace(/\/$/, '')}/invite/${token}`;

function emailInvite(user, invite) {
  return sendInviteEmail({
    to: user.email, name: user.name, role: user.role,
    link: inviteLink(invite.token), expiresAt: invite.expiresAt,
  });
}

module.exports = { INVITE_DAYS, hashToken, newInvite, inviteLink, emailInvite };
