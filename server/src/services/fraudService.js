// server/src/services/fraudService.js
const { Op, QueryTypes } = require('sequelize');
const { sequelize, ScanAttempt, FraudFlag, AuditEvent, User } = require('../models');
const settings    = require('./settingsService');
const { opsEmit } = require('./opsFeed');
const { isoDay }  = require('./calendarService');

/**
 * ═════════════════════════════════════════════════════════════════
 * Fraud review queue: rules that FLAG suspicious patterns for an
 * admin to review. Nothing here blocks a student; the scan and sign-in
 * checks that do block live in their controllers and stay unchanged.
 *
 * Rules and where they run:
 *   proxy_device        attendance saved   several students, one phone, one session
 *   geofence_repeat     scan refused       N out-of-area scans, same student + session
 *   device_mismatch     sign-in refused    N wrong-phone sign-ins in 24 hours
 *   mock_gps            scan refused       a location-spoofing app was on
 *   identical_location  session closed     3+ students at the exact same GPS fix
 *   frequent_resets     phone reset        more resets than policy allows in 30 days
 *
 * Each flag has a dedupe key, so a pattern is flagged once and later
 * evidence updates the open flag instead of piling up duplicates.
 * Every function swallows its own errors: detection must never turn a
 * refused scan's error message, or a saved attendance, into a 500.
 * ═════════════════════════════════════════════════════════════════
 */

const KINDS = {
  proxy_device:       { label: 'One phone, several students',   severity: 'high' },
  mock_gps:           { label: 'Location spoofing app',          severity: 'high' },
  geofence_repeat:    { label: 'Repeated out-of-area scans',     severity: 'medium' },
  device_mismatch:    { label: 'Repeated wrong-phone sign-ins',  severity: 'medium' },
  identical_location: { label: 'Identical GPS positions',        severity: 'medium' },
  frequent_resets:    { label: 'Frequent phone resets',          severity: 'low' },
};

async function raise({ kind, dedupeKey, summary, userId = null, sessionId = null, classId = null, evidence = {} }) {
  try {
    const [flag, created] = await FraudFlag.findOrCreate({
      where:    { dedupe_key: dedupeKey },
      defaults: {
        kind, summary, evidence,
        severity:   KINDS[kind].severity,
        user_id:    userId,
        session_id: sessionId,
        class_id:   classId,
      },
    });
    if (!created) {
      if (flag.status === 'open') await flag.update({ summary, evidence });
      return flag;
    }
    opsEmit('ops:flag', { id: flag.id, kind, label: KINDS[kind].label, severity: flag.severity, summary });
    return flag;
  } catch (err) {
    console.warn(`[Fraud] could not raise ${kind}:`, err.message);
    return null;
  }
}

// A refused scan or sign-in. Stored, then checked against the rules.
async function recordAttempt({ userId, sessionId = null, classId = null, reason, deviceId = null, ip = null, lat = null, lng = null, distance = null }) {
  try {
    await ScanAttempt.create({
      user_id: userId, session_id: sessionId, reason,
      device_id: deviceId, ip_address: ip,
      geo_lat: lat || null, geo_lng: lng || null,
      distance_m: distance != null ? Math.round(distance) : null,
    });
  } catch (err) {
    console.warn('[Fraud] could not record attempt:', err.message);
    return;
  }

  try {
    if (reason === 'out_of_geofence' && sessionId) {
      const limit = await settings.get('fraud.geofence_attempts');
      const count = await ScanAttempt.count({ where: { user_id: userId, session_id: sessionId, reason } });
      if (count >= limit) {
        await raise({
          kind: 'geofence_repeat', dedupeKey: `geofence_repeat:${sessionId}:${userId}`,
          summary: `${count} scans from outside the classroom in one session`,
          userId, sessionId, classId,
          evidence: { attempts: count, lastDistanceM: distance != null ? Math.round(distance) : null },
        });
      }
    }

    if (reason === 'device_mismatch') {
      const limit = await settings.get('fraud.device_mismatch_attempts');
      const count = await ScanAttempt.count({
        where: { user_id: userId, reason, created_at: { [Op.gte]: new Date(Date.now() - 86_400_000) } },
      });
      if (count >= limit) {
        await raise({
          kind: 'device_mismatch', dedupeKey: `device_mismatch:${userId}:${isoDay()}`,
          summary: `${count} sign-in attempts from a different phone in 24 hours`,
          userId, evidence: { attempts: count, lastDeviceId: deviceId },
        });
      }
    }

    if (reason === 'mock_gps') {
      await raise({
        kind: 'mock_gps', dedupeKey: `mock_gps:${sessionId ?? 'none'}:${userId}`,
        summary: 'Tried to scan with a location-spoofing app switched on',
        userId, sessionId, classId, evidence: { deviceId },
      });
    }
  } catch (err) {
    console.warn('[Fraud] rule check failed:', err.message);
  }
}

// Called when the existing live check sees several students mark from
// one phone in a session. Persists what used to be a transient alert.
async function flagProxyDevice({ sessionId, classId, deviceId, students }) {
  return raise({
    kind: 'proxy_device', dedupeKey: `proxy_device:${sessionId}:${deviceId}`,
    summary: `${students.length} students marked attendance from one phone`,
    sessionId, classId, evidence: { deviceId, students },
  });
}

// Runs when a session closes.
async function sweepSession(session) {
  try {
    const clusters = await sequelize.query(`
      SELECT round(geo_lat::numeric, 6) AS lat,
             round(geo_lng::numeric, 6) AS lng,
             array_agg(DISTINCT student_id) AS ids
      FROM attendance
      WHERE session_id = :sessionId AND geo_lat IS NOT NULL AND geo_lng IS NOT NULL
      GROUP BY 1, 2
      HAVING count(DISTINCT student_id) >= 3
    `, { replacements: { sessionId: session.id }, type: QueryTypes.SELECT });

    for (const c of clusters) {
      const users = await User.findAll({ where: { id: c.ids }, attributes: ['id', 'name', 'student_id'] });
      await raise({
        kind: 'identical_location', dedupeKey: `identical_location:${session.id}:${c.lat},${c.lng}`,
        summary: `${users.length} students scanned from the exact same GPS position`,
        sessionId: session.id, classId: session.class_id,
        evidence: {
          lat: Number(c.lat), lng: Number(c.lng),
          students: users.map(u => ({ id: u.id, name: u.name, studentId_display: u.student_id ?? '' })),
        },
      });
    }
  } catch (err) {
    console.warn('[Fraud] session sweep failed:', err.message);
  }
}

// Called after an admin resets a student's phone registration.
async function checkDeviceResets(userId) {
  try {
    const limit = await settings.get('device.reset_limit_30d');
    const count = await AuditEvent.count({
      where: {
        action: 'user.device_reset', target_id: String(userId),
        created_at: { [Op.gte]: new Date(Date.now() - 30 * 86_400_000) },
      },
    });
    if (count > limit) {
      await raise({
        kind: 'frequent_resets', dedupeKey: `frequent_resets:${userId}:${isoDay().slice(0, 7)}`,
        summary: `Phone registration reset ${count} times in 30 days (policy: ${limit})`,
        userId, evidence: { resets: count, limit },
      });
    }
  } catch (err) {
    console.warn('[Fraud] reset check failed:', err.message);
  }
}

module.exports = { KINDS, raise, recordAttempt, flagProxyDevice, sweepSession, checkDeviceResets };
