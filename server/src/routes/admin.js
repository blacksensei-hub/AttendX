// server/src/routes/admin.js
const router    = require('express').Router();
const ctrl      = require('../controllers/adminController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const adminAtRiskController       = require('../controllers/adminAtRiskController');
const adminHeatmapController      = require('../controllers/adminHeatmapController');
const adminAnnouncementController = require('../controllers/adminAnnouncementController');
const adminAuditController        = require('../controllers/adminAuditController');
const adminAnalyticsController    = require('../controllers/adminAnalyticsController');

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
router.get('/announcements/preview',  adminAnnouncementController.previewAnnouncement);
router.post('/announcements',         adminAnnouncementController.sendAnnouncement);
router.get('/audit/admins',           adminAuditController.getAdminList);
router.get('/audit',                  adminAuditController.getAuditLogs);
router.get('/analytics',              adminAnalyticsController.getAnalytics);

module.exports = router;