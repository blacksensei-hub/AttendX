const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { success, error } = require('../utils/apiResponse');

// ─── Device binding policy ────────────────────────────────────
// Which roles are locked to a device. Students only, deliberately: they're
// the ones with an incentive to share credentials so a friend can mark
// attendance for them. Binding staff would risk locking an admin out of
// their own panel with nobody able to reset them.
//
// Binding is PER PLATFORM, not global. The actual threat is specifically a
// mobile device being used by someone else to mark attendance — that's
// what the mobile slot guards. Being logged into your own laptop browser
// at the same time is normal use, not the threat, so web gets its own
// independent slot. A student can legitimately be signed in on both.
//
// To apply binding to every role, change isBindable to: () => true
const BOUND_ROLES = ['student'];
const isBindable = (role) => BOUND_ROLES.includes(role);

// Maps a client-declared platform to the pair of columns that track it.
// Falls back to 'web' for any unrecognised/missing value — the safer
// default, since web is the lower-durability slot (localStorage clears
// far more easily than a phone's SecureStore).
function slotFor(platform) {
  return platform === 'mobile'
    ? { idCol: 'bound_mobile_device_id', atCol: 'mobile_device_bound_at', label: 'mobile' }
    : { idCol: 'bound_web_device_id',    atCol: 'web_device_bound_at',    label: 'web' };
}

// ─── Generate class code ──────────────────────────────────────
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ─── Register ────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, studentId, department, deviceId, platform } = req.body;

    const normalizedEmail = email?.toLowerCase().trim();
    const finalRole = role || 'student';

    // ── Server-side validation (defense beyond the frontend) ──
    if (finalRole === 'student') {
      const id = (studentId ?? '').trim();
      if (!/^\d{10}$/.test(id)) {
        return res.status(400).json(error('Student ID must be exactly 10 digits'));
      }
    }

    // ── Duplicate email check (case-insensitive) ──
    const emailExists = await User.findOne({ where: { email: normalizedEmail } });
    if (emailExists) {
      return res.status(409).json(error('Email already registered'));
    }

    // ── Duplicate student ID check (students only) ──
    if (finalRole === 'student' && studentId) {
      const idExists = await User.findOne({ where: { student_id: studentId.trim() } });
      if (idExists) {
        return res.status(409).json(error('Student ID already registered'));
      }
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 12);

    // Bind the registering device to its platform slot straight away, so
    // the very first session is already tied to a device rather than
    // binding on some later login (which could come from someone else's
    // browser). Only the slot for the platform that registered gets set —
    // the other stays open for that same student's other device.
    const bindNow = isBindable(finalRole) && Boolean(deviceId);
    const slot = slotFor(platform);

    // Create user
    const user = await User.create({
      name,
      email:      normalizedEmail,
      password:   hashed,
      role:       finalRole,
      student_id: finalRole === 'student' ? studentId.trim() : null,
      department,
      ...(bindNow ? { [slot.idCol]: deviceId, [slot.atCol]: new Date() } : {}),
    });

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, token_version: user.token_version },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(201).json(success({
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        student_id: user.student_id,
      },
      token,
    }, 'Account created successfully'));

  } catch (err) {
    console.error(err);
    return res.status(500).json(error('Server error during registration'));
  }
};

// ─── Login ───────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password, deviceId, platform } = req.body;

    // Find user WITH password (we excluded it from default scope)
    const user = await User.scope('withPassword').findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) return res.status(401).json(error('Invalid email or password'));
    if (!user.is_active) return res.status(403).json(error('Account deactivated'));

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json(error('Invalid email or password'));

    // ── Device binding (per platform) ──────────────────────────
    // Runs only AFTER the password check, so it can never be used to
    // probe which accounts exist or what device an account is bound to.
    //
    // Each platform has its own independent slot — a student logging in
    // on the web doesn't affect their mobile binding and vice versa.
    // Three cases per slot, same as before, just scoped to one platform:
    //   1. No device id sent  → allow, but don't bind. Keeps older clients
    //      and non-browser tooling working rather than hard-failing.
    //   2. That slot unbound  → bind it to this device now.
    //   3. That slot bound    → must match, otherwise reject.
    if (isBindable(user.role) && deviceId) {
      const slot = slotFor(platform);
      const boundId = user[slot.idCol];

      if (!boundId) {
        await user.update({
          [slot.idCol]: deviceId,
          [slot.atCol]: new Date(),
        });
        console.log(`[DeviceBind] bound ${user.email} (${slot.label}) to device ${deviceId}`);
      } else if (boundId !== deviceId) {
        console.warn(
          `[DeviceBind] REJECTED ${user.email} (${slot.label}) — bound=${boundId} attempted=${deviceId}`
        );
        return res.status(403).json(error(
          `This account's ${slot.label} access is registered to a different device. ` +
          'Please use your original device, or contact your administrator to reset it.'
        ));
      }
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, token_version: user.token_version },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.json(success({
      user:  { id: user.id, name: user.name, email: user.email,
               role: user.role, avatar_url: user.avatar_url },
      token,
    }, 'Login successful'));

  } catch (err) {
    console.error(err);
    return res.status(500).json(error('Server error during login'));
  }
};

// ─── Get current user ─────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json(error('User not found'));
    return res.json(success({ user }));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ─── Change password ──────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.scope('withPassword').findByPk(req.user.id);

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json(error('Current password is incorrect'));

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json(success(null, 'Password changed successfully'));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};