const router       = require('express').Router();
const authCtrl     = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const rateLimit    = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max:      50,
  message:  { success: false, message: 'Too many login attempts, try again later' },
});

router.post('/register', authCtrl.register);
router.post('/login',    loginLimiter, authCtrl.login);
router.get( '/me',       authenticate, authCtrl.getMe);
router.put( '/change-password', authenticate, authCtrl.changePassword);

module.exports = router;