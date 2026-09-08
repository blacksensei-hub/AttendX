const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { error } = require('../utils/apiResponse');

/**
 * ════════════════════════════════════════════════════════════════════
 * authenticate — verifies the JWT in the Authorization header and
 * populates req.user with the decoded payload.
 *
 * Token shapes we may see:
 *   Normal user:    { id, role, token_version }
 *   Impersonation:  { id, role, token_version, impersonated_by, impersonation_id }
 *
 * The impersonation fields are added by the impersonation controller
 * when an admin starts viewing the system as another user. They flow
 * through the same authenticate middleware as a normal token; downstream
 * controllers can opt into impersonation-aware behavior by checking
 * req.isImpersonating (convenience flag) or req.user.impersonated_by.
 *
 * ── Why this hits the database ──────────────────────────────────────
 * JWTs are stateless: once signed, the server cannot un-issue one. It
 * stays valid until it expires (7 days here). That's a problem when an
 * admin resets a student's device binding — without a check, the old
 * device would keep working for a week, which defeats the reset.
 *
 * So every user row carries a token_version. It's embedded in the token
 * at sign time and compared here on every request. Bumping the column
 * invalidates every token already issued for that user, instantly.
 *
 * The cost is one primary-key lookup per authenticated request. That's
 * a millisecond or so and buys real revocation; the alternative is a
 * token that cannot be withdrawn.
 *
 * The same lookup also lets deactivation take effect immediately rather
 * than whenever the user's token happens to expire.
 * ════════════════════════════════════════════════════════════════════
 */
module.exports = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json(error('No token provided'));
  }

  const token = auth.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json(error('Token is invalid or expired'));
  }

  try {
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'is_active', 'token_version'],
    });

    // Account deleted while the token was still alive.
    if (!user) {
      return res.status(401).json(error('Account no longer exists'));
    }

    // Deactivated accounts lose access on their next request rather
    // than lingering until token expiry.
    if (!user.is_active) {
      return res.status(403).json(error('Account deactivated'));
    }

    // The revocation check. A mismatch means the session was
    // deliberately ended server-side — a device reset, most commonly.
    //
    // Tokens issued before token_version existed carry no such claim,
    // so they fail this comparison and are rejected. That's intended:
    // everyone is signed out once when this ships, then normal service
    // resumes.
    if (decoded.token_version !== user.token_version) {
      return res.status(401).json(error(
        'Your session has ended. Please sign in again.'
      ));
    }

    req.user = decoded;
    // Convenience flag — saves controllers from doing
    //   if (req.user.impersonated_by) { ... }
    // every time they want to apply different rules during impersonation.
    req.isImpersonating = Boolean(decoded.impersonated_by);
    return next();

  } catch (err) {
    console.error('[authenticate] lookup failed:', err.message);
    return res.status(500).json(error('Server error during authentication'));
  }
};