// server/src/services/calendarService.js
const { Op } = require('sequelize');
const { Semester, CalendarEvent } = require('../models');

/**
 * ═════════════════════════════════════════════════════════════════
 * Academic calendar helpers: which semester is current, what date
 * range a report covers, and whether a day is blocked for sessions.
 *
 * Dates are compared as YYYY-MM-DD strings in UTC, which is also
 * Ghana's local time (GMT, no daylight saving).
 *
 * With no semesters defined, reports fall back to all time, so the
 * app behaves as it did before the calendar existed.
 * ═════════════════════════════════════════════════════════════════
 */

const isoDay = (d = new Date()) => new Date(d).toISOString().slice(0, 10);

async function currentSemester(on = new Date()) {
  try {
    const day = isoDay(on);
    return await Semester.findOne({
      where: { is_archived: false, starts_on: { [Op.lte]: day }, ends_on: { [Op.gte]: day } },
      order: [['starts_on', 'DESC']],
    });
  } catch {
    return null;
  }
}

async function previousSemester(sem) {
  if (!sem) return null;
  return Semester.findOne({
    where: { ends_on: { [Op.lt]: sem.starts_on } },
    order: [['ends_on', 'DESC']],
  });
}

// Turns report query params into a concrete range. `to` is exclusive
// (the start of the day after the last day) so it can be used directly
// in `open_at < to` comparisons.
async function resolveRange({ semesterId, from, to } = {}) {
  if (from || to) {
    return {
      from:  from ? new Date(`${from}T00:00:00Z`) : null,
      to:    to   ? new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000) : null,
      label: `${from ?? 'Start'} to ${to ?? 'today'}`,
      semester: null,
    };
  }
  if (semesterId === 'all') return { from: null, to: null, label: 'All time', semester: null };
  const semester = semesterId
    ? await Semester.findByPk(semesterId).catch(() => null)
    : await currentSemester();
  if (!semester) return { from: null, to: null, label: 'All time', semester: null };
  return {
    from:  new Date(`${semester.starts_on}T00:00:00Z`),
    to:    new Date(new Date(`${semester.ends_on}T00:00:00Z`).getTime() + 86_400_000),
    label: semester.name,
    semester,
  };
}

// The holiday, break or exam period that stops sessions on this day, if any.
async function blockingEventOn(date = new Date()) {
  try {
    const day = isoDay(date);
    return await CalendarEvent.findOne({
      where: { blocks_sessions: true, starts_on: { [Op.lte]: day }, ends_on: { [Op.gte]: day } },
    });
  } catch {
    return null;
  }
}

module.exports = { isoDay, currentSemester, previousSemester, resolveRange, blockingEventOn };
