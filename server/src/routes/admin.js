const router    = require('express').Router();
const ctrl      = require('../controllers/adminController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const adminAtRiskController = require('../controllers/adminAtRiskController');
const adminHeatmapController = require('../controllers/adminHeatmapController');

// Every admin route requires authentication AND the 'admin' role.
// The authorize middleware will return 403 for anyone who isn't an admin.
router.use(auth, authorize('admin'));

router.get('/stats', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, ctrl.getDashboardStats);
router.get('/users',                  ctrl.getUsers);
router.put('/users/:id/toggle',       ctrl.toggleUserStatus);
router.put('/users/:id/role',         ctrl.changeUserRole);
router.delete('/users/:id',           ctrl.deleteUser);
router.get('/classes',                ctrl.getClasses);
router.get('/sessions/active',        ctrl.getActiveSessions);
router.put('/sessions/:id/close',     ctrl.forceCloseSession);
router.get('/heatmap',                adminHeatmapController.getHeatmapData);
router.get('/at-risk',                adminAtRiskController.getAtRisk);
router.post('/at-risk/notify-student/:userId/:classId',  adminAtRiskController.notifyStudent);
router.post('/at-risk/notify-lecturer/:userId/:classId', adminAtRiskController.notifyLecturer);

module.exports = router;