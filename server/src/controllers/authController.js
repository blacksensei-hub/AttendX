const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { success, error } = require('../utils/apiResponse');

// ─── Device binding policy ────────────────────────────────────
// Which roles are locked to a single device. Students only, deliberately:
// they're the ones with an incentive to share credentials so a friend can
// mark attendance for them. Binding staff would risk locking an admin out
// of their own panel with nobody able to reset them — a much worse failure
// than the thing we're preventing.
//
// To apply binding to every role, change isBindable to: () => true
const BOUND_ROLES = ['student'];
const isBindable = (role) => BOUND_ROLES.includes(role);

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
    const { name, email, password, role, studentId, department, deviceId } = req.body;

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

    // Bind the account to the registering device straight away, so the
    // very first session is already tied to a device rather than binding
    // on some later login (which could come from someone else's browser).
    const bindNow = isBindable(finalRole) && Boolean(deviceId);

    // Create user
    const user = await User.create({
      name,
      email:      normalizedEmail,
      password:   hashed,
      role:       finalRole,
      student_id: finalRole === 'student' ? studentId.trim() : null,
      department,
      bound_device_id: bindNow ? deviceId : null,
      device_bound_at: bindNow ? new Date() : null,
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
    const { email, password, deviceId } = req.body;

    // Find user WITH password (we excluded it from default scope)
    const user = await User.scope('withPassword').findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) return res.status(401).json(error('Invalid email or password'));
    if (!user.is_active) return res.status(403).json(error('Account deactivated'));

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json(error('Invalid email or password'));

    // ── Device binding ─────────────────────────────────────────
    // Runs only AFTER the password check, so it can never be used to
    // probe which accounts exist or what device an account is bound to.
    //
    // Three cases for a bindable (student) account:
    //   1. No device id sent  → allow, but don't bind. Keeps older clients
    //      and non-browser tooling working rather than hard-failing.
    //   2. Account unbound    → bind it to this device now.
    //   3. Account bound      → must match, otherwise reject.
    if (isBindable(user.role) && deviceId) {
      if (!user.bound_device_id) {
        await user.update({
          bound_device_id: deviceId,
          device_bound_at: new Date(),
        });
        console.log(`[DeviceBind] bound ${user.email} to device ${deviceId}`);
      } else if (user.bound_device_id !== deviceId) {
        console.warn(
          `[DeviceBind] REJECTED ${user.email} — bound=${user.bound_device_id} attempted=${deviceId}`
        );
        return res.status(403).json(error(
          'This account is registered to a different device. ' +
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