const router    = require('express').Router();
const ctrl      = require('../controllers/reportController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/dashboard',      auth, authorize('lecturer'), ctrl.getDashboardStats);
router.get('/student-stats',  auth, authorize('student'),  ctrl.getStudentStats);
router.get('/summary/:classId', auth, authorize('lecturer'), ctrl.getClassSummary);
router.get('/export/csv',     auth, authorize('lecturer'), ctrl.exportCSV);
router.get('/export/pdf',     auth, authorize('lecturer'), ctrl.exportPDF);
router.get('/student-history', auth, authorize('student'), ctrl.getStudentHistory);
router.delete('/student-history', auth, authorize('student'), ctrl.clearStudentHistory);
router.get('/student-history/export/csv', auth, authorize('student'), ctrl.exportStudentHistoryCSV);
router.get('/all-sessions', auth, authorize('lecturer'), ctrl.getAllSessions);
router.delete('/session/:sessionId', auth, authorize('lecturer'), ctrl.deleteSessionReport);

module.exports = router;