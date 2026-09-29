// server/src/controllers/teachingController.js
const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, Class, ClassStaff, ClassSchedule, Enrollment, Session, User,
  Attendance, AttendanceAdjustment, Appeal, ExcuseRequest,
} = require('../models');
const { success, error } = require('../utils/apiResponse');
const { findClassFor, classRoles, classIdsFor, can, isUuid } = require('../services/classAccess');
const { weekTimetable, mondayOf, upcomingSlots } = require('../services/timetableService');
const { REASONS, rangeLabel, preview, applyExcuse } = require('../services/excuseService');
const { createNotification } = require('../services/notificationService');
const { sendExcuseOutcomeEmail, sendStaffAddedEmail } = require('../services/emailService');
const { audit } = require('../services/auditService');

/**
 * ═════════════════════════════════════════════════════════════════
 * Lecturer tools: timetable, the class hub (register, student
 * drill-down, teaching staff) and excused-absence review.
 *
 * Every class-scoped endpoint goes through findClassFor, so the owner,
 * co-lecturers and teaching assistants each get exactly what their
 * role allows (see services/classAccess).
 *
 * The register rule is the one reports and history use: a student is
 * expected at every closed session held after they enrolled (or any
 * earlier one they attended). Present, late and excused count towards
 * the minimum; no row means absent.
 * ═════════════════════════════════════════════════════════════════
 */

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const COUNTED = new Set(['present', 'late', 'excused']);
const ROLE_LABEL = { co_lecturer: 'co-lecturer', ta: 'teaching assistant' };
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// The token only carries id and role; notifications need a name.
const actorName = async (req, fallback) =>
  (await User.findByPk(req.user.id, { attributes: ['name'] }))?.name ?? fallback;

// Every expected (student, closed session) pair for a class, oldest first.
function registerRows(classId, studentId = null) {
  return sequelize.query(`
    SELECT e.student_id                  AS "studentId",
           s.id                          AS "sessionId",
           s.title,
           s.open_at                     AS "openAt",
           COALESCE(a.status::text, 'absent') AS status,
           a.id                          AS "attendanceId",
           a.marked_at                   AS "markedAt"
      FROM enrollments e
      JOIN sessions s    ON s.class_id = e.class_id AND s.status = 'closed'
      LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = e.student_id
     WHERE e.class_id = :classId
       ${studentId ? 'AND e.student_id = :studentId' : ''}
       AND (a.status IN ('present', 'late', 'excused') OR s.open_at >= COALESCE(e.enrolled_at, s.open_at))
     ORDER BY s.open_at ASC
  `, { replacements: { classId, studentId }, type: QueryTypes.SELECT });
}

function tally(rows) {
  const t = { held: rows.length, present: 0, late: 0, excused: 0, absent: 0 };
  for (const r of rows) t[r.status] = (t[r.status] ?? 0) + 1;
  t.counted = t.present + t.late + t.excused;
  t.rate = pct(t.counted, t.held);
  // Absences back to back at the end of the register (excused breaks nothing).
  let run = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i].status === 'absent'; i -= 1) run += 1;
  t.missedInARow = run;
  const scans = rows.filter(r => r.status === 'present' || r.status === 'late');
  t.lastSeen = scans.length ? scans[scans.length - 1].markedAt ?? scans[scans.length - 1].openAt : null;
  return t;
}

