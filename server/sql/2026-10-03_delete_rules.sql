-- ═════════════════════════════════════════════════════════════════
-- AttendX — delete rules for appeals, adjustments and "view as" logs
-- (2026-10-03)
--
-- On Neon these links had no ON DELETE rule, so Postgres refused the
-- delete whenever a matching row existed:
--
--   * an admin deleting a user who had an appeal, an attendance
--     adjustment (as the student or as the lecturer who made it) or a
--     "view as" log failed with a server error
--   * deleting a session report failed if any record in it had been
--     adjusted or appealed (approving an excused absence records an
--     adjustment, so this got more common)
--
-- After this:
--   appeals                 → deleted with their session or student
--   attendance_adjustments  → deleted with their session, student or
--                             attendance record; when the lecturer who
--                             made one is deleted it is kept and shows
--                             "a deleted user" (adjusted_by → NULL)
--   impersonation_logs      → deleted with either user; the audit trail
--                             (audit_events) keeps a named record of
--                             every "view as"
--
-- Every constraint is dropped and recreated under its existing name, so
-- this is idempotent and brings any copy of the schema to the same
-- rules. One transaction: if an existing row breaks a new constraint,
-- nothing changes.
--
--   psql "<direct DATABASE_URL>" -v ON_ERROR_STOP=1 -f server/sql/2026-10-03_delete_rules.sql
--
-- Order: any. The server code works before and after; the deletes start
-- working once this has run.
-- ═════════════════════════════════════════════════════════════════

BEGIN;

-- ── Appeals ────────────────────────────────────────────────────
ALTER TABLE appeals DROP CONSTRAINT IF EXISTS appeals_session_id_fkey;
ALTER TABLE appeals ADD CONSTRAINT appeals_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE appeals DROP CONSTRAINT IF EXISTS appeals_student_id_fkey;
ALTER TABLE appeals ADD CONSTRAINT appeals_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- ── Attendance adjustments ─────────────────────────────────────
ALTER TABLE attendance_adjustments DROP CONSTRAINT IF EXISTS attendance_adjustments_session_id_fkey;
ALTER TABLE attendance_adjustments ADD CONSTRAINT attendance_adjustments_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attendance_adjustments DROP CONSTRAINT IF EXISTS attendance_adjustments_student_id_fkey;
ALTER TABLE attendance_adjustments ADD CONSTRAINT attendance_adjustments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attendance_adjustments DROP CONSTRAINT IF EXISTS attendance_adjustments_attendance_id_fkey;
ALTER TABLE attendance_adjustments ADD CONSTRAINT attendance_adjustments_attendance_id_fkey
  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- The change history outlives the lecturer who made it.
ALTER TABLE attendance_adjustments ALTER COLUMN adjusted_by DROP NOT NULL;
ALTER TABLE attendance_adjustments DROP CONSTRAINT IF EXISTS attendance_adjustments_adjusted_by_fkey;
ALTER TABLE attendance_adjustments ADD CONSTRAINT attendance_adjustments_adjusted_by_fkey
  FOREIGN KEY (adjusted_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ── "View as" logs ─────────────────────────────────────────────
ALTER TABLE impersonation_logs DROP CONSTRAINT IF EXISTS impersonation_logs_admin_id_fkey;
ALTER TABLE impersonation_logs ADD CONSTRAINT impersonation_logs_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE impersonation_logs DROP CONSTRAINT IF EXISTS impersonation_logs_target_user_id_fkey;
ALTER TABLE impersonation_logs ADD CONSTRAINT impersonation_logs_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

COMMIT;
