// server/src/services/settingsService.js
const { InstitutionSetting } = require('../models');

/**
 * ═════════════════════════════════════════════════════════════════
 * Institution-wide policy settings.
 *
 * Every setting has a default here, so the app behaves exactly as it
 * did before an admin ever opens the settings page (and keeps working
 * if the settings table is missing). Values are cached for 30 seconds;
 * saving through set() clears the cache immediately.
 * ═════════════════════════════════════════════════════════════════
 */

const SCHEMA = {
  'session.late_threshold_min':  { type: 'int',  min: 0,   max: 120, default: 15,
    label: 'Late after (minutes)', help: 'A scan this long after a session opens counts as late.' },
  'session.qr_interval_sec':     { type: 'int',  min: 3,   max: 60,  default: 5,
    label: 'QR code changes every (seconds)', help: 'Shorter is harder to share by screenshot.' },
  'class.default_geofence_m':    { type: 'int',  min: 20,  max: 2000, default: 100,
    label: 'Default classroom radius (metres)', help: 'Used when a lecturer creates a class without setting one.' },
  'class.default_threshold_pct': { type: 'int',  min: 0,   max: 100, default: 75,
    label: 'Default minimum attendance (%)', help: 'Students below this are flagged at risk.' },
  'device.reset_limit_30d':      { type: 'int',  min: 1,   max: 20,  default: 2,
    label: 'Phone resets before a flag (per 30 days)', help: 'More resets than this raises a fraud flag for review.' },
  'fraud.geofence_attempts':     { type: 'int',  min: 2,   max: 20,  default: 3,
    label: 'Out-of-area scans before a flag', help: 'Per student, per session.' },
  'fraud.device_mismatch_attempts': { type: 'int', min: 2, max: 20, default: 3,
    label: 'Wrong-phone sign-ins before a flag', help: 'Per student, within 24 hours.' },
  'digest.enabled':              { type: 'bool', default: true,
    label: 'Weekly digest email', help: 'A summary sent to every active admin.' },
  'digest.weekday':              { type: 'int',  min: 0,   max: 6,   default: 1,
    label: 'Digest day', help: '0 is Sunday, 1 is Monday.' },
  'digest.hour':                 { type: 'int',  min: 0,   max: 23,  default: 7,
    label: 'Digest hour (server time)', help: '' },
};

const TTL_MS = 30_000;
let cache = null;
let cachedAt = 0;

async function loadAll() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  const values = Object.fromEntries(Object.entries(SCHEMA).map(([k, s]) => [k, s.default]));
  try {
    const rows = await InstitutionSetting.findAll();
    for (const row of rows) if (row.key in values) values[row.key] = row.value;
  } catch (err) {
    console.warn('[Settings] using defaults:', err.message);
  }
  cache = values;
  cachedAt = Date.now();
  return values;
}

async function get(key) {
  const all = await loadAll();
  return all[key];
}

// Validates and coerces one value against its schema entry.
function coerce(key, raw) {
  const spec = SCHEMA[key];
  if (!spec) throw new Error(`Unknown setting: ${key}`);
  if (spec.type === 'bool') return raw === true || raw === 'true';
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`${spec.label} must be a whole number`);
  if (n < spec.min || n > spec.max) throw new Error(`${spec.label} must be between ${spec.min} and ${spec.max}`);
  return n;
}

// Saves several settings at once. Returns [key, before, after] for each
// value that actually changed, for the audit trail.
async function setMany(patch, userId) {
  const current = await loadAll();
  const changed = [];
  for (const [key, raw] of Object.entries(patch)) {
    const value = coerce(key, raw);
    if (current[key] === value) continue;
    await InstitutionSetting.upsert({ key, value, updated_by: userId });
    changed.push([key, current[key], value]);
  }
  cache = null;
  return changed;
}

// Internal bookkeeping values (e.g. when the digest last went out) use
// the same table under a "_" prefix, outside the admin-editable schema.
async function getInternal(key) {
  try {
    const row = await InstitutionSetting.findByPk(`_${key}`);
    return row?.value ?? null;
  } catch {
    return null;
  }
}
async function setInternal(key, value) {
  await InstitutionSetting.upsert({ key: `_${key}`, value });
}

module.exports = { SCHEMA, loadAll, get, setMany, getInternal, setInternal };