// ─── Timetable ──────────────────────────────────────────────────
// GET /teaching/timetable?week=YYYY-MM-DD (any day in the week)
exports.timetable = async (req, res) => {
  try {
    const roles = await classRoles(req.user.id);
    const week = DAY_RE.test(req.query.week ?? '') ? req.query.week : undefined;
    const tt = await weekTimetable([...roles.keys()], mondayOf(week));

    // Scan counts for the sessions in view, in one grouped query.
    const sessionIds = tt.slots.filter(s => s.session).map(s => s.session.id);
    const [counts, enrolled] = await Promise.all([
      sessionIds.length ? Attendance.findAll({
        where: { session_id: sessionIds, status: ['present', 'late'] },
        attributes: ['session_id', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
        group: ['session_id'], raw: true,
      }) : [],
      roles.size ? Enrollment.findAll({
        where: { class_id: [...roles.keys()] },
        attributes: ['class_id', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
        group: ['class_id'], raw: true,
      }) : [],
    ]);
    const scanned = new Map(counts.map(c => [c.session_id, Number(c.n)]));
    const size = new Map(enrolled.map(c => [c.class_id, Number(c.n)]));

    return res.json(success({
      ...tt,
      classes: tt.classes.map(c => ({ ...c, myRole: roles.get(c.id), enrolled: size.get(c.id) ?? 0 })),
      slots: tt.slots.map(s => (s.session ? { ...s, session: { ...s.session, scanned: scanned.get(s.session.id) ?? 0 } } : s)),
    }));
  } catch (err) {
    console.error('TIMETABLE ERROR:', err.message);
    return res.status(500).json(error('Could not load the timetable'));
  }
};

// ─── Class hub ──────────────────────────────────────────────────
// GET /teaching/classes/:classId
exports.classHub = async (req, res) => {
  try {
    const cls = await findClassFor(req.user.id, req.params.classId, 'view', {
      include: [{ model: User, as: 'lecturer', attributes: ['id', 'name', 'email'] }],
    });
    if (!cls) return res.status(404).json(error('Class not found'));

    const [staff, schedules, enrolled, rows, open, next, pendingAppeals, pendingExcuses] = await Promise.all([
      ClassStaff.findAll({
        where: { class_id: cls.id },
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
        order: [['created_at', 'ASC']],
      }),
      ClassSchedule.findAll({ where: { class_id: cls.id }, order: [['day_of_week', 'ASC'], ['start_time', 'ASC']] }),
      Enrollment.count({ where: { class_id: cls.id } }),
      registerRows(cls.id),
      Session.findOne({ where: { class_id: cls.id, status: 'open' }, attributes: ['id', 'title', 'open_at', 'close_at'] }),
      upcomingSlots([cls.id], { limit: 1 }),
      sequelize.query(`
        SELECT count(*)::int AS n FROM appeals a JOIN sessions s ON s.id = a.session_id
         WHERE s.class_id = :classId AND a.status = 'pending'`,
      { replacements: { classId: cls.id }, type: QueryTypes.SELECT }),
      ExcuseRequest.count({ where: { class_id: cls.id, status: 'pending' } }).catch(() => 0),
    ]);

    const byStudent = new Map();
    for (const r of rows) {
      if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
      byStudent.get(r.studentId).push(r);
    }
    const perStudent = [...byStudent.values()].map(tally);
    const atRisk = perStudent.filter(t => t.held >= 3 && t.rate != null && t.rate < cls.attendance_threshold).length;
    const counted = rows.filter(r => COUNTED.has(r.status)).length;
    const sessionsHeld = new Set(rows.map(r => r.sessionId)).size;

    return res.json(success({
      class: {
        id: cls.id, name: cls.name, code: cls.code, description: cls.description, department: cls.department,
        locationName: cls.location_name, geoRadius: cls.geo_radius, hasGeofence: cls.geo_lat != null,
        threshold: cls.attendance_threshold, isActive: cls.is_active, createdAt: cls.createdAt,
        owner: cls.lecturer ? { id: cls.lecturer.id, name: cls.lecturer.name, email: cls.lecturer.email } : null,
      },
      myRole: cls.myRole,
      permissions: { run: can(cls.myRole, 'run'), edit: can(cls.myRole, 'edit'), own: can(cls.myRole, 'own') },
      staff: staff.map(s => ({ userId: s.user_id, role: s.role, name: s.user?.name, email: s.user?.email, addedAt: s.created_at })),
      schedules: schedules.map(s => ({
        id: s.id, dayOfWeek: s.day_of_week, start: String(s.start_time).slice(0, 5),
        duration: s.duration_mins, isActive: s.is_active,
      })),
      stats: {
        enrolled,
        sessionsHeld,
        rate: pct(counted, rows.length),
        atRisk,
        pendingAppeals: pendingAppeals[0]?.n ?? 0,
        pendingExcuses,
      },
      openSession: open ? { id: open.id, title: open.title, openAt: open.open_at, closeAt: open.close_at } : null,
      nextSlot: next[0] ?? null,
    }));
  } catch (err) {
    console.error('CLASS HUB ERROR:', err.message);
    return res.status(500).json(error('Could not load the class'));
  }
};

// ─── Register (every student, with their numbers) ──────────────
// GET /teaching/classes/:classId/roster
// `recent` is each student's last 12 sessions, aligned to `sessions`,
// for the register strip. The grade export is computed from this too.
exports.roster = async (req, res) => {
  try {
    const cls = await findClassFor(req.user.id, req.params.classId, 'view');
    if (!cls) return res.status(404).json(error('Class not found'));

    const [enrolments, rows] = await Promise.all([
      Enrollment.findAll({
        where: { class_id: cls.id },
        include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email', 'student_id', 'department'] }],
      }),
      registerRows(cls.id),
    ]);

    const sessionOrder = [];
    const seen = new Set();
    for (const r of rows) if (!seen.has(r.sessionId)) { seen.add(r.sessionId); sessionOrder.push({ id: r.sessionId, title: r.title, openAt: r.openAt }); }
    const recentSessions = sessionOrder.slice(-12);

    const byStudent = new Map();
    for (const r of rows) {
      if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
      byStudent.get(r.studentId).push(r);
    }

    const students = enrolments.filter(e => e.student).map(e => {
      const mine = byStudent.get(e.student_id) ?? [];
      const status = new Map(mine.map(r => [r.sessionId, r.status]));
      return {
        id: e.student.id,
        name: e.student.name,
        email: e.student.email,
        studentNumber: e.student.student_id,
        department: e.student.department,
        enrolledAt: e.enrolled_at,
        ...tally(mine),
        recent: recentSessions.map(s => status.get(s.id) ?? null),   // null: before they enrolled
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return res.json(success({
      threshold: cls.attendance_threshold,
      sessionsHeld: sessionOrder.length,
      sessions: recentSessions,
      students,
    }));
  } catch (err) {
    console.error('ROSTER ERROR:', err.message);
    return res.status(500).json(error('Could not load the register'));
  }
};

// ─── One student in one class ──────────────────────────────────
// GET /teaching/classes/:classId/students/:studentId
exports.studentDetail = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const cls = await findClassFor(req.user.id, classId, 'view');
    if (!cls) return res.status(404).json(error('Class not found'));
    if (!isUuid(studentId)) return res.status(404).json(error('This student is not in the class'));

    const enrolment = await Enrollment.findOne({
      where: { class_id: cls.id, student_id: studentId },
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email', 'student_id', 'department', 'last_login_at'] }],
    });
    if (!enrolment?.student) return res.status(404).json(error('This student is not in the class'));

    const [rows, openSession, appeals, excuses] = await Promise.all([
      registerRows(cls.id, studentId),
      Session.findOne({ where: { class_id: cls.id, status: 'open' }, attributes: ['id', 'title', 'open_at'] }),
      sequelize.query(`
        SELECT a.id, a.status, a.reason, a.lecturer_note AS "lecturerNote", a.created_at AS "createdAt",
               s.id AS "sessionId", s.title, s.open_at AS "openAt"
          FROM appeals a JOIN sessions s ON s.id = a.session_id
         WHERE a.student_id = :studentId AND s.class_id = :classId
         ORDER BY a.created_at DESC`,
      { replacements: { studentId, classId: cls.id }, type: QueryTypes.SELECT }),
      ExcuseRequest.findAll({ where: { class_id: cls.id, student_id: studentId }, order: [['created_at', 'DESC']] }).catch(() => []),
    ]);

    // Which records were changed by hand, and the latest reason.
    const attendanceIds = rows.map(r => r.attendanceId).filter(Boolean);
    const adjustments = attendanceIds.length
      ? await AttendanceAdjustment.findAll({ where: { attendance_id: attendanceIds }, order: [['created_at', 'DESC']] })
      : [];
    const lastAdjustment = new Map();
    adjustments.forEach(a => { if (!lastAdjustment.has(a.attendance_id)) lastAdjustment.set(a.attendance_id, a); });

    let counted = 0;
    const sessions = rows.map((r, i) => {
      if (COUNTED.has(r.status)) counted += 1;
      const adj = r.attendanceId ? lastAdjustment.get(r.attendanceId) : null;
      return {
        sessionId: r.sessionId,
        attendanceId: r.attendanceId,
        title: r.title,
        openAt: r.openAt,
        status: r.status,
        markedAt: r.markedAt,
        minutesAfterOpen: (r.status === 'present' || r.status === 'late') && r.markedAt
          ? Math.max(0, Math.round((new Date(r.markedAt) - new Date(r.openAt)) / 60000)) : null,
        adjusted: adj ? { from: adj.old_status, to: adj.new_status, reason: adj.reason, at: adj.created_at } : null,
        runningRate: pct(counted, i + 1),
      };
    });

    const s = enrolment.student;
    return res.json(success({
      class: { id: cls.id, name: cls.name, code: cls.code, threshold: cls.attendance_threshold },
      canEdit: can(cls.myRole, 'edit'),
      student: {
        id: s.id, name: s.name, email: s.email, studentNumber: s.student_id,
        department: s.department, lastLoginAt: s.last_login_at, enrolledAt: enrolment.enrolled_at,
      },
      stats: tally(rows),
      openSession: openSession ? { id: openSession.id, title: openSession.title, openAt: openSession.open_at } : null,
      sessions: sessions.reverse(),   // newest first
      appeals,
      excuses: excuses.map(x => ({
        id: x.id, status: x.status, reason: x.reason, reasonLabel: REASONS[x.reason] ?? x.reason,
        range: rangeLabel(x.date_from, x.date_to), note: x.note, reviewerNote: x.reviewer_note, createdAt: x.created_at,
      })),
    }));
  } catch (err) {
    console.error('STUDENT DETAIL ERROR:', err.message);
    return res.status(500).json(error('Could not load this student'));
  }
};

// ─── Teaching staff ─────────────────────────────────────────────
// POST /teaching/classes/:classId/staff  { email, role }
exports.addStaff = async (req, res) => {
  try {
    const cls = await findClassFor(req.user.id, req.params.classId, 'own');
    if (!cls) return res.status(404).json(error('Only the class owner can add teaching staff'));
    const role = req.body.role;
    const email = String(req.body.email ?? '').trim().toLowerCase();
    if (!['co_lecturer', 'ta'].includes(role)) return res.status(400).json(error('Choose co-lecturer or teaching assistant'));
    if (!email) return res.status(400).json(error('Enter their email address'));

    const user = await User.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), email) });
    if (!user || user.role !== 'lecturer' || !user.is_active) {
      return res.status(404).json(error('No active lecturer account uses that email. Ask an administrator to create one.'));
    }
    if (user.id === cls.lecturer_id) return res.status(409).json(error('That is the class owner'));
    const [row, created] = await ClassStaff.findOrCreate({
      where: { class_id: cls.id, user_id: user.id },
      defaults: { role, added_by: req.user.id },
    });
    if (!created) return res.status(409).json(error(`${user.name} is already on this class as ${ROLE_LABEL[row.role]}`));

    await audit(req, {
      action: 'class.staff_added',
      target: { type: 'class', id: cls.id, label: `${cls.code} ${cls.name}` },
      summary: `Added ${user.name} as ${ROLE_LABEL[role]}`,
      changes: { userId: user.id, role },
    });
    const adder = await actorName(req, 'The class owner');
    createNotification(req.app.get('io'), {
      userId: user.id, type: 'staff_added',
      title: `You were added to ${cls.name}`,
      message: `${adder} added you as ${ROLE_LABEL[role]}.`,
      data: { classId: cls.id },
    }).catch(e => console.warn('[Staff] notify failed:', e.message));
    sendStaffAddedEmail({ to: user.email, name: user.name, className: cls.name, roleLabel: ROLE_LABEL[role], addedBy: adder });

    return res.status(201).json(success({
      staff: { userId: user.id, role, name: user.name, email: user.email, addedAt: row.created_at },
    }, `${user.name} added`));
  } catch (err) {
    console.error('ADD STAFF ERROR:', err.message);
    return res.status(500).json(error('Could not add them'));
  }
};

