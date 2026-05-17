const router    = require('express').Router();
const ctrl      = require('../controllers/attendanceController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.post('/mark', auth, authorize('student'), ctrl.markAttendance);

module.exports = router;