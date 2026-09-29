// server/src/controllers/meController.js
const crypto = require('crypto');
const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, Class, ClassSchedule, Enrollment, User, ExcuseRequest, UserPreference, Semester,
} = require('../models');
const { success, error } = require('../utils/apiResponse');
const { isoDay, currentSemester, resolveRange } = require('../services/calendarService');
const { weekTimetable, mondayOf, remainingSlots, upcomingSlots, buildIcs, addDays, classLabel } = require('../services/timetableService');
const { REASONS, rangeLabel } = require('../services/excuseService');
const { classIdsFor, reviewersOf, isUuid } = require('../services/classAccess');
const { createNotification } = require('../services/notificationService');
const { sendExcuseRequestEmail } = require('../services/emailService');
const { excuseJson } = require('./teachingController');

/**
 * ═════════════════════════════════════════════════════════════════
 * The signed-in user's own tools.
 *
 *   timetable     this week's classes with what happened at each
 *   planner       per class: where they stand, the sessions still to
 *                 come this semester, and what it takes to reach the
 *                 minimum (the maths runs in the browser)
 *   preferences   class reminder lead time, private calendar feed
 *   excuses       ask for an absence to be excused, or withdraw it
 *   statement     an attendance statement PDF for a semester
 *
 * Timetable and calendar feed work for lecturers too (the classes they
 * teach); the rest is for students.
 * ═════════════════════════════════════════════════════════════════
 */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

async function myClassIds(user) {
  if (user.role === 'student') {
    return (await Enrollment.findAll({ where: { student_id: user.id }, attributes: ['class_id'] })).map(e => e.class_id);
  }
  if (user.role === 'lecturer') return classIdsFor(user.id);
  return [];
}

// Per class, the student's register numbers (same rule as history and
// reports), optionally limited to a date range.
function registerTotals(studentId, { from = null, to = null } = {}) {
  return sequelize.query(`
    SELECT c.id, c.name, c.code, c.attendance_threshold AS threshold, c.department,
           u.name AS "lecturerName",
           count(s.id)::int                                           AS held,
           count(s.id) FILTER (WHERE a.status = 'present')::int       AS present,
           count(s.id) FILTER (WHERE a.status = 'late')::int          AS late,
           count(s.id) FILTER (WHERE a.status = 'excused')::int       AS excused
      FROM enrollments e
      JOIN classes c   ON c.id = e.class_id
      LEFT JOIN users u ON u.id = c.lecturer_id
      LEFT JOIN sessions s ON s.class_id = e.class_id AND s.status = 'closed'
           ${from ? 'AND s.open_at >= :from' : ''} ${to ? 'AND s.open_at < :to' : ''}
           AND (s.open_at >= COALESCE(e.enrolled_at, s.open_at)
                OR EXISTS (SELECT 1 FROM attendance x WHERE x.session_id = s.id AND x.student_id = e.student_id
                                                        AND x.status IN ('present', 'late', 'excused')))
      LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
     WHERE e.student_id = :studentId
     GROUP BY c.id, u.name
     ORDER BY c.name
  `, { replacements: { studentId, from, to }, type: QueryTypes.SELECT });
}

const withRates = (r) => {
  const counted = r.present + r.late + r.excused;
  return { ...r, counted, absent: r.held - counted, rate: pct(counted, r.held) };
};

// ─── Timetable ──────────────────────────────────────────────────
// GET /me/timetable?week=YYYY-MM-DD
exports.timetable = async (req, res) => {
  try {
    const ids = await myClassIds(req.user);
    const week = DAY_RE.test(req.query.week ?? '') ? req.query.week : undefined;
    const tt = await weekTimetable(ids, mondayOf(week));

    // A student sees their own result at each session that ran.
    if (req.user.role === 'student') {
      const sessionIds = tt.slots.filter(s => s.session).map(s => s.session.id);
      const rows = sessionIds.length ? await sequelize.query(
        'SELECT session_id, status FROM attendance WHERE student_id = :me AND session_id IN (:sessionIds)',
        { replacements: { me: req.user.id, sessionIds }, type: QueryTypes.SELECT },
      ) : [];
      const mine = new Map(rows.map(r => [r.session_id, r.status]));
      tt.slots = tt.slots.map(s => (s.session
        ? { ...s, session: { ...s.session, myStatus: mine.get(s.session.id) ?? (s.session.status === 'closed' ? 'absent' : null) } }
        : s));
    }
    return res.json(success(tt));
  } catch (err) {
    console.error('MY TIMETABLE ERROR:', err.message);
    return res.status(500).json(error('Could not load your timetable'));
  }
};

