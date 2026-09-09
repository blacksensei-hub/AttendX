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
// Binding applies to MOBILE ONLY. Two reasons, and they compound:
//
//   1. Marking attendance only happens in the mobile app — that's where
//      the QR scanner lives. A student signed into the website on a dozen
//      machines still can't mark attendance from any of them, so the
//      website was never the attack surface worth defending.
//
//   2. The web device id lives in localStorage, which a user can clear in
//      seconds, sidestep with an incognito window, or dodge by switching
//      browsers. It never stopped a determined person; it mostly just
//      locked out legitimate users moving between their laptop and their
//      phone's browser. Mobile's SecureStore-backed id is meaningfully
//      more durable, which is why that's the half worth keeping.
//
// Net effect: the dashboard you read is open; the app that marks
// attendance is locked to one phone.
const BOUND_ROLES = ['student'];
const isBindable = (role) => BOUND_ROLES.includes(role);

// Only mobile carries a device binding. Anything else (web, or a client
// that doesn't declare a platform) is left unbound.
const isBoundPlatform = (platform) => platform === 'mobile';

const MOBILE_SLOT = {
  idCol: 'bound_mobile_device_id',
  atCol: 'mobile_device_bound_at',
};

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

    // Bind the registering device only when signing up through the mobile
    // app — that's the platform the binding protects. Registering on the
    // web leaves the account unbound, and it'll bind on the student's
    // first mobile sign-in instead.
    const bindNow = isBindable(finalRole)
      && isBoundPlatform(platform)
      && Boolean(deviceId);

    // Create user
    const user = await User.create({
      name,
      email:      normalizedEmail,
      password:   hashed,
      role:       finalRole,
      student_id: finalRole === 'student' ? studentId.trim() : null,
      department,
      ...(bindNow
        ? { [MOBILE_SLOT.idCol]: deviceId, [MOBILE_SLOT.atCol]: new Date() }
        : {}),
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

    // ── Device binding (mobile only) ───────────────────────────
    // Runs only AFTER the password check, so it can never be used to
    // probe which accounts exist or what device an account is bound to.
    //
    // Web sign-ins skip this entirely — students can use the website from
    // a laptop, a library PC and their phone's browser all at once. Only
    // the mobile app, where attendance is actually marked, is locked to
    // one device. Three cases:
    //   1. No device id sent  → allow, but don't bind. Keeps older clients
    //      and non-browser tooling working rather than hard-failing.
    //   2. Slot unbound       → bind it to this device now.
    //   3. Slot bound         → must match, otherwise reject.
    if (isBindable(user.role) && isBoundPlatform(platform) && deviceId) {
      const boundId = user[MOBILE_SLOT.idCol];

      if (!boundId) {
        await user.update({
          [MOBILE_SLOT.idCol]: deviceId,
          [MOBILE_SLOT.atCol]: new Date(),
        });
        console.log(`[DeviceBind] bound ${user.email} (mobile) to device ${deviceId}`);
      } else if (boundId !== deviceId) {
        console.warn(
          `[DeviceBind] REJECTED ${user.email} (mobile) — bound=${boundId} attempted=${deviceId}`
        );
        return res.status(403).json(error(
          'The AttendX app is registered to a different phone on this account. ' +
          'Please use your original phone, or contact your administrator to reset it.'
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