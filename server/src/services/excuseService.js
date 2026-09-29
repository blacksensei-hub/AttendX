// server/src/services/excuseService.js
const { Op } = require('sequelize');
const { ExcuseRequest, Session, Attendance, AttendanceAdjustment, Enrollment } = require('../models');
const { isoDay } = require('./calendarService');

/**
 * ═════════════════════════════════════════════════════════════════
 * Excused absences.
 *
 * A student asks for a date range in one class to be excused. When the
 * owner or a co-lecturer approves it:
 *   - absences already recorded in that range become 'excused'
 *     (sessions they were expected at with no row get an 'excused' row)
 *   - sessions that close later in the range record 'excused' instead
 *     of 'absent' (sessionLifecycle.backfillAbsences asks excusedFor)
 * Present and late are never touched. Every change is written to
 * attendance_adjustments like a manual adjustment, so the session's
 * audit trail shows why the status changed.
 * ═════════════════════════════════════════════════════════════════
 */

const REASONS = {
  medical:     'Illness or medical',
  bereavement: 'Bereavement',
  university:  'University business',
  religious:   'Religious observance',
  family:      'Family emergency',
  other:       'Other',
};

const DAY_MS = 86_400_000;
const dayStart = (day) => new Date(`${day}T00:00:00Z`);

function rangeLabel(from, to) {
  const fmt = (d, withYear) => dayStart(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  });
  return from === to ? fmt(from, true) : `${fmt(from, false)} to ${fmt(to, true)}`;
}

// Closed sessions of the request's class inside its date range.
function sessionsInRange(excuse, extra = {}) {
  return Session.findAll({
    where: {
      class_id: excuse.class_id,
      open_at:  { [Op.gte]: dayStart(excuse.date_from), [Op.lt]: new Date(dayStart(excuse.date_to).getTime() + DAY_MS) },
      ...extra,
    },
    attributes: ['id', 'title', 'open_at', 'status'],
    order: [['open_at', 'ASC']],
  });
}

/**
 * What approving would change, for the reviewer: the closed sessions
 * in range and this student's status at each (null = no row yet).
 */
async function preview(excuse) {
  const [sessions, enrolment] = await Promise.all([
    sessionsInRange(excuse, { status: 'closed' }),
    Enrollment.findOne({ where: { class_id: excuse.class_id, student_id: excuse.student_id }, attributes: ['enrolled_at'] }),
  ]);
  const rows = sessions.length
    ? await Attendance.findAll({ where: { session_id: sessions.map(s => s.id), student_id: excuse.student_id }, attributes: ['session_id', 'status'] })
    : [];
  const status = new Map(rows.map(r => [r.session_id, r.status]));
  return sessions
    .filter(s => status.has(s.id) || !enrolment?.enrolled_at || s.open_at >= enrolment.enrolled_at)
    .map(s => ({ sessionId: s.id, title: s.title, openAt: s.open_at, status: status.get(s.id) ?? 'absent' }));
}

// Turn the range's absences into 'excused'. Returns how many changed.
async function applyExcuse(excuse, actorId) {
  const affected = (await preview(excuse)).filter(p => p.status === 'absent');
  const reason = `Excused absence approved: ${REASONS[excuse.reason] ?? excuse.reason}`;
  for (const p of affected) {
    const [row, created] = await Attendance.findOrCreate({
      where:    { session_id: p.sessionId, student_id: excuse.student_id },
      defaults: { status: 'excused', marked_at: p.openAt },
    });
    if (!created) {
      if (row.status !== 'absent') continue;   // changed since the preview
      await row.update({ status: 'excused' });
    }
    await AttendanceAdjustment.create({
      attendance_id: row.id,
      session_id:    p.sessionId,
      student_id:    excuse.student_id,
      adjusted_by:   actorId,
      old_status:    'absent',
      new_status:    'excused',
      reason,
    });
  }
  return affected.length;
}

/**
 * Students of this session's class with an approved excuse covering the
 * day it ran. Never throws: before the migration the table is missing,
 * and closing a session must still record absences.
 */
async function excusedFor(session) {
  try {
    const day = isoDay(session.open_at ?? new Date());
    const rows = await ExcuseRequest.findAll({
      where: { class_id: session.class_id, status: 'approved', date_from: { [Op.lte]: day }, date_to: { [Op.gte]: day } },
      attributes: ['student_id'],
    });
    return new Set(rows.map(r => r.student_id));
  } catch {
    return new Set();
  }
}

module.exports = { REASONS, rangeLabel, preview, applyExcuse, excusedFor };
