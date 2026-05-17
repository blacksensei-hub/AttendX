const { error } = require('../utils/apiResponse');

// Usage: authorize('lecturer')  OR  authorize('lecturer', 'admin')
module.exports = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json(error('Access denied: insufficient role'));
  }
  next();
};