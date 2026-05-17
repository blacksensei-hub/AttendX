const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const Class = sequelize.define('Class', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  name: {
    type:      DataTypes.STRING(150),
    allowNull: false,
  },
  code: {
    type:      DataTypes.STRING(10),
    unique:    true,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  department: {
    type: DataTypes.STRING(100),
  },
  schedule: {
    type:         DataTypes.JSONB,
    defaultValue: [],
  },
  location_name: {
    type: DataTypes.STRING(200),
  },
  geo_lat: {
    type: DataTypes.DECIMAL(10, 8),
  },
  geo_lng: {
    type: DataTypes.DECIMAL(11, 8),
  },
  geo_radius: {
    type:         DataTypes.INTEGER,
    defaultValue: 100,
  },
  lecturer_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },

  // The minimum attendance percentage a student must maintain for this class.
  // Defaults to 75% which is the standard university requirement.
  // Lecturers can adjust this per class from the Alerts page.
  // The thresholdController uses this value to determine which students
  // are at risk and to send them warning emails.
  attendance_threshold: {
    type:         DataTypes.INTEGER,
    defaultValue: 75,
    allowNull:    false,
  },

}, {
  tableName:   'classes',
  underscored: true,
  timestamps:  true,
});

module.exports = Class;