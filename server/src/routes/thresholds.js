const router  = require('express').Router();
const ctrl    = require('../controllers/thresholdController');
const auth    = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Lecturer routes
router.get('/at-risk',            auth, authorize('lecturer'), ctrl.getAtRiskStudents);
router.post('/send-warnings',     auth, authorize('lecturer'), ctrl.sendThresholdWarnings);
router.put('/class/:classId',     auth, authorize('lecturer'), ctrl.updateThreshold);

// Student routes
router.get('/my-rates',           auth, authorize('student'),  ctrl.getMyAttendanceRates);

module.exports = router;