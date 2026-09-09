const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const User = sequelize.define('User', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:       { type: DataTypes.STRING(120), allowNull: false },
  email:      { type: DataTypes.STRING(255), allowNull: false, unique: true,
                validate: { isEmail: true } },
  password:   { type: DataTypes.STRING(255), allowNull: false },
  role:       { type: DataTypes.ENUM('lecturer', 'student', 'admin'),
                allowNull: false, defaultValue: 'student' },
  avatar_url: { type: DataTypes.STRING(500) },
  // Unique among students; lecturers/admins remain NULL.
  // Postgres treats multiple NULLs as distinct, so non-students don't conflict.
  student_id: { type: DataTypes.STRING(50), unique: true },
  department: { type: DataTypes.STRING(100) },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },

  // ── Device binding ──────────────────────────────────────────
  // The single device this account is locked to. Set on first login
  // (when NULL), then enforced on every subsequent login.
  //
  // Named bound_device_id — NOT device_id — to avoid confusion with
  // attendance.device_id, which records "the device this scan came
  // from" rather than "the device this account is locked to".
  //
  // Nullable by design: NULL means unbound, which is both the initial
  // state for every account and the state an admin reset returns it to.
  // ── Device binding (per platform) ───────────────────────────
  // Two independent slots rather than one global binding. The actual
  // threat is a student's mobile device being used by someone else to
  // mark attendance for them — that's specifically a MOBILE problem.
  // Being logged into your own laptop browser at the same time is
  // normal use, not the threat, so it gets its own slot rather than
  // contending with the mobile one.
  //
  // Each is nullable independently: NULL means that platform's slot is
  // unbound, which is both the initial state and what an admin reset
  // returns it to — resetting mobile (e.g. "got a new phone") doesn't
  // need to also sign the student out of their laptop.
  bound_web_device_id:    { type: DataTypes.STRING(100) },
  web_device_bound_at:    { type: DataTypes.DATE },
  bound_mobile_device_id: { type: DataTypes.STRING(100) },
  mobile_device_bound_at: { type: DataTypes.DATE },

  // Incremented to invalidate every token already issued for this user.
  // JWTs can't be un-issued, so the value is embedded at sign time and
  // compared in authenticate.js on each request — bumping it ends all
  // existing sessions instantly (used when an admin resets a device).
  token_version:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName:   'users',
  underscored: true,
  timestamps:  true,
  defaultScope: {
    // Never return the password field by default — security best practice.
    // Any query that does not explicitly use the withPassword scope will
    // automatically exclude the password column from the result.
    attributes: { exclude: ['password'] },
  },
  scopes: {
    // Use this scope when you need to verify a password at login:
    // User.scope('withPassword').findOne({ where: { email } })
    // An empty object means "no restrictions" — return all columns
    // including the password hash.
    withPassword: {},
  },
});

module.exports = User;