// ─── Planner ────────────────────────────────────────────────────
// GET /me/planner
exports.planner = async (req, res) => {
  try {
    const semester = await currentSemester();
    const totals = (await registerTotals(req.user.id)).map(withRates);
    const ids = totals.map(t => t.id);
    const [remaining, schedules, upcoming] = await Promise.all([
      semester ? remainingSlots(ids, semester.ends_on) : new Map(),
      ids.length ? ClassSchedule.findAll({ where: { class_id: ids, is_active: true }, attributes: ['class_id'] }) : [],
      upcomingSlots(ids, { limit: 40, days: 14 }),
    ]);
    const weekly = new Map();
    schedules.forEach(s => weekly.set(s.class_id, (weekly.get(s.class_id) ?? 0) + 1));

    return res.json(success({
      semester: semester ? { id: semester.id, name: semester.name, startsOn: semester.starts_on, endsOn: semester.ends_on } : null,
      classes: totals.map(t => ({
        ...t,
        // null without a current semester: the page asks for an estimate
        remaining: semester ? (remaining.get(t.id) ?? 0) : null,
        weeklySlots: weekly.get(t.id) ?? 0,
        nextSlot: upcoming.find(u => u.classId === t.id) ?? null,
      })),
    }));
  } catch (err) {
    console.error('PLANNER ERROR:', err.message);
    return res.status(500).json(error('Could not load the planner'));
  }
};

// ─── Preferences and the calendar feed ─────────────────────────
const feedUrl = (req, token) => {
  const base = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  return token ? `${base.replace(/\/$/, '')}/api/calendar/${token}.ics` : null;
};

// GET /me/preferences
exports.getPreferences = async (req, res) => {
  try {
    const pref = await UserPreference.findByPk(req.user.id);
    return res.json(success({
      reminderMinutes: pref?.reminder_minutes ?? 10,
      calendarUrl: feedUrl(req, pref?.calendar_token),
    }));
  } catch (err) {
    console.error('GET PREFS ERROR:', err.message);
    return res.status(500).json(error('Could not load your settings'));
  }
};

// PUT /me/preferences  { reminderMinutes: 0 | 10 | 30 | 60 }
exports.savePreferences = async (req, res) => {
  try {
    const minutes = Number(req.body.reminderMinutes);
    if (![0, 10, 30, 60].includes(minutes)) return res.status(400).json(error('Choose off, 10, 30 or 60 minutes'));
    await UserPreference.upsert({ user_id: req.user.id, reminder_minutes: minutes });
    return res.json(success({ reminderMinutes: minutes }, minutes ? `Reminders ${minutes} minutes before class` : 'Reminders off'));
  } catch (err) {
    console.error('SAVE PREFS ERROR:', err.message);
    return res.status(500).json(error('Could not save your settings'));
  }
};

// POST /me/calendar-feed  (creates or replaces the private link)
exports.rotateCalendarFeed = async (req, res) => {
  try {
    const token = crypto.randomBytes(24).toString('base64url');
    const pref = await UserPreference.findByPk(req.user.id);
    if (pref) await pref.update({ calendar_token: token });
    else await UserPreference.create({ user_id: req.user.id, calendar_token: token });
    return res.json(success({ calendarUrl: feedUrl(req, token) }, pref?.calendar_token ? 'New link made; the old one stops working' : 'Calendar link ready'));
  } catch (err) {
    console.error('CALENDAR FEED ERROR:', err.message);
    return res.status(500).json(error('Could not make a calendar link'));
  }
};

// DELETE /me/calendar-feed
exports.deleteCalendarFeed = async (req, res) => {
  try {
    await UserPreference.update({ calendar_token: null }, { where: { user_id: req.user.id } });
    return res.json(success({ calendarUrl: null }, 'Calendar link turned off'));
  } catch (err) {
    console.error('CALENDAR FEED ERROR:', err.message);
    return res.status(500).json(error('Could not turn the link off'));
  }
};

