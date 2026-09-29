// server/src/services/timetableService.js
const { Op } = require('sequelize');
const { Class, ClassSchedule, Session, CalendarEvent } = require('../models');
const { isoDay } = require('./calendarService');

/**
 * ═════════════════════════════════════════════════════════════════
 * Timetables: a class's weekly schedule expanded into dated slots.
 *
 * Times are the institution's wall clock, which is UTC (Ghana, GMT,
 * no daylight saving) — the same clock the schedule runner opens
 * sessions on. A slot is matched to the session that was opened for
 * it: the first session of that class opened between 30 minutes
 * before and 90 minutes after the slot starts (the rule the admin
 * console's lecturer-reliability report uses).
 *
 * Slot states:
 *   held      a session ran and has closed
 *   live      a session is open now
 *   blocked   a holiday, break or exam period stops sessions that day
 *   missed    the slot has passed and no session was opened
 *   upcoming  still to come
 * ═════════════════════════════════════════════════════════════════
 */

const DAY_MS = 86_400_000;
const MATCH_BEFORE_MS = 30 * 60_000;
const MATCH_AFTER_MS  = 90 * 60_000;

// "CS301 Databases", unless the name already starts with its code.
const classLabel = (code, name) => (name?.toUpperCase().startsWith(String(code ?? '').toUpperCase()) ? name : `${code} ${name}`);

const addDays = (day, n) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));

// Monday of the week containing `day` (YYYY-MM-DD).
function mondayOf(day = isoDay()) {
  const d = new Date(`${day}T00:00:00Z`);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}

const hhmm = (time) => String(time).slice(0, 5);
const slotStart = (day, time) => new Date(`${day}T${hhmm(time)}:00Z`);

// Date of a schedule's weekday within the week starting `monday`.
const dayInWeek = (monday, dow) => addDays(monday, (dow + 6) % 7);

async function blockingEvents(fromDay, toDay) {
  try {
    return await CalendarEvent.findAll({
      where: { starts_on: { [Op.lte]: toDay }, ends_on: { [Op.gte]: fromDay } },
      order: [['starts_on', 'ASC']],
    });
  } catch {
    return [];   // calendar tables missing: behave as before the calendar existed
  }
}
const blockOn = (events, day) =>
  events.find(e => e.blocks_sessions && e.starts_on <= day && e.ends_on >= day) ?? null;

/**
 * Every slot of `classIds` in the week starting `monday`, with the
 * session that ran for it. Sessions that didn't match a slot (opened
 * by hand at another time) are returned as `extra`.
 */
