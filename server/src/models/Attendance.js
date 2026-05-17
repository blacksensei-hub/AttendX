const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  session_id:    { type: DataTypes.UUID, allowNull: false },
  student_id:    { type: DataTypes.UUID, allowNull: false },
  status:        { type: DataTypes.ENUM('present','late','absent'), defaultValue: 'present' },
  marked_at:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  geo_lat:       { type: DataTypes.DECIMAL(10, 8) },
  geo_lng:       { type: DataTypes.DECIMAL(11, 8) },
  device_id:     { type: DataTypes.STRING(255) },
  ip_address:    { type: DataTypes.STRING(45) },
  is_mock_gps:   { type: DataTypes.BOOLEAN, defaultValue: false },
  qr_token_used: { type: DataTypes.STRING(100) },
  notes:         { type: DataTypes.TEXT },
}, {
  tableName:   'attendance',
  underscored: true,
  timestamps:  false,
  indexes: [{ unique: true, fields: ['session_id', 'student_id'] }],
});

module.exports = Attendance;