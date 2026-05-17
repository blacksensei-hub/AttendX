const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { success, error } = require('../utils/apiResponse');

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
    const { name, email, password, role, studentId, department } = req.body;

    // Check duplicate email
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json(error('Email already registered'));

    // Hash password
    const hashed = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name,
      email:      email.toLowerCase(),
      password:   hashed,
      role:       role || 'student',
      student_id: studentId,
      department,
    });

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(201).json(success({
      user:  { id: user.id, name: user.name, email: user.email, role: user.role },
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
    const { email, password } = req.body;

    // Find user WITH password (we excluded it from default scope)
    const user = await User.scope('withPassword').findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) return res.status(401).json(error('Invalid email or password'));
    if (!user.is_active) return res.status(403).json(error('Account deactivated'));

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json(error('Invalid email or password'));

    const token = jwt.sign(
      { id: user.id, role: user.role },
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