// server/src/controllers/adminDeviceController.js
//
// Admin reset for account device binding.
//
// Student accounts are locked per platform on first login — one slot for
// web, one for mobile. That's the point — it stops a student handing their
// credentials to a friend's PHONE to mark attendance for them. But it also
// means any legitimate device change locks the student out of that
// platform: a new phone, a browser's site data cleared, a reinstall.
//
// This endpoint is the escape hatch. Without it the only recovery is raw
// SQL, which isn't viable in real use.
//
// Reset is scoped to ONE platform at a time, not both together. The most
// common real reason for a reset is "I got a new phone" — specifically the
// mobile slot. Resetting both would also force-logout a laptop session
// that never had a problem, which is more disruptive than necessary.

const { User }           = require('../models');
const { success, error } = require('../utils/apiResponse');

const SLOTS = {
  web:    { idCol: 'bound_web_device_id',    atCol: 'web_device_bound_at',    label: 'web' },
  mobile: { idCol: 'bound_mobile_device_id', atCol: 'mobile_device_bound_at', label: 'mobile' },
};

// --- PUT /api/admin/users/:id/reset-device/:platform ---
// :platform is 'web' or 'mobile' -- which slot to clear.
exports.resetUserDevice = async (req, res) => {
  try {
    const { id, platform } = req.params;
    const slot = SLOTS[platform];

    if (!slot) {
      return res.status(400).json(error("platform must be 'web' or 'mobile'"));
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json(error('User not found'));

    // Nothing to do -- report it rather than silently "succeeding", so the
    // admin knows this slot was already free to bind on next login.
    if (!user[slot.idCol]) {
      return res.status(400).json(error(`This account has no ${slot.label} device registered`));
    }

    const previousDevice = user[slot.idCol];

    // Clearing the binding alone isn't enough: the old device still holds
    // a valid JWT and would stay signed in until it expired (7 days).
    // Bumping token_version invalidates every token already issued for
    // this user -- authenticate.js compares the claim on each request, so
    // the old device is rejected the moment it next talks to the API.
    //
    // NOTE: token_version is global, not per-slot -- Sequelize/JWTs don't
    // give us a clean way to invalidate "only the mobile session" without
    // a second version counter. In practice this means resetting one
    // platform's binding also signs out the OTHER platform's active
    // session, even though its binding is left untouched -- it will simply
    // re-bind on its next login attempt, same device, no visible change
    // for that side beyond one silent re-login. Worth knowing, not worth
    // the complexity of two separate version counters for how rarely this
    // will actually matter in practice.
    await user.update({
      [slot.idCol]: null,
      [slot.atCol]: null,
      token_version: user.token_version + 1,
    });

    // Belt and braces: if the old device is currently connected, push it
    // out immediately rather than waiting for its next API call. This is
    // best-effort -- an offline device simply gets the 401 when it returns.
    const io = req.app.get('io');
    io?.to(`user:${user.id}`).emit('auth:force_logout', {
      reason: `Your ${slot.label} device registration was reset by an administrator.`,
    });

    // Logged so repeated resets for one student are visible in the server
    // logs -- a student asking for this every week is itself a signal.
    console.log(
      `[DeviceBind] RESET ${user.email} (${slot.label}) by admin ${req.user.id} ` +
      `(was bound to ${previousDevice}, sessions revoked)`
    );

    return res.json(success({
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        [slot.idCol]: null,
        [slot.atCol]: null,
      },
    }, `${slot.label === 'web' ? 'Web' : 'Mobile'} device reset -- signed out everywhere`));

  } catch (err) {
    console.error('[Admin] resetUserDevice error:', err);
    return res.status(500).json(error('Server error while resetting device'));
  }
};