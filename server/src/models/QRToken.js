const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

// A code has no "used" flag: the whole class scans the same rotating code,
// so a code can't be single use. Each student scans once per session
// because of the unique index on attendance (session_id, student_id).
// Older databases still have a `used` column from before; nothing reads or
// writes it, and sync() leaves existing tables alone.
const QRToken = sequelize.define('QRToken', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  session_id: { type: DataTypes.UUID, allowNull: false },
  token:      { type: DataTypes.STRING(100), unique: true, allowNull: false },
  issued_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  expires_at: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName:  'qr_tokens',
  underscored: true,
  timestamps: false,
});

module.exports = QRToken;