// PATCH /teaching/classes/:classId/staff/:userId  { role }
exports.updateStaff = async (req, res) => {
  try {
    const cls = await findClassFor(req.user.id, req.params.classId, 'own');
    if (!cls) return res.status(404).json(error('Only the class owner can change teaching staff'));
    const { role } = req.body;
    if (!['co_lecturer', 'ta'].includes(role)) return res.status(400).json(error('Choose co-lecturer or teaching assistant'));
    const row = isUuid(req.params.userId) && await ClassStaff.findOne({ where: { class_id: cls.id, user_id: req.params.userId }, include: [{ model: User, as: 'user', attributes: ['name'] }] });
    if (!row) return res.status(404).json(error('They are not on this class'));
    const before = row.role;
    await row.update({ role });
    await audit(req, {
      action: 'class.staff_changed',
      target: { type: 'class', id: cls.id, label: `${cls.code} ${cls.name}` },
      summary: `${row.user?.name ?? 'A staff member'} is now ${ROLE_LABEL[role]}`,
      changes: { userId: row.user_id, role: [before, role] },
    });
    return res.json(success({ role }, 'Role updated'));
  } catch (err) {
    console.error('UPDATE STAFF ERROR:', err.message);
    return res.status(500).json(error('Could not change the role'));
  }
};

