// server/src/controllers/adminController.js
const { User, Class, Session, Attendance, Enrollment } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { Op } = require('sequelize');

// ── System-wide dashboard stats ───────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalLecturers,
      totalStudents,
      totalClasses,
      totalSessions,
      totalAttendance,
      activeSessions,
      enrollmentCount,
      closedSessionCount,
      presentAttendance,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { role: 'lecturer' } }),
      User.count({ where: { role: 'student'  } }),
      Class.count(),
      Session.count(),
      Attendance.count(),
      Session.count({ where: { status: 'open'   } }),
      Enrollment.count(),
      Session.count({ where: { status: 'closed' } }),
      // Only count present + late as "successful" attendance
      Attendance.count({ where: { status: { [Op.in]: ['present', 'late'] } } }),
    ]);

    // ── Attendance rate ──────────────────────────────────────
    // Meaningful metric: of all possible (student, closed-session) slots,
    // what percentage resulted in a present or late record?
    //
    // total possible slots = closed sessions × avg enrolled students per class
    // avg enrolled = total enrollments / total classes
    //
    // This always produces a value in [0, 100].
    const avgEnrollmentPerClass = totalClasses > 0
      ? enrollmentCount / totalClasses
      : 0;
    const totalPossibleSlots = Math.round(closedSessionCount * avgEnrollmentPerClass);
    const attendanceRate = totalPossibleSlots > 0
      ? Math.min(100, Math.round((presentAttendance / totalPossibleSlots) * 100))
      : 0;

    return res.json(success({
      totalUsers,
      totalLecturers,
      totalStudents,
      totalClasses,
      totalSessions,
      totalAttendance,
      activeSessions,
      attendanceRate,
    }));
  } catch (err) {
    console.error(err);
    return res.status(500).json(error('Server error'));
  }
};

// ── Get all users (with pagination + search) ──────────────────
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { name:  { [Op.iLike]: `%${search}%` } }, // ← was 'name'
        { email:      { [Op.iLike]: `%${search}%` } },
        { student_id: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      order:      [['created_at', 'DESC']],
      limit:      parseInt(limit),
      offset,
      attributes: { exclude: ['password'] },
    });

    return res.json(success({
      users:      rows,
      total:      count,
      page:       parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    }));
  } catch (err) {
    console.error(err);
    return res.status(500).json(error('Server error'));
  }
};

// ── Toggle a user's active status (deactivate / reactivate) ───
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json(error('User not found'));

    if (user.id === req.user.id)
      return res.status(400).json(error('You cannot deactivate your own account'));

    await user.update({ is_active: !user.is_active });

    return res.json(success(
      { user },
      `User ${user.is_active ? 'activated' : 'deactivated'} successfully`
    ));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ── Change a user's role ──────────────────────────────────────
exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'lecturer', 'admin'].includes(role))
      return res.status(400).json(error('Invalid role'));

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json(error('User not found'));

    if (user.id === req.user.id)
      return res.status(400).json(error('You cannot change your own role'));

    await user.update({ role });
    return res.json(success({ user }, 'Role updated successfully'));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ── Delete a user permanently ─────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json(error('User not found'));

    if (user.id === req.user.id)
      return res.status(400).json(error('You cannot delete your own account'));

    await user.destroy();
    return res.json(success(null, 'User deleted'));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ── Get all classes across all lecturers ──────────────────────
exports.getClasses = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? { name: { [Op.iLike]: `%${search}%` } }
      : {};

    const { count, rows } = await Class.findAndCountAll({
      where,
      include: [{
        model:      User,
        as:         'lecturer',
        attributes: ['id', 'name', 'email'], // ← was 'name'
      }],
      order:  [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset,
    });

    const classes = await Promise.all(rows.map(async c => {
      const enrollmentCount = await Enrollment.count({ where: { class_id: c.id } });
      return { ...c.toJSON(), enrollmentCount };
    }));

    return res.json(success({
      classes,
      total:      count,
      page:       parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    }));
  } catch (err) {
    console.error(err);
    return res.status(500).json(error('Server error'));
  }
};

// ── Force-close any open session ──────────────────────────────
exports.forceCloseSession = async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id);
    if (!session) return res.status(404).json(error('Session not found'));

    await session.update({ status: 'closed', closed_at: new Date() });

    req.app.get('io')
      ?.to(`session:${session.id}`)
      .emit('session:closed', { sessionId: session.id });

    return res.json(success({ session }, 'Session force-closed'));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ── Get all active sessions system-wide ───────────────────────
exports.getActiveSessions = async (req, res) => {
  try {
    const sessions = await Session.findAll({
      where:   { status: 'open' },
      include: [{
        model:   Class,
        as:      'class',
        attributes: ['name', 'code'],
        include: [{
          model:      User,
          as:         'lecturer',
          attributes: ['name', 'email'], // ← was 'name'
        }],
      }],
      order: [['created_at', 'DESC']],
    });

    const enriched = await Promise.all(sessions.map(async s => {
      const count = await Attendance.count({ where: { session_id: s.id } });
      return { ...s.toJSON(), attendanceCount: count };
    }));

    return res.json(success({ sessions: enriched }));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};
