const router    = require('express').Router();
const ctrl      = require('../controllers/meController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// The signed-in user's own timetable, preferences and requests.
router.use(auth);

router.get('/timetable',     authorize('student', 'lecturer'), ctrl.timetable);
router.get('/timetable.ics', authorize('student', 'lecturer'), ctrl.downloadIcs);

router.get('/preferences',      ctrl.getPreferences);
router.put('/preferences',      ctrl.savePreferences);
router.post('/calendar-feed',   authorize('student', 'lecturer'), ctrl.rotateCalendarFeed);
router.delete('/calendar-feed', ctrl.deleteCalendarFeed);

router.get('/planner',       authorize('student'), ctrl.planner);
router.get('/semesters',     authorize('student'), ctrl.semesters);
router.get('/statement.pdf', authorize('student'), ctrl.statement);

router.get('/excuses',        authorize('student'), ctrl.listExcuses);
router.post('/excuses',       authorize('student'), ctrl.createExcuse);
router.delete('/excuses/:id', authorize('student'), ctrl.withdrawExcuse);

module.exports = router;
