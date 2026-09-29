// server/src/controllers/adminController.js
const { User, Class, Session, Attendance, Enrollment } = require('../models');
const { success, error } = require('../utils/apiResponse');
const { Op } = require('sequelize');
const { finalizeClose } = require('../services/sessionLifecycle');
const { audit } = require('../services/auditService');

// ── Get all users (with pagination + search) ──────────────────
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '', status = '', department = '', id = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (id) where.id = id;
    if (role) where.role = role;
    if (department) where.department = { [Op.iLike]: department };
    // status: active (can sign in), inactive (switched off), invited
    // (imported, invite not yet used).
    if (status === 'active')   { where.is_active = true; where.invite_token_hash = null; }
    if (status === 'inactive') where.is_active = false;
    if (status === 'invited')  where.invite_token_hash = { [Op.ne]: null };
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
    await audit(req, {
      action:  user.is_active ? 'user.activated' : 'user.deactivated',
      target:  { type: 'user', id: user.id, label: user.email },
      summary: `${user.is_active ? 'Activated' : 'Deactivated'} ${user.name}`,
      changes: { is_active: [!user.is_active, user.is_active] },
    });

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

    const previousRole = user.role;
    await user.update({ role });
    await audit(req, {
      action:  'user.role_changed',
      target:  { type: 'user', id: user.id, label: user.email },
      summary: `Changed ${user.name} from ${previousRole} to ${role}`,
      changes: { role: [previousRole, role] },
    });
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
    await audit(req, {
      action:  'user.deleted',
      target:  { type: 'user', id: user.id, label: user.email },
      summary: `Deleted ${user.name} (${user.role})`,
    });
    return res.json(success(null, 'User deleted'));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// ── Get all classes across all lecturers ──────────────────────
exports.getClasses = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', id = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (id) where.id = id;
    if (search) {
      where[Op.or] = [
        { name:       { [Op.iLike]: `%${search}%` } },
        { code:       { [Op.iLike]: `%${search}%` } },
        { department: { [Op.iLike]: `%${search}%` } },
      ];
    }

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

    if (session.status === 'closed') {
      return res.json(success({ session }, 'Session was already closed'));
    }

    await session.update({ status: 'closed', closed_at: new Date() });
    const cls = await Class.findByPk(session.class_id);
    await finalizeClose(session, { cls, io: req.app.get('io') });
    await audit(req, {
      action:  'session.force_closed',
      target:  { type: 'session', id: session.id, label: session.title || session.class_name_snapshot },
      summary: `Force-closed a live session of ${cls?.name ?? session.class_name_snapshot ?? 'a class'}`,
    });

    return res.json(success({ session }, 'Session force-closed'));
  } catch (err) {
    console.error('[Admin] forceCloseSession error:', err);
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
