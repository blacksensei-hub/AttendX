// server/src/controllers/adminDeviceController.js
//
// Admin reset for a student's mobile device binding.
//
// Student accounts are locked to one phone for the MOBILE app on first
// sign-in. That's the point — it stops a student handing their credentials
// to a friend's phone to mark attendance for them. Web sign-ins carry no
// binding at all: the website can't mark attendance, and a localStorage id
// is trivially cleared anyway, so locking it only ever inconvenienced
// legitimate users.
//
// But the mobile lock means any legitimate phone change locks the student
// out: a new handset, a reinstall on Android, cleared app storage. This
// endpoint is the escape hatch — without it the only recovery is raw SQL,
// which isn't viable in real use.

const { User }           = require('../models');
const { success, error } = require('../utils/apiResponse');

// --- PUT /api/admin/users/:id/reset-device ---
exports.resetUserDevice = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json(error('User not found'));

    // Nothing to do -- report it rather than silently "succeeding", so the
    // admin knows the account was already free to bind on next sign-in.
    if (!user.bound_mobile_device_id) {
      return res.status(400).json(error('This account has no phone registered'));
    }

    const previousDevice = user.bound_mobile_device_id;

    // Clearing the binding alone isn't enough: the old phone still holds a
    // valid JWT and would stay signed in until it expired (7 days).
    // Bumping token_version invalidates every token already issued for
    // this user -- authenticate.js compares the claim on each request, so
    // the old device is rejected the moment it next talks to the API.
    await user.update({
      bound_mobile_device_id: null,
      mobile_device_bound_at: null,
      token_version: user.token_version + 1,
    });

    // Belt and braces: if the old phone is currently connected, push it
    // out immediately rather than waiting for its next API call. This is
    // best-effort -- an offline device simply gets the 401 when it returns.
    const io = req.app.get('io');
    io?.to(`user:${user.id}`).emit('auth:force_logout', {
      reason: 'Your phone registration was reset by an administrator.',
    });

    // Logged so repeated resets for one student are visible in the server
    // logs -- a student asking for this every week is itself a signal.
    console.log(
      `[DeviceBind] RESET ${user.email} (mobile) by admin ${req.user.id} ` +
      `(was bound to ${previousDevice}, sessions revoked)`
    );

    return res.json(success({
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        bound_mobile_device_id: null,
        mobile_device_bound_at: null,
      },
    }, 'Phone reset -- the student can now sign in on a new device'));

  } catch (err) {
    console.error('[Admin] resetUserDevice error:', err);
    return res.status(500).json(error('Server error while resetting device'));
  }
};