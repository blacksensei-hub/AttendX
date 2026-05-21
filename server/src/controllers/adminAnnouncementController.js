// server/src/controllers/adminAnnouncementController.js
const { v4: uuidv4 }  = require('uuid');
const { User, Class, Enrollment, Notification } = require('../models');
const { success, error }  = require('../utils/apiResponse');
const emailService        = require('../services/emailService');
const { Op }              = require('sequelize');

// ─────────────────────────────────────────────────────────────
// POST /api/admin/announcements
// ─────────────────────────────────────────────────────────────
exports.sendAnnouncement = async (req, res) => {
  try {
    const {
      title,
      message,
      targetRole = 'all',
      classId    = null,
      sendEmail  = false,
    } = req.body;

    if (!title?.trim())   return res.status(400).json(error('Title is required'));
    if (!message?.trim()) return res.status(400).json(error('Message is required'));

    // ── Resolve target users ──────────────────────────────────
    let users = [];

    if (classId) {
      const enrollments = await Enrollment.findAll({
        where:   { class_id: classId },
        include: [{
          model:      User,
          as:         'student',
          attributes: ['id', 'name', 'email', 'is_active'],
          where:      { is_active: true },
        }],
      });
      users = enrollments.filter(e => e.student).map(e => e.student);
    } else {
      const where = { is_active: true, id: { [Op.ne]: req.user.id } };
      if (targetRole !== 'all') where.role = targetRole;
      users = await User.findAll({ where, attributes: ['id', 'name', 'email'] });
    }

    if (users.length === 0) {
      return res.status(400).json(error('No users match the selected audience'));
    }

    // ── Create in-app notifications one by one ────────────────
    // Using individual creates instead of bulkCreate to avoid
    // UUID and field-mapping issues with the Notification model.
    const notifData = {
      sentBy: req.user.id,
      targetRole,
      ...(classId ? { classId } : {}),
    };

    await Promise.allSettled(
      users.map(u =>
        Notification.create({
          id:      uuidv4(),
          user_id: u.id,
          type:    'announcement',
          title:   title.trim(),
          message: message.trim(),
          data:    notifData,
          read:    false,
        })
      )
    );

    // ── Emit socket events so online users see it instantly ───
    const io = req.app.get('io');
    if (io) {
      for (const u of users) {
        io.to(`user:${u.id}`).emit('notification:new', {
          type:    'announcement',
          title:   title.trim(),
          message: message.trim(),
        });
      }
    }

    // ── Optional email batch (fire and forget) ────────────────
    if (sendEmail && emailService.sendAnnouncementEmail) {
      Promise.allSettled(
        users.map(u =>
          emailService.sendAnnouncementEmail({
            to:         u.email,
            name:       u.name,
            title:      title.trim(),
            message:    message.trim(),
            senderName: req.user.name ?? 'AttendX Admin',
          })
        )
      ).catch(err => console.error('[Announcement] email batch error:', err.message));
    }

    return res.status(201).json(success({
      sent:      users.length,
      targetRole,
      classId:   classId ?? null,
      sentEmail: Boolean(sendEmail && emailService.sendAnnouncementEmail),
    }, `Announcement sent to ${users.length} user${users.length === 1 ? '' : 's'}`));

  } catch (err) {
    console.error('[Announcement] sendAnnouncement error:', err);
    return res.status(500).json(error('Failed to send announcement'));
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/announcements/preview?targetRole=&classId=
// ─────────────────────────────────────────────────────────────
exports.previewAnnouncement = async (req, res) => {
  try {
    const { targetRole = 'all', classId } = req.query;

    let count = 0;

    if (classId) {
      count = await Enrollment.count({ where: { class_id: classId } });
    } else {
      const where = { is_active: true, id: { [Op.ne]: req.user.id } };
      if (targetRole !== 'all') where.role = targetRole;
      count = await User.count({ where });
    }

    return res.json(success({ count }));
  } catch (err) {
    console.error('[Announcement] previewAnnouncement error:', err);
    return res.status(500).json(error('Failed to get preview count'));
  }
};