const jwt = require('jsonwebtoken');
const { error } = require('../utils/apiResponse');

/**
 * ════════════════════════════════════════════════════════════════════
 * authenticate — verifies the JWT in the Authorization header and
 * populates req.user with the decoded payload.
 *
 * Token shapes we may see:
 *   Normal user:    { id, role }
 *   Impersonation:  { id, role, impersonated_by, impersonation_id }
 *
 * The impersonation fields are added by the impersonation controller
 * when an admin starts viewing the system as another user. They flow
 * through the same authenticate middleware as a normal token; downstream
 * controllers can opt into impersonation-aware behavior by checking
 * req.isImpersonating (convenience flag) or req.user.impersonated_by.
 * ════════════════════════════════════════════════════════════════════
 */
module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json(error('No token provided'));
  }

  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    // Convenience flag — saves controllers from doing
    //   if (req.user.impersonated_by) { ... }
    // every time they want to apply different rules during impersonation.
    req.isImpersonating = Boolean(decoded.impersonated_by);
    next();
  } catch (err) {
    return res.status(401).json(error('Token is invalid or expired'));
  }
};