async function weekTimetable(classIds, monday = mondayOf()) {
  const sunday = addDays(monday, 6);
  if (classIds.length === 0) return { week: { start: monday, end: sunday }, classes: [], slots: [], extra: [], events: [] };

  const weekFrom = new Date(`${monday}T00:00:00Z`);
  const weekTo   = new Date(weekFrom.getTime() + 7 * DAY_MS);
  const [classes, schedules, sessions, events] = await Promise.all([
    Class.findAll({ where: { id: classIds }, attributes: ['id', 'name', 'code', 'location_name', 'lecturer_id'] }),
    ClassSchedule.findAll({ where: { class_id: classIds, is_active: true }, order: [['start_time', 'ASC']] }),
    Session.findAll({
      where: {
        class_id: classIds,
        open_at:  { [Op.gte]: new Date(weekFrom.getTime() - MATCH_AFTER_MS), [Op.lt]: new Date(weekTo.getTime() + MATCH_BEFORE_MS) },
        status:   { [Op.ne]: 'cancelled' },
      },
      attributes: ['id', 'class_id', 'title', 'status', 'open_at', 'closed_at'],
      order: [['open_at', 'ASC']],
    }),
    blockingEvents(monday, sunday),
  ]);

  const now = Date.now();
  const used = new Set();
  const slots = schedules.map(sch => {
    const day = dayInWeek(monday, sch.day_of_week);
    const start = slotStart(day, sch.start_time);
    const end = new Date(start.getTime() + sch.duration_mins * 60_000);
    const session = sessions.find(s => !used.has(s.id) && s.class_id === sch.class_id
      && s.open_at >= new Date(start.getTime() - MATCH_BEFORE_MS)
      && s.open_at <= new Date(start.getTime() + MATCH_AFTER_MS));
    if (session) used.add(session.id);
    const block = blockOn(events, day);
    const state = session
      ? (session.status === 'open' ? 'live' : 'held')
      : block ? 'blocked'
      : end.getTime() < now ? 'missed'
      : 'upcoming';
    return {
      id:        `${sch.id}:${day}`,
      scheduleId: sch.id,
      classId:   sch.class_id,
      day,
      weekday:   sch.day_of_week,
      start:     hhmm(sch.start_time),
      end:       end.toISOString().slice(11, 16),
      duration:  sch.duration_mins,
      startsAt:  start.toISOString(),
      endsAt:    end.toISOString(),
      state,
      blockedBy: block ? { title: block.title, kind: block.kind } : null,
      session:   session ? { id: session.id, status: session.status, openAt: session.open_at } : null,
    };
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const extra = sessions
    .filter(s => !used.has(s.id) && s.open_at >= weekFrom && s.open_at < weekTo)
    .map(s => ({ id: s.id, classId: s.class_id, title: s.title, status: s.status, openAt: s.open_at }));

  return {
    week: { start: monday, end: sunday },
    classes: classes.map(c => ({ id: c.id, name: c.name, code: c.code, location: c.location_name, lecturerId: c.lecturer_id })),
    slots,
    extra,
    events: events.map(e => ({ id: e.id, title: e.title, kind: e.kind, startsOn: e.starts_on, endsOn: e.ends_on, blocksSessions: e.blocks_sessions })),
  };
}

/**
 * How many timetabled slots of each class are still to come between
 * `from` and the end of `untilDay` (inclusive), skipping blocked days.
 * Used by the student planner. Returns Map(classId → count).
 */
async function remainingSlots(classIds, untilDay, from = new Date()) {
  const counts = new Map(classIds.map(id => [id, 0]));
  if (classIds.length === 0 || !untilDay) return counts;
  const fromDay = isoDay(from);
  if (untilDay < fromDay) return counts;
  const [schedules, events] = await Promise.all([
    ClassSchedule.findAll({ where: { class_id: classIds, is_active: true } }),
    blockingEvents(fromDay, untilDay),
  ]);
  for (let day = fromDay; day <= untilDay; day = addDays(day, 1)) {
    if (blockOn(events, day)) continue;
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    for (const sch of schedules) {
      if (sch.day_of_week !== dow) continue;
      if (slotStart(day, sch.start_time).getTime() <= from.getTime()) continue;   // already started
      counts.set(sch.class_id, (counts.get(sch.class_id) ?? 0) + 1);
    }
  }
  return counts;
}

// The next `limit` slots across `classIds`, from now.
async function upcomingSlots(classIds, { limit = 5, days = 14 } = {}) {
  if (classIds.length === 0) return [];
  const today = isoDay();
  const weeks = [mondayOf(today)];
  for (let i = 1; i * 7 < days + 7; i += 1) weeks.push(addDays(weeks[0], i * 7));
  const all = (await Promise.all(weeks.map(w => weekTimetable(classIds, w))));
  const classes = new Map(all[0].classes.map(c => [c.id, c]));
  return all.flatMap(w => w.slots)
    .filter(s => (s.state === 'upcoming' || s.state === 'live') && Date.parse(s.endsAt) > Date.now())
    .slice(0, limit)
    .map(s => ({ ...s, className: classes.get(s.classId)?.name, classCode: classes.get(s.classId)?.code, location: classes.get(s.classId)?.location }));
}

// ─── iCalendar feed ─────────────────────────────────────────────
// RFC 5545: CRLF line ends, lines folded at 75 octets, text escaped.
const icsEscape = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsStamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDay = (day) => day.replace(/-/g, '');

function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let chunk = '';
  for (const ch of line) {
    if (Buffer.byteLength(chunk + ch, 'utf8') > (parts.length ? 74 : 75)) { parts.push(chunk); chunk = ''; }
    chunk += ch;
  }
  parts.push(chunk);
  return parts.join('\r\n ');
}

/**
 * A weekly recurring event per timetable slot, from the first
 * occurrence on or after `fromDay` until `untilDay` (open-ended when
 * null), with the blocked days removed, plus all-day entries for
 * holidays and exam periods so the calendar shows why.
 */
async function buildIcs({ name, classIds, fromDay, untilDay }) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AttendX//Timetable//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(name)}`, 'X-WR-TIMEZONE:Africa/Accra', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H',
  ];
  const stamp = icsStamp(new Date());
  const horizon = untilDay ?? addDays(isoDay(), 365);
  const [classes, schedules, events] = classIds.length ? await Promise.all([
    Class.findAll({ where: { id: classIds }, attributes: ['id', 'name', 'code', 'location_name'] }),
    ClassSchedule.findAll({ where: { class_id: classIds, is_active: true } }),
    blockingEvents(fromDay, horizon),
  ]) : [[], [], await blockingEvents(fromDay, horizon)];
  const byId = new Map(classes.map(c => [c.id, c]));

  for (const sch of schedules) {
    const cls = byId.get(sch.class_id);
    if (!cls) continue;
    const firstDay = addDays(fromDay, (sch.day_of_week - new Date(`${fromDay}T00:00:00Z`).getUTCDay() + 7) % 7);
    if (firstDay > horizon) continue;
    const start = slotStart(firstDay, sch.start_time);
    const end = new Date(start.getTime() + sch.duration_mins * 60_000);
    const exdates = [];
    for (let day = firstDay; day <= horizon; day = addDays(day, 7)) {
      if (blockOn(events, day)) exdates.push(icsStamp(slotStart(day, sch.start_time)));
    }
    lines.push(
      'BEGIN:VEVENT',
      `UID:${sch.id}@attendx`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `RRULE:FREQ=WEEKLY${untilDay ? `;UNTIL=${icsDay(untilDay)}T235959Z` : ''}`,
      ...(exdates.length ? [`EXDATE:${exdates.join(',')}`] : []),
      `SUMMARY:${icsEscape(classLabel(cls.code, cls.name))}`,
      ...(cls.location_name ? [`LOCATION:${icsEscape(cls.location_name)}`] : []),
      `DESCRIPTION:${icsEscape('Scan in with AttendX when the session opens.')}`,
      'END:VEVENT',
    );
  }
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:event-${e.id}@attendx`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDay(e.starts_on)}`,
      `DTEND;VALUE=DATE:${icsDay(addDays(e.ends_on, 1))}`,
      `SUMMARY:${icsEscape(e.blocks_sessions ? `${e.title} (no classes)` : e.title)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = { classLabel, addDays, mondayOf, weekTimetable, remainingSlots, upcomingSlots, buildIcs };
