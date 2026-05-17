const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

/**
 * ════════════════════════════════════════════════════════════════════
 * ImpersonationLog — audit table for admin "view as" sessions.
 *
 * Every time an admin starts impersonating another user, a row is
 * inserted with started_at = NOW(). When the admin stops impersonating,
 * ended_at is filled in.
 *
 * Why a dedicated table:
 *   This information is sensitive. We deliberately do NOT reuse the
 *   notifications table or any other generic log because:
 *     • Compliance — an external auditor must be able to query exactly
 *       which admins viewed which users and when, with no noise.
 *     • Retention — impersonation events need longer retention than
 *       routine notifications. A separate table lets us apply different
 *       retention policies later without complex joins.
 *     • Indexing — querying "all impersonations of student X" or "all
 *       impersonations performed by admin Y" should be cheap, which is
 *       why the indexes below are pre-baked.
 *
 * Why ended_at can stay null:
 *   If the impersonation token expires before the admin clicks "Stop",
 *   we have no clean signal that the session ended. Rather than
 *   guessing a value, we accept that some rows will have null ended_at.
 *   A future periodic cleanup job can set ended_at = started_at +
 *   token_expiry_window for any row whose started_at is older than the
 *   maximum possible token lifetime.
 * ════════════════════════════════════════════════════════════════════
 */
const ImpersonationLog = sequelize.define('ImpersonationLog', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  // The admin who initiated the impersonation. Foreign key to users;
  // not nullable because every row must attribute the action to someone.
  admin_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  // The user being impersonated. Foreign key to users.
  // Also not nullable — there is no point logging an impersonation
  // session without knowing who was impersonated.
  target_user_id: {
    type:      DataTypes.UUID,
    allowNull: false,
  },
  started_at: {
    type:         DataTypes.DATE,
    allowNull:    false,
    defaultValue: DataTypes.NOW,
  },
  // Filled in when the admin clicks "Stop impersonating". Null while
  // the impersonation is active OR if the token expired before the
  // stop was called (see model docstring above).
  ended_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
  // Optional free-text reason an admin can supply at impersonation
  // start ("Investigating attendance dispute for ticket #1234").
  // Recommended in practice but not enforced — UAT showed forced-reason
  // fields just produce garbage like "x" or "test".
  reason: {
    type:      DataTypes.STRING(500),
    allowNull: true,
  },
  // Captured at impersonation start. Useful for forensics if a
  // compromised admin account is suspected later.
  ip: {
    type:      DataTypes.STRING(64),
    allowNull: true,
  },
  user_agent: {
    type:      DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName:   'impersonation_logs',
  underscored: true,
  timestamps:  true,        // adds created_at / updated_at for completeness
  indexes: [
    // Common query: "show me all impersonations of this user".
    { fields: ['target_user_id', 'started_at'] },
    // Common query: "show me all impersonations performed by this admin".
    { fields: ['admin_id', 'started_at'] },
    // Cheap lookup for any active (un-ended) impersonations.
    { fields: ['ended_at'] },
  ],
});

module.exports = ImpersonationLog;