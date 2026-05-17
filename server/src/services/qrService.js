const { v4: uuidv4 } = require('uuid');
const crypto         = require('crypto');
const { QRToken }    = require('../models');
const { Op }         = require('sequelize');

/**
 * Generate a new QR token for a session.
 * Invalidates (marks expired) all previous tokens for this session.
 */
async function generateToken(sessionId, intervalSeconds = 5) {
  // Expire all existing tokens for this session
  await QRToken.update(
    { expires_at: new Date() },   // Set expiry to now = expired
    { where: { session_id: sessionId, used: false, expires_at: { [Op.gt]: new Date() } } }
  );

  // Create new token: random hex + session prefix for fast lookup
  const raw   = crypto.randomBytes(32).toString('hex');
  const token = `${sessionId.slice(0, 8)}.${raw}`;

  const expiresAt = new Date(Date.now() + (intervalSeconds + 2) * 1000); // +2s grace

  const qr = await QRToken.create({
    session_id: sessionId,
    token,
    expires_at: expiresAt,
  });

  return qr;
}

/**
 * Validate a token submitted by a student.
 * Returns { valid: boolean, reason?: string }
 */
async function validateToken(token, sessionId) {
  const qr = await QRToken.findOne({ where: { token } });

  if (!qr)                              return { valid: false, reason: 'QR code not recognised' };
  if (qr.session_id !== sessionId)      return { valid: false, reason: 'QR code is for a different session' };
  if (qr.used)                          return { valid: false, reason: 'QR code has already been used' };
  if (new Date() > new Date(qr.expires_at)) return { valid: false, reason: 'QR code has expired — scan the new one' };

  return { valid: true, qr };
}

module.exports = { generateToken, validateToken };