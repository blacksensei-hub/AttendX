const { ClassSchedule, Class } = require('../models');
const { success, error }       = require('../utils/apiResponse');

// ─── Get all schedules for a class ────────────────────────────
exports.getClassSchedules = async (req, res) => {
  try {
    const { classId } = req.params;

    // Verify ownership
    const cls = await Class.findOne({
      where: { id: classId, lecturer_id: req.user.id },
    });
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

    if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6)
      return res.status(400).json(error('day_of_week must be between 0 (Sunday) and 6 (Saturday)'));
    if (!start_time)
      return res.status(400).json(error('start_time is required (format: HH:MM)'));
    if (duration_mins < 1 || duration_mins > 600)
      return res.status(400).json(error('Duration must be between 1 and 600 minutes'));

    // Verify class ownership
    const cls = await Class.findOne({
      where: { id: classId, lecturer_id: req.user.id },
    });
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
    const cls = await Class.findOne({
      where: { id: schedule.class_id, lecturer_id: req.user.id },
    });
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

    const cls = await Class.findOne({
      where: { id: schedule.class_id, lecturer_id: req.user.id },
    });
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

    const cls = await Class.findOne({
      where: { id: schedule.class_id, lecturer_id: req.user.id },
    });
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