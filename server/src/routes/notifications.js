const router = require('express').Router();
const ctrl   = require('../controllers/notificationController');
const auth   = require('../middleware/authenticate');

router.get('/',           auth, ctrl.getNotifications);
router.put('/read-all',   auth, ctrl.markAllRead);
router.put('/:id/read',   auth, ctrl.markRead);
router.delete('/',        auth, ctrl.clearAll);

module.exports = router;