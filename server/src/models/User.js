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
  student_id: { type: DataTypes.STRING(50) },
  department: { type: DataTypes.STRING(100) },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
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