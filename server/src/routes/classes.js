// server/src/routes/classes.js
const router    = require('express').Router();
const ctrl      = require('../controllers/classController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/',               auth, authorize('lecturer'), ctrl.getMyClasses);
router.post('/',              auth, authorize('lecturer'), ctrl.createClass);
router.delete('/:id',         auth, authorize('lecturer'), ctrl.deleteClass);
router.get('/enrolled',       auth, authorize('student'),  ctrl.getEnrolledClasses);
router.post('/join',          auth, authorize('student'),  ctrl.joinClass);
router.get('/:id/performance',auth, authorize('lecturer'), ctrl.getClassPerformance);
router.get('/:id',            auth,                        ctrl.getClassDetail);

module.exports = router;