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
  // Set when the change is made; becomes NULL if that lecturer's
  // account is later deleted, so the history outlives them
  // (server/sql/2026-10-03_delete_rules.sql).
  adjusted_by: {
    type:      DataTypes.UUID,
    allowNull: true,
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