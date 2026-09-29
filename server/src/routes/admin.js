const router    = require('express').Router();
const ctrl      = require('../controllers/adminController');
const auth      = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const adminAtRiskController  = require('../controllers/adminAtRiskController');
const adminHeatmapController = require('../controllers/adminHeatmapController');
const adminDeviceController  = require('../controllers/adminDeviceController');
const consoleCtrl  = require('../controllers/adminConsoleController');
const auditCtrl    = require('../controllers/adminAuditController');
const peopleCtrl   = require('../controllers/adminPeopleController');
const fraudCtrl    = require('../controllers/adminFraudController');
const analyticsCtrl = require('../controllers/adminAnalyticsController');
const calendarCtrl = require('../controllers/adminCalendarController');
const annCtrl      = require('../controllers/adminAnnouncementController');

// Every admin route requires authentication AND the 'admin' role.
// The authorize middleware will return 403 for anyone who isn't an admin.
router.use(auth, authorize('admin'));

const noStore = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

// ── Console ────────────────────────────────────────────────────
router.get('/overview', noStore, consoleCtrl.overview);
router.get('/search',   consoleCtrl.search);
router.get('/ops',      noStore, consoleCtrl.ops);
router.get('/health',   noStore, consoleCtrl.health);
router.get('/settings', consoleCtrl.getSettings);
router.put('/settings', consoleCtrl.saveSettings);
router.post('/digest/test', consoleCtrl.testDigest);

// ── People ─────────────────────────────────────────────────────
router.get('/users',                   ctrl.getUsers);
router.post('/users/import',           peopleCtrl.importUsers);
router.post('/users/bulk',             peopleCtrl.bulkUpdate);
router.post('/users/:id/invite',       peopleCtrl.resendInvite);
router.put('/users/:id/toggle',        ctrl.toggleUserStatus);
router.put('/users/:id/role',          ctrl.changeUserRole);
router.put('/users/:id/reset-device',  adminDeviceController.resetUserDevice);
router.delete('/users/:id',            ctrl.deleteUser);

// ── Teaching ───────────────────────────────────────────────────
router.get('/classes',                 ctrl.getClasses);
router.get('/sessions/active',         ctrl.getActiveSessions);
router.put('/sessions/:id/close',      ctrl.forceCloseSession);
router.get('/calendar',                calendarCtrl.month);
router.post('/semesters',              calendarCtrl.saveSemester);
router.put('/semesters/:id',           calendarCtrl.saveSemester);
router.put('/semesters/:id/archive',   calendarCtrl.archiveSemester);
router.delete('/semesters/:id',        calendarCtrl.deleteSemester);
router.post('/calendar/events',        calendarCtrl.saveEvent);
router.put('/calendar/events/:id',     calendarCtrl.saveEvent);
router.delete('/calendar/events/:id',  calendarCtrl.deleteEvent);

// ── Insight ────────────────────────────────────────────────────
router.get('/analytics',               noStore, analyticsCtrl.get);
router.get('/analytics/report.pdf',    analyticsCtrl.pdf);
router.get('/heatmap',                 adminHeatmapController.getHeatmapData);
router.get('/at-risk',                 adminAtRiskController.getAtRisk);
router.post('/at-risk/notify-student/:userId/:classId',  adminAtRiskController.notifyStudent);
router.post('/at-risk/notify-lecturer/:userId/:classId', adminAtRiskController.notifyLecturer);

// ── Trust ──────────────────────────────────────────────────────
router.get('/fraud',                   noStore, fraudCtrl.list);
router.put('/fraud/:id',               fraudCtrl.review);
router.post('/fraud/sweep',            fraudCtrl.sweep);
router.get('/audit',                   noStore, auditCtrl.list);
router.get('/audit/export',            auditCtrl.exportCsv);

// ── Comms ──────────────────────────────────────────────────────
router.get('/announcements',               annCtrl.list);
router.get('/announcements/options',       annCtrl.options);
router.get('/announcements/count',         annCtrl.count);
router.post('/announcements',              annCtrl.save);
router.put('/announcements/:id',           annCtrl.save);
router.post('/announcements/:id/send',     annCtrl.send);
router.get('/announcements/:id/receipts',  annCtrl.receipts);
router.delete('/announcements/:id',        annCtrl.remove);

module.exports = router;
