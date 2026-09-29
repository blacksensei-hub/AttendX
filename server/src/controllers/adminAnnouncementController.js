// server/src/controllers/adminAnnouncementController.js
const { Op, QueryTypes } = require('sequelize');
const { sequelize, Announcement, AnnouncementReceipt, User, Class } = require('../models');
const { countRecipients, deliver } = require('../services/announcementService');
const { audit } = require('../services/auditService');
const { success, error } = require('../utils/apiResponse');

/**
 * ═════════════════════════════════════════════════════════════════
 * Announcements from the admin console.
 *
 * Lifecycle: draft → (scheduled) → sending → sent | failed.
 * Only drafts and scheduled ones can be edited; "send now" hands the
 * row to services/announcementService.deliver in the background and
 * answers straight away, so a large audience never holds the request.
 * ═════════════════════════════════════════════════════════════════
 */

const AUDIENCES = ['all', 'role', 'class', 'department'];

async function describeAudience(audience, value) {
  if (audience === 'all') return 'Everyone';
  if (audience === 'role') return `All ${value}s`;
  if (audience === 'department') return `${value} department`;
  if (audience === 'class') {
    const cls = await Class.findByPk(value, { attributes: ['name', 'code'] });
    return cls ? `${cls.code} ${cls.name}` : 'A deleted class';
  }
  return audience;
}

function validate(body) {
  const { title, body: text, audience, audience_value, send_in_app = true, send_email = false } = body ?? {};
  if (!String(title ?? '').trim()) return 'Add a title';
  if (!String(text ?? '').trim()) return 'Write the message';
  if (!AUDIENCES.includes(audience)) return 'Choose who it goes to';
  if (audience !== 'all' && !String(audience_value ?? '').trim()) return 'Choose the group it goes to';
  if (!send_in_app && !send_email) return 'Send it in the app, by email, or both';
  return null;
}

// Everything the composer needs to offer as audiences.
exports.options = async (req, res) => {
  try {
    const [departments, classes] = await Promise.all([
      sequelize.query(`
        SELECT DISTINCT trim(department) AS department FROM users
        WHERE department IS NOT NULL AND trim(department) <> '' ORDER BY 1
      `, { type: QueryTypes.SELECT }),
      Class.findAll({ where: { is_active: true }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] }),
    ]);
    return res.json(success({ departments: departments.map(d => d.department), classes }));
  } catch (err) {
    return res.status(500).json(error('Could not load audiences'));
  }
};

exports.count = async (req, res) => {
  try {
    const n = await countRecipients(req.query.audience, req.query.value);
    return res.json(success({ recipients: n }));
  } catch (err) {
    return res.status(500).json(error('Could not count recipients'));
  }
};

exports.list = async (req, res) => {
  try {
    const rows = await Announcement.findAll({
      include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    const reads = rows.length ? await sequelize.query(`
      SELECT announcement_id AS id, count(*)::int AS delivered, count(read_at)::int AS read
      FROM announcement_receipts WHERE announcement_id IN (:ids) GROUP BY 1
    `, { replacements: { ids: rows.map(r => r.id) }, type: QueryTypes.SELECT }) : [];
    const byId = new Map(reads.map(r => [r.id, r]));

    const announcements = await Promise.all(rows.map(async a => ({
      ...a.toJSON(),
      audienceLabel: await describeAudience(a.audience, a.audience_value),
      delivered:     byId.get(a.id)?.delivered ?? 0,
      read:          byId.get(a.id)?.read ?? 0,
    })));
    return res.json(success({ announcements }));
  } catch (err) {
    console.error('[Announcements] list:', err.message);
    return res.status(500).json(error('Could not load announcements'));
  }
};

exports.receipts = async (req, res) => {
  try {
    const receipts = await AnnouncementReceipt.findAll({
      where: { announcement_id: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'role'] }],
      order: [['read_at', 'DESC NULLS LAST']],
      limit: 1000,
    });
    return res.json(success({ receipts }));
  } catch (err) {
    return res.status(500).json(error('Could not load read receipts'));
  }
};

