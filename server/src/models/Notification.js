const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  user_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  type: {
    // Must match enum_notifications_type in the database (see
    // server/sql/2026-09-27_admin_console.sql for the last additions).
    type:      DataTypes.ENUM(
      'session_opened',
      'attendance_confirmed',
      'session_closing_soon',
      'announcement',
      'at_risk',
      'at_risk_alert',
      'security'
    ),
    allowNull: false,
  },
  title:   { type: DataTypes.STRING(150), allowNull: false },
  message: { type: DataTypes.TEXT,        allowNull: false },
  data:    { type: DataTypes.JSONB,        defaultValue: {} },
  read:    { type: DataTypes.BOOLEAN,      defaultValue: false },
}, {
  tableName:   'notifications',
  underscored: true,
  timestamps:  true,
  updatedAt:   false,
});

module.exports = Notification;