// server/src/controllers/adminCalendarController.js
const { Op, QueryTypes } = require('sequelize');
const { sequelize, Semester, CalendarEvent } = require('../models');
const { currentSemester, isoDay } = require('../services/calendarService');
const { audit } = require('../services/auditService');
const { success, error } = require('../utils/apiResponse');

/**
 * ═════════════════════════════════════════════════════════════════
 * Academic calendar: semesters, plus holidays, breaks and exam
 * periods. Events with blocks_sessions stop the timetable from
 * auto-opening sessions on those days (see services/scheduleRunner).
 * ═════════════════════════════════════════════════════════════════
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS   = ['holiday', 'exam', 'break', 'event'];

function checkRange(starts_on, ends_on) {
  if (!DATE_RE.test(starts_on ?? '') || !DATE_RE.test(ends_on ?? '')) return 'Dates must be YYYY-MM-DD';
  if (ends_on < starts_on) return 'The end date is before the start date';
  return null;
}

// Month view: events and semesters overlapping the month, and how many
// sessions opened on each day (the calendar's density shading).
exports.month = async (req, res) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month ?? '') ? req.query.month : isoDay().slice(0, 7);
    const first = `${month}-01`;
    const next  = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
    const last  = new Date(new Date(`${next}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);

    const [events, semesters, current, perDay] = await Promise.all([
      CalendarEvent.findAll({
        where: { starts_on: { [Op.lte]: last }, ends_on: { [Op.gte]: first } },
        order: [['starts_on', 'ASC']],
      }),
      Semester.findAll({ order: [['starts_on', 'DESC']] }),
      currentSemester(),
      sequelize.query(`
        SELECT (s.open_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS sessions
        FROM sessions s
        WHERE s.open_at >= :first AND s.open_at < :next
        GROUP BY 1
      `, { replacements: { first, next }, type: QueryTypes.SELECT }),
    ]);

    return res.json(success({
      month, events, semesters,
      currentSemesterId: current?.id ?? null,
      sessionsByDay: Object.fromEntries(perDay.map(r => [String(r.day).slice(0, 10), r.sessions])),
    }));
  } catch (err) {
    console.error('[Calendar] month:', err.message);
    return res.status(500).json(error('Could not load the calendar'));
  }
};

exports.saveSemester = async (req, res) => {
  try {
    const { name, starts_on, ends_on } = req.body ?? {};
    if (!String(name ?? '').trim()) return res.status(400).json(error('Give the semester a name'));
    const bad = checkRange(starts_on, ends_on);
    if (bad) return res.status(400).json(error(bad));

    // Semesters may not overlap: "current semester" must be unambiguous.
    const clash = await Semester.findOne({
      where: {
        starts_on: { [Op.lte]: ends_on },
        ends_on:   { [Op.gte]: starts_on },
        ...(req.params.id ? { id: { [Op.ne]: req.params.id } } : {}),
      },
    });
    if (clash) return res.status(409).json(error(`Overlaps with ${clash.name}`));

    const values = { name: name.trim(), starts_on, ends_on };
    let semester;
    if (req.params.id) {
      semester = await Semester.findByPk(req.params.id);
      if (!semester) return res.status(404).json(error('Semester not found'));
      await semester.update(values);
    } else {
      semester = await Semester.create(values);
    }
    await audit(req, {
      action: 'semester.saved',
      target: { type: 'semester', id: semester.id, label: semester.name },
      summary: `${req.params.id ? 'Updated' : 'Created'} ${semester.name} (${starts_on} to ${ends_on})`,
    });
    return res.status(req.params.id ? 200 : 201).json(success({ semester }, 'Semester saved'));
  } catch (err) {
    console.error('[Calendar] saveSemester:', err.message);
    return res.status(500).json(error('Could not save the semester'));
  }
};

exports.archiveSemester = async (req, res) => {
  try {
    const semester = await Semester.findByPk(req.params.id);
    if (!semester) return res.status(404).json(error('Semester not found'));
    await semester.update({ is_archived: !semester.is_archived });
    await audit(req, {
      action: 'semester.archived',
      target: { type: 'semester', id: semester.id, label: semester.name },
      summary: `${semester.is_archived ? 'Archived' : 'Restored'} ${semester.name}`,
    });
    return res.json(success({ semester }, semester.is_archived ? 'Semester archived' : 'Semester restored'));
  } catch (err) {
    return res.status(500).json(error('Could not archive the semester'));
  }
};

exports.deleteSemester = async (req, res) => {
  try {
    const semester = await Semester.findByPk(req.params.id);
    if (!semester) return res.status(404).json(error('Semester not found'));
    await semester.destroy();
    await audit(req, {
      action: 'semester.deleted',
      target: { type: 'semester', id: semester.id, label: semester.name },
      summary: `Deleted ${semester.name}. Attendance data is unaffected.`,
    });
    return res.json(success(null, 'Semester deleted'));
  } catch (err) {
    return res.status(500).json(error('Could not delete the semester'));
  }
};

exports.saveEvent = async (req, res) => {
  try {
    const { title, kind = 'holiday', starts_on, ends_on, blocks_sessions = true, note = null } = req.body ?? {};
    if (!String(title ?? '').trim()) return res.status(400).json(error('Give the event a title'));
    if (!KINDS.includes(kind)) return res.status(400).json(error('Unknown event type'));
    const bad = checkRange(starts_on, ends_on);
    if (bad) return res.status(400).json(error(bad));

    const values = { title: title.trim(), kind, starts_on, ends_on, blocks_sessions: Boolean(blocks_sessions), note };
    let event;
    if (req.params.id) {
      event = await CalendarEvent.findByPk(req.params.id);
      if (!event) return res.status(404).json(error('Event not found'));
      await event.update(values);
    } else {
      event = await CalendarEvent.create({ ...values, created_by: req.user.id });
    }
    await audit(req, {
      action: 'calendar.saved',
      target: { type: 'calendar_event', id: event.id, label: event.title },
      summary: `${req.params.id ? 'Updated' : 'Added'} ${kind} "${event.title}" (${starts_on} to ${ends_on})${event.blocks_sessions ? ', no timetabled sessions' : ''}`,
    });
    return res.status(req.params.id ? 200 : 201).json(success({ event }, 'Saved'));
  } catch (err) {
    console.error('[Calendar] saveEvent:', err.message);
    return res.status(500).json(error('Could not save the event'));
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await CalendarEvent.findByPk(req.params.id);
    if (!event) return res.status(404).json(error('Event not found'));
    await event.destroy();
    await audit(req, {
      action: 'calendar.deleted',
      target: { type: 'calendar_event', id: event.id, label: event.title },
      summary: `Removed "${event.title}"`,
    });
    return res.json(success(null, 'Event removed'));
  } catch (err) {
    return res.status(500).json(error('Could not remove the event'));
  }
};