// DELETE /teaching/classes/:classId/staff/:userId
// The owner removes anyone; a co-lecturer or TA can remove themselves.
exports.removeStaff = async (req, res) => {
  try {
    const leaving = req.params.userId === req.user.id;
    const cls = await findClassFor(req.user.id, req.params.classId, leaving ? 'view' : 'own');
    if (!cls) return res.status(404).json(error('Class not found'));
    const row = isUuid(req.params.userId) && await ClassStaff.findOne({ where: { class_id: cls.id, user_id: req.params.userId }, include: [{ model: User, as: 'user', attributes: ['name'] }] });
    if (!row) return res.status(404).json(error('They are not on this class'));
    await row.destroy();
    await audit(req, {
      action: 'class.staff_removed',
      target: { type: 'class', id: cls.id, label: `${cls.code} ${cls.name}` },
      summary: leaving ? `Left the class (was ${ROLE_LABEL[row.role]})` : `Removed ${row.user?.name ?? 'a staff member'} (${ROLE_LABEL[row.role]})`,
      changes: { userId: row.user_id, role: row.role },
    });
    return res.json(success(null, leaving ? 'You left the class' : 'Removed'));
  } catch (err) {
    console.error('REMOVE STAFF ERROR:', err.message);
    return res.status(500).json(error('Could not remove them'));
  }
};

