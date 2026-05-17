const router            = require('express').Router();
const sessionController = require('../controllers/sessionController');
const auth              = require('../middleware/authenticate');
const authorize         = require('../middleware/authorize');

// ── Specific named routes FIRST ───────────────────────────────
// These must come before /:sessionId otherwise Express treats
// 'active' and 'lecturer-active' as UUID values and crashes.
router.get('/active',          auth, authorize('student'),  sessionController.getActiveSessions);
router.get('/lecturer-active', auth, authorize('lecturer'), sessionController.getLecturerActiveSessions);

// ── Create session ────────────────────────────────────────────
router.post('/', auth, authorize('lecturer'), sessionController.openSession);

// ── Wildcard /:sessionId routes LAST ─────────────────────────
router.put('/:sessionId/close',      auth, authorize('lecturer'), sessionController.closeSession);
router.get('/:sessionId/qr',         auth,                        sessionController.getCurrentQR);
router.get('/:sessionId/attendance', auth,                        sessionController.getLiveAttendance);
router.get('/:sessionId',            auth,                        sessionController.getSession);

module.exports = router;