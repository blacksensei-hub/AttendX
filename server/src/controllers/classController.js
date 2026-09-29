const { Class, Enrollment, User, Session, ClassSchedule } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { classRoles, findClassFor, roleOn } = require('../services/classAccess');

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
// Classes the lecturer co-teaches or assists on are included, each
// with myRole ('owner', 'co_lecturer' or 'ta') and the owner's name.
exports.getMyClasses = async (req, res) => {
  try {
    const roles = await classRoles(req.user.id);
    if (roles.size === 0) return res.json(success({ classes: [] }));
    const classes = await Class.findAll({
      where: { id: [...roles.keys()] },
      include: [
        { model: User, as: 'lecturer', attributes: ['id', 'name'] },
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
        myRole: roles.get(cls.id),
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

    // Radius and minimum attendance fall back to the institution's
    // policy settings (admin console), which themselves default to 100m
    // and 75%.
    const policy = await require('../services/settingsService').loadAll();
    const code = generateCode();
    const cls  = await Class.create({
      name,
      description,
      department,
      location_name,
      geo_lat:     geo_lat  || null,
      geo_lng:     geo_lng  || null,
      geo_radius:  geo_radius ?? policy['class.default_geofence_m'],
      attendance_threshold: policy['class.default_threshold_pct'],
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
    const cls = await findClassFor(req.user.id, req.params.id, 'own');
    if (!cls) return res.status(404).json(error('Class not found'));

    // Close a running session first, so its absences are recorded while
    // the enrolment list still exists and nobody is left with a session
    // that has no staff to close it.
    const open = await Session.findOne({ where: { class_id: cls.id, status: 'open' } });
    if (open) {
      await open.update({ status: 'closed', closed_at: new Date() });
      await require('../services/sessionLifecycle').finalizeClose(open, { cls, io: req.app.get('io') });
    }

    await Session.update(
      { class_name_snapshot: cls.name },
      { where: { class_id: cls.id } }
    );

    await cls.destroy();
    await require('../services/auditService').audit(req, {
      action:  'class.deleted',
      target:  { type: 'class', id: cls.id, label: `${cls.code} ${cls.name}` },
      summary: `Deleted ${cls.name}. Its session history is kept.`,
    });
    return res.json(success(null, 'Class deleted'));
  } catch (err) {
    console.error('DELETE CLASS ERROR:', err.message);
    return res.status(500).json(error('Server error'));
  }
};

// ─── Get class details ────────────────────────────────────────
// The roster (names and emails) is only for the class's teaching staff
// and admins. An enrolled student gets the class without it; anyone
// else gets a 404. This used to return any class's roster to any
// signed-in user.
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

    if (req.user.role === 'admin') return res.json(success({ class: cls }));
    const role = await roleOn(req.user.id, cls);
    if (role) return res.json(success({ class: { ...cls.toJSON(), myRole: role } }));

    const enrolled = req.user.role === 'student'
      && await Enrollment.count({ where: { class_id: cls.id, student_id: req.user.id } });
    if (!enrolled) return res.status(404).json(error('Class not found'));
    const { students: _roster, ...rest } = cls.toJSON();
    return res.json(success({ class: rest }));
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