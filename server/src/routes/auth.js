const router          = require('express').Router();
const authCtrl        = require('../controllers/authController');
const authenticate    = require('../middleware/authenticate');
const { loginLimiter } = require('../middleware/rateLimiters');

router.post('/register', authCtrl.register);
router.post('/login',    loginLimiter, authCtrl.login);
router.get( '/me',       authenticate, authCtrl.getMe);
router.put( '/change-password', authenticate, authCtrl.changePassword);
router.get( '/invite/:token',  loginLimiter, authCtrl.checkInvite);
router.post('/invite/:token',  loginLimiter, authCtrl.acceptInvite);

module.exports = router;