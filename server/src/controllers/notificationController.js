const { Notification } = require('../models');
const { success, error } = require('../utils/apiResponse');

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where:  { user_id: req.user.id },
      order:  [['created_at', 'DESC']],
      limit:  50,
    });
    const unreadCount = notifications.filter(n => !n.read).length;
    return res.json(success({ notifications, unreadCount }));
  } catch (err) {
    console.error(err);
    return res.status(500).json(error('Server error'));
  }
};

// Mark one as read
exports.markRead = async (req, res) => {
  try {
    await Notification.update(
      { read: true },
      { where: { id: req.params.id, user_id: req.user.id } }
    );
    return res.json(success(null, 'Marked as read'));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// Mark all as read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.update(
      { read: true },
      { where: { user_id: req.user.id, read: false } }
    );
    return res.json(success(null, 'All marked as read'));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};

// Delete all notifications
exports.clearAll = async (req, res) => {
  try {
    await Notification.destroy({ where: { user_id: req.user.id } });
    return res.json(success(null, 'Notifications cleared'));
  } catch (err) {
    return res.status(500).json(error('Server error'));
  }
};