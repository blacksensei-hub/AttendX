// server/src/models/AdminConsole.js
const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

/**
 * ═════════════════════════════════════════════════════════════════
 * Models for the admin console: audit trail, institution settings,
 * academic calendar, failed scan attempts, fraud flags and
 * announcements.
 *
 * The tables come from server/sql/2026-09-27_admin_console.sql, not
 * from sequelize.sync() (see the bootstrap note in app.js). They are
 * kept in one file because they share that migration and nothing
 * outside the admin console reads them directly.
 * ═════════════════════════════════════════════════════════════════
 */

const uuidPk = {
  type:         DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey:   true,
};

// One row per sensitive action. Names and labels are snapshots so the
// trail stays readable after the user or class they name is deleted.
const AuditEvent = sequelize.define('AuditEvent', {
  id:           uuidPk,
  actor_id:     { type: DataTypes.UUID },
  actor_name:   { type: DataTypes.STRING(120) },
  actor_role:   { type: DataTypes.STRING(20) },
  on_behalf_of: { type: DataTypes.UUID },
  action:       { type: DataTypes.STRING(60), allowNull: false },
  target_type:  { type: DataTypes.STRING(30) },
  target_id:    { type: DataTypes.STRING(64) },
  target_label: { type: DataTypes.STRING(200) },
  summary:      { type: DataTypes.TEXT },
  changes:      { type: DataTypes.JSONB },
  ip:           { type: DataTypes.STRING(64) },
}, {
  tableName:   'audit_events',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   false,
});

const InstitutionSetting = sequelize.define('InstitutionSetting', {
  key:        { type: DataTypes.STRING(80), primaryKey: true },
  value:      { type: DataTypes.JSONB, allowNull: false },
  updated_by: { type: DataTypes.UUID },
}, {
  tableName:   'institution_settings',
  underscored: true,
  createdAt:   false,
  updatedAt:   'updated_at',
});

const Semester = sequelize.define('Semester', {
  id:          uuidPk,
  name:        { type: DataTypes.STRING(80), allowNull: false },
  starts_on:   { type: DataTypes.DATEONLY, allowNull: false },
  ends_on:     { type: DataTypes.DATEONLY, allowNull: false },
  is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName:   'semesters',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   'updated_at',
});

const CalendarEvent = sequelize.define('CalendarEvent', {
  id:              uuidPk,
  title:           { type: DataTypes.STRING(120), allowNull: false },
  kind:            { type: DataTypes.STRING(12),  allowNull: false },
  starts_on:       { type: DataTypes.DATEONLY,    allowNull: false },
  ends_on:         { type: DataTypes.DATEONLY,    allowNull: false },
  blocks_sessions: { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true },
  note:            { type: DataTypes.TEXT },
  created_by:      { type: DataTypes.UUID },
}, {
  tableName:   'calendar_events',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   'updated_at',
});

// A scan or sign-in that was refused. Successful scans live in
// attendance; these feed the fraud rules.
const ScanAttempt = sequelize.define('ScanAttempt', {
  id:         uuidPk,
  user_id:    { type: DataTypes.UUID },
  session_id: { type: DataTypes.UUID },
  reason:     { type: DataTypes.STRING(30), allowNull: false },
  device_id:  { type: DataTypes.STRING(255) },
  ip_address: { type: DataTypes.STRING(64) },
  geo_lat:    { type: DataTypes.DECIMAL(10, 8) },
  geo_lng:    { type: DataTypes.DECIMAL(11, 8) },
  distance_m: { type: DataTypes.INTEGER },
}, {
  tableName:   'scan_attempts',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   false,
});

const FraudFlag = sequelize.define('FraudFlag', {
  id:              uuidPk,
  kind:            { type: DataTypes.STRING(40),  allowNull: false },
  severity:        { type: DataTypes.STRING(10),  allowNull: false, defaultValue: 'medium' },
  status:          { type: DataTypes.STRING(12),  allowNull: false, defaultValue: 'open' },
  user_id:         { type: DataTypes.UUID },
  session_id:      { type: DataTypes.UUID },
  class_id:        { type: DataTypes.UUID },
  summary:         { type: DataTypes.STRING(300), allowNull: false },
  evidence:        { type: DataTypes.JSONB,       allowNull: false, defaultValue: {} },
  dedupe_key:      { type: DataTypes.STRING(200), allowNull: false, unique: true },
  reviewed_by:     { type: DataTypes.UUID },
  reviewed_at:     { type: DataTypes.DATE },
  resolution:      { type: DataTypes.STRING(30) },
  resolution_note: { type: DataTypes.TEXT },
}, {
  tableName:   'fraud_flags',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   'updated_at',
});

const Announcement = sequelize.define('Announcement', {
  id:              uuidPk,
  title:           { type: DataTypes.STRING(150), allowNull: false },
  body:            { type: DataTypes.TEXT,        allowNull: false },
  audience:        { type: DataTypes.STRING(12),  allowNull: false },
  audience_value:  { type: DataTypes.STRING(150) },
  send_in_app:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  send_email:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  status:          { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'draft' },
  scheduled_for:   { type: DataTypes.DATE },
  sent_at:         { type: DataTypes.DATE },
  recipient_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  created_by:      { type: DataTypes.UUID },
}, {
  tableName:   'announcements',
  underscored: true,
  createdAt:   'created_at',
  updatedAt:   'updated_at',
});

const AnnouncementReceipt = sequelize.define('AnnouncementReceipt', {
  announcement_id: { type: DataTypes.UUID, primaryKey: true },
  user_id:         { type: DataTypes.UUID, primaryKey: true },
  delivered_at:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  read_at:         { type: DataTypes.DATE },
}, {
  tableName:   'announcement_receipts',
  underscored: true,
  timestamps:  false,
});

module.exports = {
  AuditEvent,
  InstitutionSetting,
  Semester,
  CalendarEvent,
  ScanAttempt,
  FraudFlag,
  Announcement,
  AnnouncementReceipt,
};
