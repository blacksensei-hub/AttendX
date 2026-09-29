// server/src/services/announcementService.js
const { Op } = require('sequelize');
const {
  Announcement, AnnouncementReceipt, Notification, User, Enrollment, Class,
} = require('../models');
const { sendAnnouncementEmail } = require('./emailService');
const { beat } = require('./opsFeed');

/**
 * ═════════════════════════════════════════════════════════════════
 * Announcements: who receives one, and delivering it.
 *
 * Audiences: everyone, one role, one class (its students and its
 * lecturer) or one department. Only active accounts receive anything.
 *
 * Delivery writes an in-app notification plus a receipt per recipient
 * (the receipt is what "read by 38 of 60" counts), then sends emails
 * five at a time. Scheduled announcements go out from a poller that
 * checks every minute.
 * ═════════════════════════════════════════════════════════════════
 */

const ROLES = ['student', 'lecturer', 'admin'];

async function resolveRecipients(audience, value) {
  const base = { is_active: true };
  const attrs = ['id', 'name', 'email'];
  switch (audience) {
    case 'all':
      return User.findAll({ where: base, attributes: attrs });
    case 'role':
      if (!ROLES.includes(value)) return [];
      return User.findAll({ where: { ...base, role: value }, attributes: attrs });
    case 'department':
      if (!value) return [];
      return User.findAll({ where: { ...base, department: { [Op.iLike]: value.trim() } }, attributes: attrs });
    case 'class': {
      const cls = await Class.findByPk(value, { attributes: ['id', 'lecturer_id'] });
      if (!cls) return [];
      const enrolled = await Enrollment.findAll({ where: { class_id: cls.id }, attributes: ['student_id'] });
      const ids = [...new Set([cls.lecturer_id, ...enrolled.map(e => e.student_id)])];
      return User.findAll({ where: { ...base, id: ids }, attributes: attrs });
    }
    default:
      return [];
  }
}

async function countRecipients(audience, value) {
  return (await resolveRecipients(audience, value)).length;
}

async function inBatches(items, size, fn) {
  let failed = 0;
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.all(items.slice(i, i + size).map(fn));
    failed += results.filter(ok => ok === false).length;
  }
  return failed;
}

// Sends one announcement. Safe to call twice: it claims the row by
// moving it to 'sending' first and bails if another call got there.
async function deliver(announcementId, io) {
  const [claimed] = await Announcement.update(
    { status: 'sending' },
    { where: { id: announcementId, status: { [Op.in]: ['draft', 'scheduled'] } } },
  );
  if (!claimed) return null;
  const ann = await Announcement.findByPk(announcementId);

  try {
    const recipients = await resolveRecipients(ann.audience, ann.audience_value);
    const author = ann.created_by ? await User.findByPk(ann.created_by, { attributes: ['name'] }) : null;

    for (let i = 0; i < recipients.length; i += 500) {
      const chunk = recipients.slice(i, i + 500);
      await AnnouncementReceipt.bulkCreate(
        chunk.map(u => ({ announcement_id: ann.id, user_id: u.id })),
        { ignoreDuplicates: true },
      );
      if (ann.send_in_app) {
        const rows = await Notification.bulkCreate(chunk.map(u => ({
          user_id: u.id,
          type:    'announcement',
          title:   ann.title,
          message: ann.body.length > 600 ? `${ann.body.slice(0, 597)}...` : ann.body,
          data:    { announcementId: ann.id },
        })));
        rows.forEach(n => io?.to(`user:${n.user_id}`).emit('notification:new', {
          id: n.id, type: n.type, title: n.title, message: n.message,
          data: n.data, read: false, createdAt: n.created_at,
        }));
      }
    }

    // Marked sent once every recipient has their receipt and in-app
    // copy. Emails follow; a restart part-way through can then only
    // cost some emails, never leave the announcement stuck "sending".
    await ann.update({ status: 'sent', sent_at: new Date(), recipient_count: recipients.length });

    let emailFailures = 0;
    if (ann.send_email) {
      emailFailures = await inBatches(recipients.filter(u => u.email), 5, u => sendAnnouncementEmail({
        to: u.email, name: u.name, title: ann.title, message: ann.body,
        senderName: author?.name ?? 'AttendX',
      }));
      if (emailFailures) console.warn(`[Announcements] ${emailFailures} of ${recipients.length} emails failed for ${ann.id}`);
    }
    return { recipients: recipients.length, emailFailures };
  } catch (err) {
    console.error('[Announcements] delivery failed:', err.message);
    await ann.update({ status: 'failed' }).catch(() => {});
    return null;
  }
}

// Marks announcement receipts read when their notifications are read.
async function markRead(userId, { notificationId, all = false } = {}) {
  try {
    const where = { user_id: userId, read_at: null };
    if (!all) {
      const note = await Notification.findOne({ where: { id: notificationId, user_id: userId } });
      const annId = note?.data?.announcementId;
      if (!annId) return;
      where.announcement_id = annId;
    }
    await AnnouncementReceipt.update({ read_at: new Date() }, { where });
  } catch (err) {
    console.warn('[Announcements] read receipt failed:', err.message);
  }
}

function startAnnouncementPoller(io) {
  setInterval(async () => {
    beat('announcements');
    try {
      const due = await Announcement.findAll({
        where: { status: 'scheduled', scheduled_for: { [Op.lte]: new Date() } },
        attributes: ['id'],
      });
      for (const a of due) await deliver(a.id, io);
    } catch (err) {
      if (!/does not exist/.test(err.message)) console.error('[Announcements] poller:', err.message);
    }
  }, 60_000);
}

module.exports = { resolveRecipients, countRecipients, deliver, markRead, startAnnouncementPoller };
