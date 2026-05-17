const router    = require('express').Router();
const ctrl      = require('../controllers/scheduleController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Get all schedules for a class + create new one
router.get( '/class/:classId', auth, authorize('lecturer'), ctrl.getClassSchedules);
router.post('/class/:classId', auth, authorize('lecturer'), ctrl.createSchedule);

// Modify or delete individual schedule entries
router.put(   '/:scheduleId',        auth, authorize('lecturer'), ctrl.updateSchedule);
router.delete('/:scheduleId',        auth, authorize('lecturer'), ctrl.deleteSchedule);
router.put(   '/:scheduleId/toggle', auth, authorize('lecturer'), ctrl.toggleSchedule);

module.exports = router;