// server/src/services/metricsService.js
const { Op, QueryTypes } = require('sequelize');
const { sequelize, ClassSchedule, Class, User, Session, CalendarEvent } = require('../models');

/**
 * ═════════════════════════════════════════════════════════════════
 * Institution-wide attendance numbers, shared by the analytics page,
 * the admin overview, the weekly digest and the PDF report so they
 * can never disagree.
 *
 * The rule matches the lecturer and student dashboards: a student is
 * expected at every CLOSED session of a class they are enrolled in,
 * held after they enrolled; present and late both count as attended.
 *
 * Every function takes a range { from, to } (Dates, `to` exclusive;
 * either may be null for "open-ended") from calendarService.resolveRange.
 * ═════════════════════════════════════════════════════════════════
 */

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

function rangeSql(range, col = 's.open_at') {
  const parts = [];
  const replacements = {};
  if (range?.from) { parts.push(`${col} >= :from`); replacements.from = range.from; }
  if (range?.to)   { parts.push(`${col} < :to`);    replacements.to   = range.to; }
  return { sql: parts.length ? `AND ${parts.join(' AND ')}` : '', replacements };
}

// Expected (student, session) slots and whether each was attended.
const SLOTS = `
  FROM sessions s
  JOIN classes     c ON c.id = s.class_id
  JOIN enrollments e ON e.class_id = s.class_id
                    AND s.open_at >= COALESCE(e.enrolled_at, s.open_at)
  LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
  WHERE s.status = 'closed'
`;
const ATTENDED = `count(a.id) FILTER (WHERE a.status IN ('present', 'late'))`;

const q = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

async function overall(range) {
  const r = rangeSql(range);
  const [row] = await q(`
    SELECT count(DISTINCT s.id)                           AS sessions,
           count(e.student_id)                            AS expected,
           ${ATTENDED}                                    AS attended,
           count(a.id) FILTER (WHERE a.status = 'late')   AS late
    ${SLOTS} ${r.sql}
  `, r.replacements);
  const expected = Number(row.expected), attended = Number(row.attended);
  return {
    sessions: Number(row.sessions),
    expected, attended,
    late:     Number(row.late),
    rate:     pct(attended, expected),
  };
}

async function byDepartment(range) {
  const r = rangeSql(range);
  const rows = await q(`
    SELECT COALESCE(NULLIF(trim(c.department), ''), 'Unassigned') AS department,
           count(DISTINCT s.id)       AS sessions,
           count(DISTINCT c.id)       AS classes,
           count(e.student_id)        AS expected,
           ${ATTENDED}                AS attended
    ${SLOTS} ${r.sql}
    GROUP BY 1
    ORDER BY 1
  `, r.replacements);
  return rows.map(x => ({
    department: x.department,
    sessions:   Number(x.sessions),
    classes:    Number(x.classes),
    expected:   Number(x.expected),
    attended:   Number(x.attended),
    rate:       pct(Number(x.attended), Number(x.expected)),
  }));
}

// Sessions and attendance by ISO weekday (1 = Monday) and hour of day.
async function weekdayHour(range) {
  const r = rangeSql(range);
  const rows = await q(`
    SELECT extract(isodow FROM s.open_at)::int AS weekday,
           extract(hour   FROM s.open_at)::int AS hour,
           count(DISTINCT s.id)                AS sessions,
           count(e.student_id)                 AS expected,
           ${ATTENDED}                         AS attended
    ${SLOTS} ${r.sql}
    GROUP BY 1, 2
  `, r.replacements);
  return rows.map(x => ({
    weekday:  x.weekday,
    hour:     x.hour,
    sessions: Number(x.sessions),
    rate:     pct(Number(x.attended), Number(x.expected)),
  }));
}

async function weeklyTrend(range) {
  const r = rangeSql(range);
  const rows = await q(`
    SELECT date_trunc('week', s.open_at)::date AS week,
           count(DISTINCT s.id)                AS sessions,
           count(e.student_id)                 AS expected,
           ${ATTENDED}                         AS attended
    ${SLOTS} ${r.sql}
    GROUP BY 1
    ORDER BY 1
  `, r.replacements);
  return rows.map(x => ({
    week:     x.week,
    sessions: Number(x.sessions),
    rate:     pct(Number(x.attended), Number(x.expected)),
  }));
}

async function perClass(range) {
  const r = rangeSql(range);
  const rows = await q(`
    SELECT c.id, c.name, c.code, c.department, c.lecturer_id AS "lecturerId",
           u.name                  AS "lecturerName",
           count(DISTINCT s.id)    AS sessions,
           count(e.student_id)     AS expected,
           ${ATTENDED}             AS attended
    FROM sessions s
    JOIN classes     c ON c.id = s.class_id
    JOIN enrollments e ON e.class_id = s.class_id
                      AND s.open_at >= COALESCE(e.enrolled_at, s.open_at)
    LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
    LEFT JOIN users      u ON u.id = c.lecturer_id
    WHERE s.status = 'closed' ${r.sql}
    GROUP BY c.id, c.name, c.code, c.department, c.lecturer_id, u.name
  `, r.replacements);
  return rows.map(x => ({
    ...x,
    sessions: Number(x.sessions),
    expected: Number(x.expected),
    attended: Number(x.attended),
    rate:     pct(Number(x.attended), Number(x.expected)),
  }));
}

