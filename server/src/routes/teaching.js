const router    = require('express').Router();
const ctrl      = require('../controllers/teachingController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Lecturer tools. Each class-scoped handler checks the caller's role
// on that class (owner, co-lecturer, TA) itself.
router.use(auth, authorize('lecturer'));

router.get('/timetable', ctrl.timetable);

router.get('/classes/:classId',                     ctrl.classHub);
router.get('/classes/:classId/roster',              ctrl.roster);
router.get('/classes/:classId/students/:studentId', ctrl.studentDetail);

router.post(  '/classes/:classId/staff',         ctrl.addStaff);
router.patch( '/classes/:classId/staff/:userId', ctrl.updateStaff);
router.delete('/classes/:classId/staff/:userId', ctrl.removeStaff);

router.get('/excuses',            ctrl.listExcuses);
router.put('/excuses/:id/review', ctrl.reviewExcuse);

module.exports = router;
