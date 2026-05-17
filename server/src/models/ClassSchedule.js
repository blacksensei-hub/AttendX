const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const ClassSchedule = sequelize.define('ClassSchedule', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  class_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  // JavaScript day-of-week convention: 0 = Sunday, 6 = Saturday
  day_of_week: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    validate:  { min: 0, max: 6 },
  },
  // HH:MM format — 24-hour time
  start_time: {
    type:      DataTypes.TIME,
    allowNull: false,
  },
  duration_mins: {
    type:         DataTypes.INTEGER,
    allowNull:    false,
    defaultValue: 90,
  },
  qr_interval: {
    type:         DataTypes.INTEGER,
    defaultValue: 10,
  },
  late_threshold: {
    type:         DataTypes.INTEGER,
    defaultValue: 5,
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // Last time this schedule opened a session — prevents duplicate sessions
  // when the scheduler runs multiple times within the same minute window.
  last_triggered: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName:  'class_schedules',
  underscored: true,
  timestamps:  true,
  createdAt:   'created_at',
  updatedAt:   'updated_at',
});

module.exports = ClassSchedule;