// ─── Excused-absence review ────────────────────────────────────
function excuseJson(x, extra = {}) {
  return {
    id: x.id,
    status: x.status,
    reason: x.reason,
    reasonLabel: REASONS[x.reason] ?? x.reason,
    dateFrom: x.date_from,
    dateTo: x.date_to,
    range: rangeLabel(x.date_from, x.date_to),
    note: x.note,
    evidenceUrl: x.evidence_url,
    reviewerNote: x.reviewer_note,
    reviewedAt: x.reviewed_at,
    reviewer: x.reviewer ? { id: x.reviewer.id, name: x.reviewer.name } : null,
    appliedCount: x.applied_count,
    createdAt: x.created_at,
    student: x.student ? { id: x.student.id, name: x.student.name, email: x.student.email, studentNumber: x.student.student_id } : undefined,
    class: x.class ? { id: x.class.id, name: x.class.name, code: x.class.code } : undefined,
    ...extra,
  };
}
exports.excuseJson = excuseJson;

// GET /teaching/excuses?status=pending|approved|rejected|all
// Owner and co-lecturers review; pending requests carry a preview of
// the sessions they cover and what would change.
exports.listExcuses = async (req, res) => {
  try {
    const classIds = await classIdsFor(req.user.id, 'edit');
    if (classIds.length === 0) return res.json(success({ requests: [], counts: { pending: 0 } }));
    const status = ['pending', 'approved', 'rejected', 'withdrawn'].includes(req.query.status) ? req.query.status : null;
    const where = { class_id: classIds, ...(status ? { status } : { status: { [Op.ne]: 'withdrawn' } }) };
    const [rows, pending] = await Promise.all([
      ExcuseRequest.findAll({
        where,
        include: [
          { model: User, as: 'student', attributes: ['id', 'name', 'email', 'student_id'] },
          { model: User, as: 'reviewer', attributes: ['id', 'name'] },
          { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
        ],
        order: [[sequelize.literal("CASE WHEN \"ExcuseRequest\".status = 'pending' THEN 0 ELSE 1 END"), 'ASC'], ['created_at', 'DESC']],
        limit: 200,
      }),
      ExcuseRequest.count({ where: { class_id: classIds, status: 'pending' } }),
    ]);
    const requests = await Promise.all(rows.map(async x => (
      x.status === 'pending' ? excuseJson(x, { sessions: await preview(x) }) : excuseJson(x)
    )));
    return res.json(success({ requests, counts: { pending } }));
  } catch (err) {
    console.error('LIST EXCUSES ERROR:', err.message);
    return res.status(500).json(error('Could not load excuse requests'));
  }
};

// PUT /teaching/excuses/:id/review  { decision: 'approved'|'rejected', note }
exports.reviewExcuse = async (req, res) => {
  try {
    const { decision } = req.body;
    const note = String(req.body.note ?? '').trim().slice(0, 1000) || null;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json(error('Approve or decline the request'));
    if (decision === 'rejected' && !note) return res.status(400).json(error('Tell the student why it was declined'));

    if (!isUuid(req.params.id)) return res.status(404).json(error('Request not found'));
    const excuse = await ExcuseRequest.findByPk(req.params.id, {
      include: [
        { model: User, as: 'student', attributes: ['id', 'name', 'email', 'student_id'] },
        { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
      ],
    });
    if (!excuse || !(await findClassFor(req.user.id, excuse.class_id, 'edit'))) {
      return res.status(404).json(error('Request not found'));
    }
    if (excuse.status !== 'pending') return res.status(409).json(error('This request has already been decided'));

    // Claim it first so two reviewers can't both apply it.
    const [claimed] = await ExcuseRequest.update(
      { status: decision, reviewed_by: req.user.id, reviewer_note: note, reviewed_at: new Date() },
      { where: { id: excuse.id, status: 'pending' } },
    );
    if (!claimed) return res.status(409).json(error('This request has already been decided'));

    const applied = decision === 'approved' ? await applyExcuse(excuse, req.user.id) : 0;
    if (applied) await ExcuseRequest.update({ applied_count: applied }, { where: { id: excuse.id } });

    const range = rangeLabel(excuse.date_from, excuse.date_to);
    await audit(req, {
      action: 'excuse.reviewed',
      target: { type: 'excuse', id: excuse.id, label: `${excuse.student?.name ?? 'Student'}, ${excuse.class?.code ?? 'class'}` },
      summary: decision === 'approved'
        ? `Excused ${range} (${applied} record${applied === 1 ? '' : 's'} changed)`
        : `Declined an excuse for ${range}`,
      changes: { decision, applied, note },
    });

    const reviewerName = await actorName(req, 'Your lecturer');
    createNotification(req.app.get('io'), {
      userId: excuse.student_id, type: 'excuse_reviewed',
      title: decision === 'approved' ? `Absence excused: ${excuse.class?.name}` : `Absence not excused: ${excuse.class?.name}`,
      message: decision === 'approved'
        ? `${range} is excused${applied ? `; ${applied} absence${applied === 1 ? '' : 's'} updated` : ''}.`
        : `${range} was not excused. ${note}`,
      data: { excuseId: excuse.id, classId: excuse.class_id },
    }).catch(e => console.warn('[Excuse] notify failed:', e.message));
    sendExcuseOutcomeEmail({
      to: excuse.student?.email, studentName: excuse.student?.name, className: excuse.class?.name,
      rangeLabel: range, approved: decision === 'approved', applied, reviewerName, note,
    });

    return res.json(success({ applied }, decision === 'approved'
      ? `Excused. ${applied} record${applied === 1 ? '' : 's'} updated.`
      : 'Declined'));
  } catch (err) {
    console.error('REVIEW EXCUSE ERROR:', err.message);
    return res.status(500).json(error('Could not save the decision'));
  }
};
