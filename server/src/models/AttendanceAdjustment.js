const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const AttendanceAdjustment = sequelize.define('AttendanceAdjustment', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  attendance_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  session_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  student_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  adjusted_by: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  old_status: {
    type:      DataTypes.STRING(20),
    allowNull: false,
  },
  new_status: {
    type:      DataTypes.STRING(20),
    allowNull: false,
  },
  reason: {
    type:      DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName:  'attendance_adjustments',
  underscored: true,
  timestamps:  true,
  updatedAt:   false,      // audit records are immutable — no updates ever
  createdAt:   'created_at',
});

module.exports = AttendanceAdjustment;