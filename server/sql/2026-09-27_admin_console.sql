-- ═════════════════════════════════════════════════════════════════
-- AttendX — admin console schema additions (2026-09-27)
--
-- Additive and idempotent: it only creates what is missing, so it is
-- safe to run more than once. Nothing existing is dropped or rewritten.
--
-- Run it with psql against Neon's DIRECT connection string (the host
-- without "-pooler"), the same way the original schema was bootstrapped:
--
--   psql "<direct DATABASE_URL>" -v ON_ERROR_STOP=1 -f server/sql/2026-09-27_admin_console.sql
--
-- ORDER MATTERS: apply this BEFORE deploying the server code that uses
-- it. The User model reads the new users columns on every query, so the
-- new code against the old schema would fail sign-in. /admin/health
-- reports whether every table in this file exists.
-- ═════════════════════════════════════════════════════════════════

-- ── Notification types ──────────────────────────────────────────
-- The at-risk alerts already insert 'at_risk' and 'at_risk_alert', but
-- those values were never added to the enum, so every one of those
-- in-app notifications failed. 'security' is new, for fraud warnings.
-- ADD VALUE sits outside the transaction below: a value added inside a
-- transaction cannot be used until it commits.
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'at_risk';
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'at_risk_alert';
ALTER TYPE enum_notifications_type ADD VALUE IF NOT EXISTS 'security';

BEGIN;

-- ── Users: invitations and last sign-in ─────────────────────────
-- Imported users get an invite link instead of a password. Only a
-- SHA-256 hash of the token is stored, never the token itself.
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token_hash varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at        timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at     timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_invite_token_hash_key
  ON users (invite_token_hash) WHERE invite_token_hash IS NOT NULL;

-- ── Audit trail ─────────────────────────────────────────────────
-- One row per sensitive action. actor_name/role and target_label are
-- snapshots, so the trail still reads correctly after a user or class
-- is deleted. on_behalf_of is the admin behind a "view as" session.
CREATE TABLE IF NOT EXISTS audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name    varchar(120),
  actor_role    varchar(20),
  on_behalf_of  uuid REFERENCES users(id) ON DELETE SET NULL,
  action        varchar(60)  NOT NULL,
  target_type   varchar(30),
  target_id     varchar(64),
  target_label  varchar(200),
  summary       text,
  changes       jsonb,
  ip            varchar(64),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_created_idx ON audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_action_idx  ON audit_events (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx   ON audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_target_idx  ON audit_events (target_type, target_id);

-- ── Institution-wide settings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS institution_settings (
  key         varchar(80) PRIMARY KEY,
  value       jsonb       NOT NULL,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Academic calendar ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semesters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar(80) NOT NULL,
  starts_on    date        NOT NULL,
  ends_on      date        NOT NULL,
  is_archived  boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT semesters_range_chk CHECK (ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS semesters_range_idx ON semesters (starts_on, ends_on);

CREATE TABLE IF NOT EXISTS calendar_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            varchar(120) NOT NULL,
  kind             varchar(12)  NOT NULL
                     CHECK (kind IN ('holiday', 'exam', 'break', 'event')),
  starts_on        date         NOT NULL,
  ends_on          date         NOT NULL,
  blocks_sessions  boolean      NOT NULL DEFAULT true,
  note             text,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_range_chk CHECK (ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS calendar_events_range_idx ON calendar_events (starts_on, ends_on);

-- ── Failed scan and sign-in attempts ────────────────────────────
-- Feeds the fraud review queue. Successful scans stay in attendance.
CREATE TABLE IF NOT EXISTS scan_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id)    ON DELETE CASCADE,
  session_id  uuid REFERENCES sessions(id) ON DELETE SET NULL,
  reason      varchar(30) NOT NULL,
  device_id   varchar(255),
  ip_address  varchar(64),
  geo_lat     numeric(10,8),
  geo_lng     numeric(11,8),
  distance_m  integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scan_attempts_user_idx    ON scan_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scan_attempts_session_idx ON scan_attempts (session_id, reason);

-- ── Fraud review queue ──────────────────────────────────────────
-- dedupe_key stops the same pattern being flagged twice.
CREATE TABLE IF NOT EXISTS fraud_flags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             varchar(40)  NOT NULL,
  severity         varchar(10)  NOT NULL DEFAULT 'medium'
                     CHECK (severity IN ('low', 'medium', 'high')),
  status           varchar(12)  NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'dismissed', 'actioned')),
  user_id          uuid REFERENCES users(id)    ON DELETE CASCADE,
  session_id       uuid REFERENCES sessions(id) ON DELETE SET NULL,
  class_id         uuid REFERENCES classes(id)  ON DELETE SET NULL,
  summary          varchar(300) NOT NULL,
  evidence         jsonb        NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key       varchar(200) NOT NULL UNIQUE,
  reviewed_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  resolution       varchar(30),
  resolution_note  text,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fraud_flags_status_idx ON fraud_flags (status, created_at DESC);

-- ── Announcements ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            varchar(150) NOT NULL,
  body             text         NOT NULL,
  audience         varchar(12)  NOT NULL
                     CHECK (audience IN ('all', 'role', 'class', 'department')),
  audience_value   varchar(150),
  send_in_app      boolean      NOT NULL DEFAULT true,
  send_email       boolean      NOT NULL DEFAULT false,
  status           varchar(12)  NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_for    timestamptz,
  sent_at          timestamptz,
  recipient_count  integer      NOT NULL DEFAULT 0,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_due_idx ON announcements (status, scheduled_for);

CREATE TABLE IF NOT EXISTS announcement_receipts (
  announcement_id  uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  delivered_at     timestamptz NOT NULL DEFAULT now(),
  read_at          timestamptz,
  PRIMARY KEY (announcement_id, user_id)
);

COMMIT;
