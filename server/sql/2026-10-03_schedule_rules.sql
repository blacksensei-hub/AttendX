-- ═════════════════════════════════════════════════════════════════
-- AttendX — rules for weekly timetable slots (2026-10-03)
--
-- Brings Neon's class_schedules in line with the local development
-- database, which already had these:
--
--   * active, late-after and QR-interval can't be empty (the defaults
--     are true, 5 minutes and 10 seconds)
--   * day of the week is 0 to 6 (Sunday to Saturday)
--   * a slot is longer than 0 minutes
--   * indexes on the class and on whether the slot is active
--
-- The app already fills and checks these values, so nothing it saves
-- is affected; the database now refuses bad timetable rows instead of
-- storing them. Any existing empty values are set to the defaults
-- first. Idempotent; one transaction.
--
--   psql "<direct DATABASE_URL>" -v ON_ERROR_STOP=1 -f server/sql/2026-10-03_schedule_rules.sql
-- ═════════════════════════════════════════════════════════════════

BEGIN;

UPDATE class_schedules SET is_active      = true WHERE is_active      IS NULL;
UPDATE class_schedules SET late_threshold = 5    WHERE late_threshold IS NULL;
UPDATE class_schedules SET qr_interval    = 10   WHERE qr_interval    IS NULL;

ALTER TABLE class_schedules ALTER COLUMN is_active      SET NOT NULL;
ALTER TABLE class_schedules ALTER COLUMN late_threshold SET NOT NULL;
ALTER TABLE class_schedules ALTER COLUMN qr_interval    SET NOT NULL;

ALTER TABLE class_schedules DROP CONSTRAINT IF EXISTS class_schedules_day_of_week_check;
ALTER TABLE class_schedules ADD CONSTRAINT class_schedules_day_of_week_check
  CHECK (day_of_week >= 0 AND day_of_week <= 6);

ALTER TABLE class_schedules DROP CONSTRAINT IF EXISTS class_schedules_duration_mins_check;
ALTER TABLE class_schedules ADD CONSTRAINT class_schedules_duration_mins_check
  CHECK (duration_mins > 0);

CREATE INDEX IF NOT EXISTS idx_schedules_class  ON class_schedules (class_id);
CREATE INDEX IF NOT EXISTS idx_schedules_active ON class_schedules (is_active);

COMMIT;
