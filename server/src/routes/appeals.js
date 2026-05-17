const router = require('express').Router();
const ctrl   = require('../controllers/appealController');
const auth   = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Student routes
router.post('/',              auth, authorize('student'),  ctrl.submitAppeal);
router.get('/my',             auth, authorize('student'),  ctrl.getMyAppeals);

// Lecturer routes
router.get('/lecturer',       auth, authorize('lecturer'), ctrl.getLecturerAppeals);
router.put('/:appealId/review', auth, authorize('lecturer'), ctrl.reviewAppeal);
router.delete('/lecturer/all', auth, authorize('lecturer'), ctrl.deleteAllLecturerAppeals);

module.exports = router;