const { ClassSchedule, Class } = require('../models');
const { success, error }       = require('../utils/apiResponse');
const { findClassFor }         = require('../services/classAccess');

// ─── Validation ───────────────────────────────────────────────
// The same rules the database enforces (server/sql/2026-10-03_schedule_rules.sql),
// checked here first so a bad value gets a clear 400 instead of a
// database error. `partial` is for edits: only the fields sent are checked.
const isInt = (v) => v !== null && v !== '' && Number.isInteger(Number(v));
function slotProblem(f, { partial = false } = {}) {
  const has = (k) => !partial || f[k] !== undefined;
  if (has('day_of_week') && !(isInt(f.day_of_week) && f.day_of_week >= 0 && f.day_of_week <= 6))
    return 'day_of_week must be between 0 (Sunday) and 6 (Saturday)';
  if (has('start_time') && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(f.start_time ?? '')))
    return 'start_time is required (format: HH:MM)';
  if (has('duration_mins') && !(isInt(f.duration_mins) && f.duration_mins >= 1 && f.duration_mins <= 600))
    return 'Duration must be between 1 and 600 minutes';
  if (has('qr_interval') && !(isInt(f.qr_interval) && f.qr_interval >= 1))
    return 'The QR interval must be a whole number of seconds';
  if (has('late_threshold') && !(isInt(f.late_threshold) && f.late_threshold >= 0))
    return '"Late after" must be a whole number of minutes';
  // Not sent when a slot is created (the database defaults it to true).
  if (f.is_active !== undefined && typeof f.is_active !== 'boolean')
    return 'is_active must be true or false';
  return null;
}

// ─── Get all schedules for a class ────────────────────────────
exports.getClassSchedules = async (req, res) => {
  try {
    const { classId } = req.params;

    // Verify ownership
    const cls = await findClassFor(req.user.id, classId, 'view');
    if (!cls) return res.status(404).json(error('Class not found'));

    const schedules = await ClassSchedule.findAll({
      where: { class_id: classId },
      order: [['day_of_week', 'ASC'], ['start_time', 'ASC']],
    });

    return res.json(success({ schedules }));
  } catch (err) {
    console.error('GET SCHEDULES ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Create a new schedule entry for a class ──────────────────
exports.createSchedule = async (req, res) => {
  try {
    const { classId } = req.params;
    const {
      day_of_week, start_time,
      duration_mins = 90,
      qr_interval   = 10,
      late_threshold = 5,
    } = req.body;

    const problem = slotProblem({ day_of_week, start_time, duration_mins, qr_interval, late_threshold });
    if (problem) return res.status(400).json(error(problem));

    // Verify class ownership
    const cls = await findClassFor(req.user.id, classId, 'edit');
    if (!cls) return res.status(404).json(error('Class not found'));

    const schedule = await ClassSchedule.create({
      class_id:       classId,
      day_of_week,
      start_time,
      duration_mins,
      qr_interval,
      late_threshold,
    });

    return res.status(201).json(success({ schedule }, 'Schedule created'));
  } catch (err) {
    console.error('CREATE SCHEDULE ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Update a schedule entry ──────────────────────────────────
exports.updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const updates        = req.body;

    const schedule = await ClassSchedule.findByPk(scheduleId);
    if (!schedule) return res.status(404).json(error('Schedule not found'));

    // Verify ownership through the class
    const cls = await findClassFor(req.user.id, schedule.class_id, 'edit');
    if (!cls) return res.status(403).json(error('Not authorized'));

    // Only allow updating whitelisted fields — never allow changing class_id
    // or last_triggered directly as those would break the scheduler logic.
    const allowed = [
      'day_of_week', 'start_time', 'duration_mins',
      'qr_interval', 'late_threshold', 'is_active',
    ];
    const payload = {};
    allowed.forEach(k => {
      if (updates[k] !== undefined) payload[k] = updates[k];
    });
    const problem = slotProblem(payload, { partial: true });
    if (problem) return res.status(400).json(error(problem));

    await schedule.update(payload);

    return res.json(success({ schedule }, 'Schedule updated'));
  } catch (err) {
    console.error('UPDATE SCHEDULE ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Delete a schedule entry ──────────────────────────────────
exports.deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await ClassSchedule.findByPk(scheduleId);
    if (!schedule) return res.status(404).json(error('Schedule not found'));

    const cls = await findClassFor(req.user.id, schedule.class_id, 'edit');
    if (!cls) return res.status(403).json(error('Not authorized'));

    await schedule.destroy();
    return res.json(success(null, 'Schedule deleted'));
  } catch (err) {
    console.error('DELETE SCHEDULE ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Toggle active state (pause / resume a schedule) ──────────
exports.toggleSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await ClassSchedule.findByPk(scheduleId);
    if (!schedule) return res.status(404).json(error('Schedule not found'));

    const cls = await findClassFor(req.user.id, schedule.class_id, 'edit');
    if (!cls) return res.status(403).json(error('Not authorized'));

    await schedule.update({ is_active: !schedule.is_active });

    return res.json(success(
      { schedule },
      schedule.is_active ? 'Schedule resumed' : 'Schedule paused'
    ));
  } catch (err) {
    console.error('TOGGLE SCHEDULE ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};