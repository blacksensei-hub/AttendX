const { Class, Enrollment, User, Session, ClassSchedule } = require('../models');
const { success, error } = require('../utils/apiResponse');

// ─── Generate a unique class code ─────────────────────────────
// Excludes ambiguous characters (I/1, O/0) for easier readability
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ─── Lecturer: get all their classes ──────────────────────────
// Each class includes:
//   - The currently active (open) session if there is one
//   - All weekly schedules set up for that class (active + paused)
//   - Total enrollment count
// The ClassCard component uses the schedules array to show a
// "N active schedules" or "No recurring schedule" badge.
exports.getMyClasses = async (req, res) => {
  try {
    const classes = await Class.findAll({
      where: { lecturer_id: req.user.id },
      include: [
        {
          model:    Session,
          as:       'sessions',
          required: false,
          where:    { status: 'open' },
          limit:    1,
        },
        {
          // Include all schedules so the card can display the badge
          // without making a second API call per class.
          model:      ClassSchedule,
          as:         'schedules',
          required:   false,
          attributes: ['id', 'day_of_week', 'start_time',
                       'duration_mins', 'is_active'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Enrich each class with the enrollment count and surface the
    // active session at the top level for easier frontend consumption.
    const enriched = await Promise.all(classes.map(async cls => {
      const enrollmentCount = await Enrollment.count({
        where: { class_id: cls.id },
      });
      const activeSession = cls.sessions?.[0] ?? null;

      return {
        ...cls.toJSON(),
        enrollmentCount,
        activeSession,
      };
    }));

    return res.json(success({ classes: enriched }));
  } catch (err) {
    console.error('GET CLASSES ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Create a class ───────────────────────────────────────────
exports.createClass = async (req, res) => {
  try {
    const {
      name, description, department, location_name,
      geo_lat, geo_lng, geo_radius,
    } = req.body;

    // Validate coordinates when provided
    if (geo_lat && (geo_lat < -90 || geo_lat > 90))
      return res.status(400).json(error('Latitude must be between -90 and 90'));

    if (geo_lng && (geo_lng < -180 || geo_lng > 180))
      return res.status(400).json(error('Longitude must be between -180 and 180'));

    const code = generateCode();
    const cls  = await Class.create({
      name,
      description,
      department,
      location_name,
      geo_lat:     geo_lat  || null,
      geo_lng:     geo_lng  || null,
      geo_radius:  geo_radius ?? 100,
      code,
      lecturer_id: req.user.id,
    });

    return res.status(201).json(success({ class: cls }, 'Class created'));
  } catch (err) {
    console.error('CREATE CLASS ERROR:', err.message);
    return res.status(500).json(error(err.message));
  }
};

// ─── Delete a class ───────────────────────────────────────────
// Snapshots the class name into every session before destroy so
// historical reports still show "CS301" instead of "Deleted class".
exports.deleteClass = async (req, res) => {
  try {
    const cls = await Class.findOne({
      where: { id: req.params.id, lecturer_id: req.user.id },
    });
    if (!cls) return res.status(404).json(error('Class not found'));

    await Session.update(
      { class_name_snapshot: cls.name },
      { where: { class_id: cls.id } }
    );

    await cls.destroy();
    return res.json(success(null, 'Class deleted'));
  } catch (err) {
    console.error('DELETE CLASS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get class details ────────────────────────────────────────
exports.getClassDetail = async (req, res) => {
  try {
    const cls = await Class.findByPk(req.params.id, {
      include: [{
        model:      User,
        as:         'students',
        attributes: ['id', 'name', 'email', 'student_id'],
      }],
    });
    if (!cls) return res.status(404).json(error('Class not found'));
    return res.json(success({ class: cls }));
  } catch (err) {
    console.error('GET CLASS DETAIL ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student: join a class by code ────────────────────────────
exports.joinClass = async (req, res) => {
  try {
    const { code } = req.body;
    const cls = await Class.findOne({ where: { code } });
    if (!cls) return res.status(404).json(error('Invalid class code'));

    const already = await Enrollment.findOne({
      where: { student_id: req.user.id, class_id: cls.id },
    });
    if (already)
      return res.status(409).json(error('Already enrolled in this class'));

    await Enrollment.create({ student_id: req.user.id, class_id: cls.id });

    return res.status(201).json(success({ class: cls }, 'Joined class successfully'));
  } catch (err) {
    console.error('JOIN CLASS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Student: get enrolled classes ────────────────────────────
exports.getEnrolledClasses = async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { student_id: req.user.id },
    });
    const classIds = enrollments.map(e => e.class_id);

    // Guard against empty array — Sequelize crashes on IN ()
    if (classIds.length === 0)
      return res.json(success({ classes: [] }));

    const classes = await Class.findAll({
      where: { id: classIds },
    });

    return res.json(success({ classes }));
  } catch (err) {
    console.error('GET ENROLLED CLASSES ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};