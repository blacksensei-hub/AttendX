const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const Session = sequelize.define('Session', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  class_id:       { type: DataTypes.UUID, allowNull: true }, // ← change to allowNull: true
  title:          { type: DataTypes.STRING(150) },
  status:         { type: DataTypes.ENUM('open','closed','cancelled'), defaultValue: 'open' },
  open_at:        { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  close_at:       { type: DataTypes.DATE },
  closed_at:      { type: DataTypes.DATE },
  late_threshold: { type: DataTypes.INTEGER, defaultValue: 15 },
  qr_interval:    { type: DataTypes.INTEGER, defaultValue: 5 },
  geo_lat:        { type: DataTypes.DECIMAL(10, 8) },
  geo_lng:        { type: DataTypes.DECIMAL(11, 8) },
  geo_radius:     { type: DataTypes.INTEGER },
  notes:          { type: DataTypes.TEXT },
  // Store class name at session creation so it survives deletion
  class_name_snapshot: { type: DataTypes.STRING(150) },
}, {
  tableName:   'sessions',
  underscored: true,
  timestamps:  true,
  updatedAt:   false,
});

module.exports = Session;