async function icsFor(user) {
  const ids = await myClassIds(user);
  const semester = await currentSemester();
  const fromDay = semester?.starts_on ?? addDays(isoDay(), -28);
  return buildIcs({ name: 'AttendX timetable', classIds: ids, fromDay, untilDay: semester?.ends_on ?? null });
}

// GET /me/timetable.ics — a one-off download of the same calendar.
exports.downloadIcs = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'role'] });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=attendx-timetable.ics');
    return res.send(await icsFor(user));
  } catch (err) {
    console.error('ICS DOWNLOAD ERROR:', err.message);
    return res.status(500).json(error('Could not build the calendar'));
  }
};

// GET /calendar/:token.ics — public, for calendar apps. The token is
// the only credential, so an unknown one gets a plain 404.
exports.calendarFeed = async (req, res) => {
  try {
    const token = String(req.params.token ?? '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return res.status(404).send('Not found');
    const pref = await UserPreference.findOne({ where: { calendar_token: token } });
    const user = pref && await User.findByPk(pref.user_id, { attributes: ['id', 'role', 'is_active'] });
    if (!user?.is_active) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=900');
    return res.send(await icsFor(user));
  } catch (err) {
    console.error('ICS FEED ERROR:', err.message);
    return res.status(500).send('Calendar unavailable');
  }
};

// ─── Excused-absence requests ──────────────────────────────────
// GET /me/excuses
exports.listExcuses = async (req, res) => {
  try {
    const rows = await ExcuseRequest.findAll({
      where: { student_id: req.user.id },
      include: [
        { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
        { model: User, as: 'reviewer', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    });
    return res.json(success({ requests: rows.map(x => excuseJson(x)), reasons: REASONS }));
  } catch (err) {
    console.error('MY EXCUSES ERROR:', err.message);
    return res.status(500).json(error('Could not load your requests'));
  }
};

// POST /me/excuses  { classIds[], dateFrom, dateTo, reason, note, evidenceUrl? }
// One request per class, each reviewed by that class's lecturers.
exports.createExcuse = async (req, res) => {
  try {
    const { dateFrom, dateTo, reason } = req.body;
    const note = String(req.body.note ?? '').trim();
    const evidenceUrl = String(req.body.evidenceUrl ?? '').trim() || null;
    const classIds = [...new Set(Array.isArray(req.body.classIds) ? req.body.classIds : [])].slice(0, 12);

    if (!classIds.length) return res.status(400).json(error('Choose at least one class'));
    if (!classIds.every(isUuid)) return res.status(403).json(error('You can only ask about classes you are enrolled in'));
    if (!DAY_RE.test(dateFrom ?? '') || !DAY_RE.test(dateTo ?? '')) return res.status(400).json(error('Choose the dates you were or will be away'));
    if (dateTo < dateFrom) return res.status(400).json(error('The last day is before the first day'));
    const span = (Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000;
    if (span > 30) return res.status(400).json(error('One request can cover at most 31 days'));
    const today = isoDay();
    if (dateFrom < addDays(today, -30)) return res.status(400).json(error('Absences older than 30 days need to go to your lecturer directly'));
    if (dateFrom > addDays(today, 120)) return res.status(400).json(error('That is too far ahead to request now'));
    if (!REASONS[reason]) return res.status(400).json(error('Choose a reason'));
    if (note.length < 10) return res.status(400).json(error('Add a short explanation (at least 10 characters)'));
    if (note.length > 2000) return res.status(400).json(error('Keep the explanation under 2000 characters'));
    if (evidenceUrl && (!/^https?:\/\/\S+$/i.test(evidenceUrl) || evidenceUrl.length > 500)) {
      return res.status(400).json(error('The evidence link must be a web address starting with http:// or https://'));
    }

    const enrolled = new Set((await Enrollment.findAll({
      where: { student_id: req.user.id, class_id: classIds }, attributes: ['class_id'],
    })).map(e => e.class_id));
    if (classIds.some(id => !enrolled.has(id))) return res.status(403).json(error('You can only ask about classes you are enrolled in'));

    const overlapping = await ExcuseRequest.findAll({
      where: {
        student_id: req.user.id, class_id: classIds, status: ['pending', 'approved'],
        date_from: { [Op.lte]: dateTo }, date_to: { [Op.gte]: dateFrom },
      },
      include: [{ model: Class, as: 'class', attributes: ['code'] }],
    });
    if (overlapping.length) {
      return res.status(409).json(error(`You already have a request covering these dates for ${overlapping.map(o => o.class?.code).join(', ')}`));
    }

    const me = await User.findByPk(req.user.id, { attributes: ['id', 'name'] });
    const classes = await Class.findAll({ where: { id: classIds }, include: [{ model: User, as: 'lecturer', attributes: ['id', 'name', 'email'] }] });
    const io = req.app.get('io');
    const range = rangeLabel(dateFrom, dateTo);
    const created = [];
    for (const cls of classes) {
      const x = await ExcuseRequest.create({
        student_id: req.user.id, class_id: cls.id, date_from: dateFrom, date_to: dateTo,
        reason, note, evidence_url: evidenceUrl,
      });
      created.push(x);
      // Tell everyone who can decide it.
      const reviewerIds = await reviewersOf(cls);
      const reviewers = await User.findAll({ where: { id: reviewerIds, is_active: true }, attributes: ['id', 'name', 'email'] });
      for (const r of reviewers) {
        createNotification(io, {
          userId: r.id, type: 'excuse_request',
          title: `Excuse request: ${cls.code}`,
          message: `${me?.name ?? 'A student'} asked for ${range} to be excused (${REASONS[reason]}).`,
          data: { excuseId: x.id, classId: cls.id },
        }).catch(e => console.warn('[Excuse] notify failed:', e.message));
        sendExcuseRequestEmail({
          to: r.email, lecturerName: r.name, studentName: me?.name ?? 'A student', className: cls.name,
          rangeLabel: range, reasonLabel: REASONS[reason], note,
        });
      }
    }
    return res.status(201).json(success(
      { requests: created.map(x => excuseJson(x)) },
      created.length === 1 ? 'Request sent to your lecturer' : `${created.length} requests sent`,
    ));
  } catch (err) {
    console.error('CREATE EXCUSE ERROR:', err.message);
    return res.status(500).json(error('Could not send the request'));
  }
};

// DELETE /me/excuses/:id — withdraw while it is still pending.
exports.withdrawExcuse = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json(error('Request not found'));
    const [n] = await ExcuseRequest.update(
      { status: 'withdrawn' },
      { where: { id: req.params.id, student_id: req.user.id, status: 'pending' } },
    );
    if (!n) return res.status(409).json(error('Only a request that is still waiting can be withdrawn'));
    return res.json(success(null, 'Request withdrawn'));
  } catch (err) {
    console.error('WITHDRAW EXCUSE ERROR:', err.message);
    return res.status(500).json(error('Could not withdraw it'));
  }
};

// ─── Attendance statement (PDF) ────────────────────────────────
// GET /me/statement.pdf?semesterId=<id>|all
const INK = '#0B1B3F', COBALT = '#2248FF', MUTED = '#5B6781', LINE = '#D9DFEA', TEAL = '#0E9F83', RED = '#C42536';

exports.semesters = async (req, res) => {
  try {
    const [list, current] = await Promise.all([
      Semester.findAll({ order: [['starts_on', 'DESC']], attributes: ['id', 'name', 'starts_on', 'ends_on', 'is_archived'] }).catch(() => []),
      currentSemester(),
    ]);
    return res.json(success({
      semesters: list.map(s => ({ id: s.id, name: s.name, startsOn: s.starts_on, endsOn: s.ends_on })),
      currentId: current?.id ?? null,
    }));
  } catch (err) {
    console.error('SEMESTERS ERROR:', err.message);
    return res.status(500).json(error('Could not load semesters'));
  }
};

exports.statement = async (req, res) => {
  try {
    const range = await resolveRange({ semesterId: req.query.semesterId });
    const me = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'email', 'student_id', 'department'] });
    const rows = (await registerTotals(req.user.id, { from: range.from, to: range.to })).map(withRates);
    const generated = new Date();
    const reference = `ATX-${crypto.createHash('sha256').update(`${me.id}:${generated.toISOString()}`).digest('hex').slice(0, 10).toUpperCase()}`;

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: `Attendance statement, ${me.name}`, Author: 'AttendX' } });
    const file = `attendance-statement-${(me.student_id || me.name).replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${file}`);
    doc.pipe(res);

    const L = 50, W = doc.page.width - 100;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COBALT).text('ATTENDX  /  ATTENDANCE STATEMENT', L, 50, { characterSpacing: 0.6 });
    doc.font('Helvetica-Bold').fontSize(24).fillColor(INK).text(me.name, L, 68, { width: W });
    const idLine = [me.student_id && `Student ID ${me.student_id}`, me.email, me.department].filter(Boolean).join('   ');
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(idLine, L, 100, { width: W });

    // Summary strip
    const all = rows.reduce((t, r) => ({ held: t.held + r.held, counted: t.counted + r.counted, excused: t.excused + r.excused }), { held: 0, counted: 0, excused: 0 });
    const below = rows.filter(r => r.rate != null && r.rate < r.threshold).length;
    const kpis = [
      ['Period', range.label],
      ['Attendance', all.held ? `${pct(all.counted, all.held)}%` : 'No sessions'],
      ['Sessions counted', `${all.counted} of ${all.held}`],
      ['Below minimum', below === 1 ? '1 class' : `${below} classes`],
    ];
    const kw = W / kpis.length;
    kpis.forEach(([label, value], i) => {
      const x = L + i * kw;
      doc.rect(x, 128, kw - 8, 58).strokeColor(LINE).lineWidth(1).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), x + 10, 138, { width: kw - 28, characterSpacing: 0.4 });
      doc.font('Helvetica-Bold').fontSize(value.length > 14 ? 11 : 16).fillColor(INK).text(value, x + 10, 154, { width: kw - 28 });
    });

    // Per-class table
    let y = 212;
    const widths = [W - 300, 50, 50, 40, 52, 50, 58];
    const head = ['Class', 'Held', 'Present', 'Late', 'Excused', 'Absent', 'Rate'];
    const drawHead = () => {
      doc.rect(L, y, W, 22).fillColor('#EEF1F5').fill();
      let x = L;
      head.forEach((h, i) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(h.toUpperCase(), x + 6, y + 7, { width: widths[i] - 12, align: i ? 'right' : 'left' });
        x += widths[i];
      });
      y += 22;
    };
    drawHead();
    if (!rows.length) {
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Not enrolled in any class.', L + 6, y + 10);
      y += 34;
    }
    for (const r of rows) {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; drawHead(); }
      const met = r.rate == null ? null : r.rate >= r.threshold;
      const cells = [classLabel(r.code, r.name), r.held, r.present, r.late, r.excused, r.absent, r.rate == null ? '-' : `${r.rate}%`];
      let x = L;
      cells.forEach((c, i) => {
        doc.font(i === 0 || i === 6 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5)
          .fillColor(i === 6 && met != null ? (met ? TEAL : RED) : INK)
          .text(String(c), x + 6, y + 8, { width: widths[i] - 12, align: i ? 'right' : 'left', ellipsis: true, height: 13 });
        x += widths[i];
      });
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
        .text(`Minimum ${r.threshold}%${r.lecturerName ? `   Lecturer: ${r.lecturerName}` : ''}${met === false ? '   Below minimum' : ''}`, L + 6, y + 22, { width: widths[0] + 200 });
      y += 38;
      doc.moveTo(L, y - 4).lineTo(L + W, y - 4).strokeColor(LINE).lineWidth(0.6).stroke();
    }

    // Footer, on a fresh page if the table reached it
    const fy = doc.page.height - 92;
    if (y > fy - 12) doc.addPage();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
      'Closed sessions only. A session counts from the day you enrolled. Present, late and excused count towards '
      + 'each class minimum; excused absences were approved by the class lecturer.', L, fy, { width: W },
    );
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK)
      .text(`Reference ${reference}   Generated ${generated.toUTCString().slice(5, 22)} UTC`, L, fy + 26, { width: W });
    doc.end();
  } catch (err) {
    console.error('STATEMENT ERROR:', err.message);
    if (!res.headersSent) return res.status(500).json(error('Could not build your statement'));
  }
};
