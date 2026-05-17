const { Sequelize } = require('sequelize');
const sequelize     = require('../config/database');

// ─── Import models ────────────────────────────────────────────
const User                 = require('./User');
const Class                = require('./Class');
const Enrollment           = require('./Enrollment');
const Session              = require('./Session');
const Attendance           = require('./Attendance');
const QRToken              = require('./QRToken');
const Notification         = require('./Notification');
const Appeal               = require('./Appeal');
const AttendanceAdjustment = require('./AttendanceAdjustment');
const ClassSchedule        = require('./ClassSchedule');
const ImpersonationLog     = require('./ImpersonationLog');   // ← added

// ─── Associations ─────────────────────────────────────────────

// ── User ↔ Class ──────────────────────────────────────────────
User.hasMany(Class,   { foreignKey: 'lecturer_id', as: 'classes'  });
Class.belongsTo(User, { foreignKey: 'lecturer_id', as: 'lecturer' });

// ── Student ↔ Class (many-to-many through Enrollment) ─────────
User.belongsToMany(Class, {
  through:    Enrollment,
  foreignKey: 'student_id',
  as:         'enrolledClasses',
});
Class.belongsToMany(User, {
  through:    Enrollment,
  foreignKey: 'class_id',
  as:         'students',
});

// ── Enrollment direct associations ────────────────────────────
Enrollment.belongsTo(User, { foreignKey: 'student_id', as: 'student'     });
User.hasMany(Enrollment,   { foreignKey: 'student_id', as: 'enrollments' });

// ── Class ↔ Session ───────────────────────────────────────────
Class.hasMany(Session,   { foreignKey: 'class_id', as: 'sessions', onDelete: 'SET NULL' });
Session.belongsTo(Class, { foreignKey: 'class_id', as: 'class',    onDelete: 'SET NULL' });

// ── Session ↔ QRToken ─────────────────────────────────────────
Session.hasMany(QRToken,   { foreignKey: 'session_id', as: 'qrTokens' });
QRToken.belongsTo(Session, { foreignKey: 'session_id', as: 'session'  });

// ── Session ↔ Attendance ──────────────────────────────────────
Session.hasMany(Attendance,   { foreignKey: 'session_id', as: 'attendanceRecords' });
Attendance.belongsTo(Session, { foreignKey: 'session_id', as: 'session'           });

// ── Student ↔ Attendance ──────────────────────────────────────
User.hasMany(Attendance,   { foreignKey: 'student_id', as: 'attendanceRecords' });
Attendance.belongsTo(User, { foreignKey: 'student_id', as: 'student'           });

// ── User ↔ Notification ───────────────────────────────────────
User.hasMany(Notification,   { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user'          });

// ── Appeal associations ───────────────────────────────────────
// We declare Appeal → User BEFORE Appeal → Session and include targetKey
// to prevent Sequelize from incorrectly joining appeals → appeals
// instead of appeals → users.
Appeal.belongsTo(User, {
  foreignKey: 'student_id',
  as:         'student',
  targetKey:  'id',
});
Appeal.belongsTo(Session, {
  foreignKey: 'session_id',
  as:         'session',
  targetKey:  'id',
});
User.hasMany(Appeal,    { foreignKey: 'student_id', as: 'appeals' });
Session.hasMany(Appeal, { foreignKey: 'session_id', as: 'appeals' });

// ── Class ↔ ClassSchedule ─────────────────────────────────────
Class.hasMany(ClassSchedule,   { foreignKey: 'class_id', as: 'schedules' });
ClassSchedule.belongsTo(Class, { foreignKey: 'class_id', as: 'class'     });

// ── AttendanceAdjustment associations ─────────────────────────
AttendanceAdjustment.belongsTo(User,       { foreignKey: 'student_id',   as: 'student'    });
AttendanceAdjustment.belongsTo(User,       { foreignKey: 'adjusted_by',  as: 'adjustedBy' });
AttendanceAdjustment.belongsTo(Attendance, { foreignKey: 'attendance_id',as: 'attendance' });
AttendanceAdjustment.belongsTo(Session,    { foreignKey: 'session_id',   as: 'session'    });

// ── ImpersonationLog associations ─────────────────────────────
// Each log row links the admin who acted to the target user being
// viewed. Two distinct aliases on User let us include both sides of
// the relationship in a single query for the audit page later.
ImpersonationLog.belongsTo(User, {
  foreignKey: 'admin_id',
  as:         'admin',
});
ImpersonationLog.belongsTo(User, {
  foreignKey: 'target_user_id',
  as:         'targetUser',
});
User.hasMany(ImpersonationLog, {
  foreignKey: 'admin_id',
  as:         'impersonationsPerformed',
});
User.hasMany(ImpersonationLog, {
  foreignKey: 'target_user_id',
  as:         'impersonationsReceived',
});

// ─── Exports ──────────────────────────────────────────────────
// Every model must be exported here or controllers that import from
// '../models' will get undefined and crash with errors like
// "Cannot read properties of undefined (reading 'create')".
module.exports = {
  sequelize, Sequelize,
  User,
  Class,
  Enrollment,
  Session,
  Attendance,
  QRToken,
  Notification,
  Appeal,
  AttendanceAdjustment,
  ClassSchedule,
  ImpersonationLog,            // ← added
};