// Create or update a draft; with scheduled_for it becomes scheduled.
exports.save = async (req, res) => {
  try {
    const bad = validate(req.body);
    if (bad) return res.status(400).json(error(bad));
    const { title, body, audience, audience_value = null, send_in_app = true, send_email = false, scheduled_for = null } = req.body;

    let when = null;
    if (scheduled_for) {
      when = new Date(scheduled_for);
      if (Number.isNaN(when.getTime())) return res.status(400).json(error('That schedule time is not valid'));
      if (when < new Date(Date.now() + 60_000)) return res.status(400).json(error('Schedule it at least a minute from now'));
    }
    const values = {
      title: title.trim(), body: body.trim(), audience,
      audience_value: audience === 'all' ? null : String(audience_value).trim(),
      send_in_app: Boolean(send_in_app), send_email: Boolean(send_email),
      scheduled_for: when, status: when ? 'scheduled' : 'draft',
    };

    let ann;
    if (req.params.id) {
      ann = await Announcement.findByPk(req.params.id);
      if (!ann) return res.status(404).json(error('Announcement not found'));
      if (!['draft', 'scheduled', 'failed'].includes(ann.status)) return res.status(409).json(error('Sent announcements cannot be edited'));
      await ann.update(values);
    } else {
      ann = await Announcement.create({ ...values, created_by: req.user.id });
    }
    await audit(req, {
      action: 'announcement.saved',
      target: { type: 'announcement', id: ann.id, label: ann.title },
      summary: when
        ? `Scheduled "${ann.title}" for ${when.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`
        : `Saved draft "${ann.title}"`,
    });
    return res.status(req.params.id ? 200 : 201).json(success({ announcement: ann }, when ? 'Scheduled' : 'Draft saved'));
  } catch (err) {
    console.error('[Announcements] save:', err.message);
    return res.status(500).json(error('Could not save the announcement'));
  }
};

exports.send = async (req, res) => {
  try {
    const ann = await Announcement.findByPk(req.params.id);
    if (!ann) return res.status(404).json(error('Announcement not found'));
    if (!['draft', 'scheduled', 'failed'].includes(ann.status)) return res.status(409).json(error('Already sent'));
    if (ann.status === 'failed') await ann.update({ status: 'draft' });

    const recipients = await countRecipients(ann.audience, ann.audience_value);
    if (recipients === 0) return res.status(400).json(error('Nobody is in that audience'));

    deliver(ann.id, req.app.get('io')).catch(err => console.error('[Announcements] send:', err.message));
    await audit(req, {
      action: 'announcement.sent',
      target: { type: 'announcement', id: ann.id, label: ann.title },
      summary: `Sent "${ann.title}" to ${recipients} people (${[ann.send_in_app && 'in app', ann.send_email && 'email'].filter(Boolean).join(' + ')})`,
    });
    return res.status(202).json(success({ recipients }, `Sending to ${recipients} people`));
  } catch (err) {
    console.error('[Announcements] send:', err.message);
    return res.status(500).json(error('Could not send the announcement'));
  }
};

exports.remove = async (req, res) => {
  try {
    const ann = await Announcement.findByPk(req.params.id);
    if (!ann) return res.status(404).json(error('Announcement not found'));
    if (!['draft', 'scheduled', 'failed'].includes(ann.status)) return res.status(409).json(error('Sent announcements stay on record'));
    await ann.destroy();
    await audit(req, {
      action: 'announcement.deleted',
      target: { type: 'announcement', id: ann.id, label: ann.title },
      summary: `Deleted ${ann.status} "${ann.title}"`,
    });
    return res.json(success(null, 'Deleted'));
  } catch (err) {
    return res.status(500).json(error('Could not delete the announcement'));
  }
};
