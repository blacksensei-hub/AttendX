const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const Appeal = sequelize.define('Appeal', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  student_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  session_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  attendance_id: {
    type:      DataTypes.UUID,
    allowNull: true,
  },
  reason: {
    type:      DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type:         DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  lecturer_note: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  reviewed_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
  reviewed_by: {
    type:      DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName:   'appeals',
  underscored: true,
  timestamps:  true,
  createdAt:   'created_at',
  updatedAt:   'updated_at',
});

module.exports = Appeal;