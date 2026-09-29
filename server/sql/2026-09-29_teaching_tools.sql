-- ═════════════════════════════════════════════════════════════════
-- AttendX — lecturer and student tools (2026-09-29)
--
--   * excused absences: a new attendance status and the requests
--     students send to have an absence excused
--   * co-lecturers and teaching assistants on a class
--   * per-user preferences: class reminder lead time and the private
--     calendar-feed token
--
-- Additive and idempotent: it only creates what is missing, so it is
-- safe to run more than once. Nothing existing is dropped or rewritten.
--
-- Run it with psql against Neon's DIRECT connection string (the host
-- without "-pooler"):
--
--   psql "<direct DATABASE_URL>" -v ON_ERROR_STOP=1 -f server/sql/2026-09-29_teaching_tools.sql
--
-- ORDER MATTERS: apply this BEFORE deploying the server code that uses
-- it. /admin/health reports whether every table in this file exists.
-- ═════════════════════════════════════════════════════════════════

-- ── Enum values ────────────────────────────────────────────────
-- ADD VALUE sits outside the transaction below: a value added inside a
-- transaction cannot be used until it commits.
--
-- 'excused' counts towards a student's attendance minimum, the same as
-- present and late. It is only ever set by an approved excuse request
-- or a lecturer's manual adjustment, never by a scan.
ALTER TYPE enum_attendance_status  ADD VALUE IF NOT EXISTS 'excused';
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'excuse_request';
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'excuse_reviewed';
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'class_reminder';
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'staff_added';

BEGIN;

-- ── Teaching staff on a class ──────────────────────────────────
-- The class's lecturer_id stays the owner. Co-lecturers can do
-- everything the owner can except delete the class, delete session
-- reports and manage staff. Teaching assistants can run sessions and
-- see the register, but not change attendance or review requests.
CREATE TABLE IF NOT EXISTS class_staff (
  class_id    uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role        varchar(12) NOT NULL CHECK (role IN ('co_lecturer', 'ta')),
  added_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS class_staff_user_idx ON class_staff (user_id);

-- ── Excused-absence requests ───────────────────────────────────
-- A student asks for a date range in one class to be excused (past or
-- upcoming). Approving it turns absences in that range into 'excused',
-- and sessions that close later in the range are recorded as excused
-- instead of absent. applied_count is how many records it changed.
CREATE TABLE IF NOT EXISTS excuse_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  class_id       uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date_from      date        NOT NULL,
  date_to        date        NOT NULL,
  reason         varchar(20) NOT NULL
                 CHECK (reason IN ('medical', 'bereavement', 'university', 'religious', 'family', 'other')),
  note           text        NOT NULL,
  evidence_url   varchar(500),
  status         varchar(12) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  reviewer_note  text,
  reviewed_at    timestamptz,
  applied_count  integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (date_to >= date_from),
  CHECK (date_to - date_from <= 30)
);
CREATE INDEX IF NOT EXISTS excuse_requests_class_idx   ON excuse_requests (class_id, status, date_from);
CREATE INDEX IF NOT EXISTS excuse_requests_student_idx ON excuse_requests (student_id, created_at DESC);

-- ── Per-user preferences ───────────────────────────────────────
-- A missing row means the defaults (10-minute reminders, no calendar
-- feed yet), so existing users need nothing. calendar_token is the
-- secret in the private .ics feed URL; rotating it breaks old links.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id           uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reminder_minutes  smallint    NOT NULL DEFAULT 10 CHECK (reminder_minutes IN (0, 10, 30, 60)),
  calendar_token    varchar(64),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_calendar_token_key
  ON user_preferences (calendar_token) WHERE calendar_token IS NOT NULL;

COMMIT;