// Students below their class's minimum, with at least 3 sessions held
// (one missed lecture shouldn't make a student "at risk").
async function atRisk(range, { limit = 500 } = {}) {
  const r = rangeSql(range);
  const rows = await q(`
    SELECT u.id AS "userId", u.name, u.email, u.student_id AS "studentNumber",
           c.id AS "classId", c.name AS "className", c.attendance_threshold AS threshold,
           count(s.id) AS held,
           ${ATTENDED} AS attended
    FROM enrollments e
    JOIN users   u ON u.id = e.student_id AND u.is_active
    JOIN classes c ON c.id = e.class_id
    JOIN sessions s ON s.class_id = e.class_id AND s.status = 'closed'
                   AND s.open_at >= COALESCE(e.enrolled_at, s.open_at) ${r.sql}
    LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
    GROUP BY u.id, u.name, u.email, u.student_id, c.id, c.name, c.attendance_threshold
    HAVING count(s.id) >= 3
       AND 100.0 * ${ATTENDED} / count(s.id) < c.attendance_threshold
    ORDER BY 100.0 * ${ATTENDED} / count(s.id) ASC
    LIMIT :limit
  `, { ...r.replacements, limit });
  return rows.map(x => ({
    ...x,
    held:     Number(x.held),
    attended: Number(x.attended),
    rate:     pct(Number(x.attended), Number(x.held)),
  }));
}

/**
 * Lecturer reliability against the timetable.
 *
 * Expands each active weekly schedule into dated slots inside the range
 * (skipping days blocked by the calendar and slots from before the
 * schedule existed), then matches each slot to a session of that class
 * opened within 30 minutes before to 90 minutes after the slot start.
 *   missed      no matching session
 *   lateStart   opened more than 10 minutes after the slot start
 *   shortRun    closed after less than half the slot's length
 * With no range the window is the last 8 weeks, so the expansion stays small.
 */
async function lecturerReliability(range) {
  const now  = new Date();
  const to   = range?.to && range.to < now ? range.to : now;
  const from = range?.from ?? new Date(to.getTime() - 56 * 86_400_000);

  const schedules = await ClassSchedule.findAll({
    where:   { is_active: true },
    include: [{
      model: Class, as: 'class', attributes: ['id', 'name', 'lecturer_id'],
      include: [{ model: User, as: 'lecturer', attributes: ['id', 'name'] }],
    }],
  });
  const classIds = [...new Set(schedules.map(s => s.class_id))];
  const sessions = classIds.length ? await Session.findAll({
    where: { class_id: classIds, open_at: { [Op.gte]: new Date(from.getTime() - 3_600_000), [Op.lt]: to } },
    attributes: ['id', 'class_id', 'open_at', 'closed_at'],
  }) : [];
  let blocked = [];
  try {
    blocked = await CalendarEvent.findAll({
      where: {
        blocks_sessions: true,
        starts_on: { [Op.lte]: to.toISOString().slice(0, 10) },
        ends_on:   { [Op.gte]: from.toISOString().slice(0, 10) },
      },
    });
  } catch { /* calendar table not migrated yet: no blocked days */ }
  const isBlocked = (day) => blocked.some(ev => ev.starts_on <= day && ev.ends_on >= day);

  const byClass = new Map();
  for (const s of sessions) {
    if (!byClass.has(s.class_id)) byClass.set(s.class_id, []);
    byClass.get(s.class_id).push(s);
  }

  const lecturers = new Map();
  for (const sched of schedules) {
    const lec = sched.class?.lecturer;
    if (!lec) continue;
    if (!lecturers.has(lec.id)) {
      lecturers.set(lec.id, { lecturerId: lec.id, name: lec.name, slots: 0, held: 0, missed: 0, lateStarts: 0, shortRuns: 0, classes: new Set() });
    }
    const agg = lecturers.get(lec.id);
    agg.classes.add(sched.class.name);

    const [hh, mm] = String(sched.start_time).split(':').map(Number);
    const createdAt = sched.created_at ? new Date(sched.created_at) : from;
    const candidates = byClass.get(sched.class_id) ?? [];

    for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); d < to; d = new Date(d.getTime() + 86_400_000)) {
      if (d.getUTCDay() !== sched.day_of_week) continue;
      const slotStart = new Date(d.getTime() + (hh * 60 + mm) * 60_000);
      if (slotStart < from || slotStart > to || slotStart < createdAt) continue;
      const day = d.toISOString().slice(0, 10);
      if (isBlocked(day)) continue;

      agg.slots += 1;
      const match = candidates.find(s => {
        const t = new Date(s.open_at).getTime();
        return t >= slotStart.getTime() - 30 * 60_000 && t <= slotStart.getTime() + 90 * 60_000;
      });
      if (!match) { agg.missed += 1; continue; }
      agg.held += 1;
      if (new Date(match.open_at) - slotStart > 10 * 60_000) agg.lateStarts += 1;
      if (match.closed_at && (new Date(match.closed_at) - new Date(match.open_at)) < sched.duration_mins * 30_000) agg.shortRuns += 1;
    }
  }

  return [...lecturers.values()].map(l => ({
    ...l,
    classes: [...l.classes],
    heldRate: pct(l.held, l.slots),
  })).sort((a, b) => a.heldRate - b.heldRate);
}

// atRisk() returns one row per (student, class); a student can be at
// risk in several classes but is one person.
const distinctStudents = (rows) => new Set(rows.map(r => r.userId)).size;

module.exports = { pct, distinctStudents, overall, byDepartment, weekdayHour, weeklyTrend, perClass, atRisk, lecturerReliability };
