const router    = require('express').Router();
const ctrl      = require('../controllers/adjustmentController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// All adjustment routes are lecturer-only
router.get( '/:sessionId/roster',               auth, authorize('lecturer'), ctrl.getSessionRoster);
router.get( '/:sessionId/audit',                auth, authorize('lecturer'), ctrl.getSessionAuditTrail);
router.put( '/record/:attendanceId',            auth, authorize('lecturer'), ctrl.adjustAttendance);
router.post('/:sessionId/absent/:studentId',    auth, authorize('lecturer'), ctrl.addAbsentAttendance);

module.exports = router;