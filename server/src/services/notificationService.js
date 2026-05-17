const { Notification, Enrollment, User } = require('../models');

/**
 * Create a notification and emit it via socket in real time
 */
async function createNotification(io, { userId, type, title, message, data = {} }) {
  const notification = await Notification.create({
    user_id: userId,
    type,
    title,
    message,
    data,
  });

  // Emit to the user's personal room
  io?.to(`user:${userId}`).emit('notification:new', {
    id:        notification.id,
    type:      notification.type,
    title:     notification.title,
    message:   notification.message,
    data:      notification.data,
    read:      false,
    createdAt: notification.created_at,
  });

  return notification;
}

/**
 * Notify all students enrolled in a class
 */
async function notifyEnrolledStudents(io, classId, { type, title, message, data }) {
  const enrollments = await Enrollment.findAll({ where: { class_id: classId } });

  await Promise.all(enrollments.map(e =>
    createNotification(io, {
      userId: e.student_id,
      type, title, message, data,
    })
  ));
}

module.exports = { createNotification, notifyEnrolledStudents };