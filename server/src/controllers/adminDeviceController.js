// server/src/controllers/adminDeviceController.js
//
// Admin reset for account device binding.
//
// Student accounts are locked to a single device on first login. That's
// the point — it stops a student handing their credentials to a friend.
// But it also means any legitimate device change locks the student out:
// a new phone, a browser's site data cleared, a reinstall on Android.
//
// This endpoint is the escape hatch. Without it the only recovery is
// raw SQL, which isn't viable in real use.

const { User }           = require('../models');
const { success, error } = require('../utils/apiResponse');

// ─── PUT /api/admin/users/:id/reset-device ────────────────────
exports.resetUserDevice = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json(error('User not found'));

    // Nothing to do — report it rather than silently "succeeding", so the
    // admin knows the account was already free to bind on next login.
    if (!user.bound_device_id) {
      return res.status(400).json(error('This account is not bound to a device'));
    }

    const previousDevice = user.bound_device_id;

    // Clearing the binding alone isn't enough: the old device still holds
    // a valid JWT and would stay signed in until it expired (7 days).
    // Bumping token_version invalidates every token already issued for
    // this user — authenticate.js compares the claim on each request, so
    // the old device is rejected the moment it next talks to the API.
    await user.update({
      bound_device_id: null,
      device_bound_at: null,
      token_version:   user.token_version + 1,
    });

    // Belt and braces: if the old device is currently connected, push it
    // out immediately rather than waiting for its next API call. This is
    // best-effort — an offline device simply gets the 401 when it returns.
    const io = req.app.get('io');
    io?.to(`user:${user.id}`).emit('auth:force_logout', {
      reason: 'Your device registration was reset by an administrator.',
    });

    // Logged so repeated resets for one student are visible in the server
    // logs — a student asking for this every week is itself a signal.
    console.log(
      `[DeviceBind] RESET ${user.email} by admin ${req.user.id} ` +
      `(was bound to ${previousDevice}, sessions revoked)`
    );

    return res.json(success({
      user: {
        id:              user.id,
        name:            user.name,
        email:           user.email,
        role:            user.role,
        bound_device_id: null,
        device_bound_at: null,
      },
    }, 'Device reset — the old device has been signed out'));

  } catch (err) {
    console.error('[Admin] resetUserDevice error:', err);
    return res.status(500).json(error('Server error while resetting device'));
  }
};