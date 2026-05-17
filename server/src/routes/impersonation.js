const router    = require('express').Router();
const ctrl      = require('../controllers/adminImpersonateController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * ════════════════════════════════════════════════════════════════════
 * Impersonation routes
 *
 * Why these aren't inside admin.js:
 *   admin.js applies authorize('admin') at the router level. That works
 *   for /start (admin must be an admin to begin impersonating), but it
 *   breaks /stop because during impersonation the current token's role
 *   is the TARGET user's role — usually 'student' or 'lecturer'. If
 *   /stop required admin, admins could never get out of impersonation
 *   except by waiting for the token to expire.
 *
 *   Solution: per-route guards instead of a router-level guard.
 *
 * Endpoint summary:
 *   POST /api/impersonation/start/:userId   admin → target user
 *   POST /api/impersonation/stop            anyone holding an impersonation token
 *   GET  /api/impersonation/logs            admin only — audit listing
 * ════════════════════════════════════════════════════════════════════
 */

// Start impersonation — admin only.
// authorize('admin') rejects anyone whose token role !== 'admin', which
// by definition rules out impersonation tokens (those carry the target
// user's role). So an admin currently impersonating cannot chain into
// another impersonation — they'd hit 403 here. The controller adds a
// second layer by checking req.user.impersonated_by explicitly, which
// returns a clearer 409 message.
router.post('/start/:userId',  auth, authorize('admin'), ctrl.start);

// Stop impersonation — anyone with an impersonation token.
// We deliberately do NOT apply authorize('admin') because the current
// token's role during impersonation is the target user's role. The
// controller enforces that the token must have impersonated_by set.
router.post('/stop',           auth, ctrl.stop);

// Audit log listing — admin only.
// Future audit dashboard reads from this endpoint.
router.get('/logs',            auth, authorize('admin'), ctrl.listLogs);

module.exports = router;