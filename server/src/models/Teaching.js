// server/src/models/Teaching.js
const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

/**
 * ═════════════════════════════════════════════════════════════════
 * Models for the lecturer and student tools: teaching staff on a
 * class, excused-absence requests and per-user preferences.
 *
 * The tables come from server/sql/2026-09-29_teaching_tools.sql, not
 * from sequelize.sync().
 * ═════════════════════════════════════════════════════════════════
 */

// Co-lecturers and teaching assistants. The class's lecturer_id is
// still the owner and never appears here.
const ClassStaff = sequelize.define('ClassStaff', {
  class_id: { type: DataTypes.UUID, primaryKey: true },
  user_id:  { type: DataTypes.UUID, primaryKey: true },
  role:     { type: DataTypes.STRING(12), allowNull: false },
  added_by: { type: DataTypes.UUID },
}, {
  tableName:   'class_staff',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   false,
});

const ExcuseRequest = sequelize.define('ExcuseRequest', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  student_id:    { type: DataTypes.UUID, allowNull: false },
  class_id:      { type: DataTypes.UUID, allowNull: false },
  date_from:     { type: DataTypes.DATEONLY, allowNull: false },
  date_to:       { type: DataTypes.DATEONLY, allowNull: false },
  reason:        { type: DataTypes.STRING(20), allowNull: false },
  note:          { type: DataTypes.TEXT, allowNull: false },
  evidence_url:  { type: DataTypes.STRING(500) },
  status:        { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pending' },
  reviewed_by:   { type: DataTypes.UUID },
  reviewer_note: { type: DataTypes.TEXT },
  reviewed_at:   { type: DataTypes.DATE },
  applied_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName:   'excuse_requests',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   'updated_at',
});

// A missing row means the defaults, so nothing has to be created for
// existing users.
const UserPreference = sequelize.define('UserPreference', {
  user_id:          { type: DataTypes.UUID, primaryKey: true },
  reminder_minutes: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
  calendar_token:   { type: DataTypes.STRING(64) },
}, {
  tableName:   'user_preferences',
  underscored: true,
  createdAt:   false,
  updatedAt:   'updated_at',
});

module.exports = { ClassStaff, ExcuseRequest, UserPreference };
