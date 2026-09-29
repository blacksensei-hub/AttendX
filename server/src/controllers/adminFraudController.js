// server/src/controllers/adminFraudController.js
const { Op } = require('sequelize');
const {
  sequelize, FraudFlag, User, Session, Attendance, AttendanceAdjustment,
} = require('../models');
const { KINDS, sweepSession } = require('../services/fraudService');
const { createNotification } = require('../services/notificationService');
const { audit } = require('../services/auditService');
const { success, error } = require('../utils/apiResponse');

/**
 * ═════════════════════════════════════════════════════════════════
 * The fraud review queue. Flags are raised by services/fraudService;
 * here an admin reads the evidence and settles each one:
 *
 *   dismiss      nothing wrong (a shared phone for a good reason, say)
 *   warn         in-app security notice to the student(s) involved
 *   mark_absent  set the session's attendance to absent, with an
 *                adjustment record, for everyone the flag names
 *   deactivate   switch the account(s) off and sign them out
 * ═════════════════════════════════════════════════════════════════
 */

const ACTIONS = ['dismiss', 'warn', 'mark_absent', 'deactivate'];

// The students a flag is about: its own user, or the list in evidence
// (one-phone and same-position flags name several).
const studentsOf = (flag) => flag.user_id
  ? [flag.user_id]
  : (flag.evidence?.students ?? []).map(s => s.id).filter(Boolean);

const countByStatus = async () => {
  const grouped = await FraudFlag.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
    group: ['status'], raw: true,
  });
  const counts = { open: 0, dismissed: 0, actioned: 0 };
  for (const g of grouped) counts[g.status] = Number(g.n);
  return counts;
};

exports.list = async (req, res) => {
  try {
    // ?summary=1 is the nav badge's cheap poll: counts only.
    if (req.query.summary) return res.json(success({ counts: await countByStatus() }));

    const status = ['open', 'dismissed', 'actioned'].includes(req.query.status) ? req.query.status : 'open';
    const where = { status };
    if (req.query.kind && KINDS[req.query.kind]) where.kind = req.query.kind;
    if (['low', 'medium', 'high'].includes(req.query.severity)) where.severity = req.query.severity;

    const [flags, counts] = await Promise.all([
      FraudFlag.findAll({
        where,
        include: [
          { model: User,    as: 'user',     attributes: ['id', 'name', 'email', 'student_id', 'is_active'] },
          { model: User,    as: 'reviewer', attributes: ['id', 'name'] },
          { model: Session, as: 'session',  attributes: ['id', 'title', 'class_name_snapshot', 'open_at'] },
        ],
        order: [
          [sequelize.literal(`CASE "FraudFlag"."severity" WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`), 'ASC'],
          ['created_at', 'DESC'],
        ],
        limit: 200,
      }),
      countByStatus(),
    ]);
    return res.json(success({ flags, counts, kinds: KINDS }));
  } catch (err) {
    console.error('[Fraud] list:', err.message);
    return res.status(500).json(error('Could not load the review queue'));
  }
};

exports.review = async (req, res) => {
  try {
    const { action, note = '' } = req.body ?? {};
    if (!ACTIONS.includes(action)) return res.status(400).json(error('Unknown review action'));

    const flag = await FraudFlag.findByPk(req.params.id, {
      include: [{ model: Session, as: 'session', attributes: ['id', 'class_name_snapshot'] }],
    });
    if (!flag) return res.status(404).json(error('Flag not found'));
    if (flag.status !== 'open') return res.status(409).json(error('This flag has already been reviewed'));

    const studentIds = studentsOf(flag);
    const io = req.app.get('io');
    let affected = 0;

    if (action === 'warn') {
      const where = flag.session?.class_name_snapshot ?? null;
      for (const id of studentIds) {
        await createNotification(io, {
          userId:  id,
          type:    'security',
          title:   'Attendance integrity notice',
          message: `Our checks noticed "${KINDS[flag.kind]?.label ?? flag.kind}" on your account${where ? ` in ${where}` : ''}. ` +
                   'Attendance must be marked by you, on your own phone, from the classroom. ' +
                   'If you think this is a mistake, contact your administrator.',
          data:    { flagId: flag.id },
        }).then(() => { affected += 1; }).catch(err => console.warn('[Fraud] warn failed:', err.message));
      }
    }

    if (action === 'mark_absent') {
      if (!flag.session_id) return res.status(400).json(error('This flag is not tied to a session'));
      const records = await Attendance.findAll({ where: { session_id: flag.session_id, student_id: studentIds } });
      for (const a of records) {
        if (a.status === 'absent') continue;
        await sequelize.transaction(async (transaction) => {
          await AttendanceAdjustment.create({
            attendance_id: a.id, session_id: a.session_id, student_id: a.student_id,
            adjusted_by: req.user.id, old_status: a.status, new_status: 'absent',
            reason: `Fraud review: ${KINDS[flag.kind]?.label ?? flag.kind}${note ? `. ${note}` : ''}`,
          }, { transaction });
          await a.update({ status: 'absent' }, { transaction });
        });
        affected += 1;
      }
    }

    if (action === 'deactivate') {
      const users = await User.findAll({ where: { id: studentIds, is_active: true } });
      for (const u of users) {
        await u.update({ is_active: false, token_version: u.token_version + 1 });
        io?.to(`user:${u.id}`).emit('auth:force_logout', { reason: 'Your account was deactivated by an administrator.' });
        affected += 1;
      }
    }

    const resolution = { dismiss: 'dismissed', warn: 'warned', mark_absent: 'marked_absent', deactivate: 'deactivated' }[action];
    await flag.update({
      status:          action === 'dismiss' ? 'dismissed' : 'actioned',
      resolution,
      resolution_note: String(note).slice(0, 2000) || null,
      reviewed_by:     req.user.id,
      reviewed_at:     new Date(),
    });

    await audit(req, {
      action:  'fraud.reviewed',
      target:  { type: 'fraud_flag', id: flag.id, label: KINDS[flag.kind]?.label ?? flag.kind },
      summary: action === 'dismiss'
        ? `Dismissed: ${flag.summary}`
        : `${resolution.replace('_', ' ')} (${affected} student${affected === 1 ? '' : 's'}): ${flag.summary}`,
      changes: { action, students: studentIds, note: note || null },
    });

    return res.json(success({ flag, affected }, action === 'dismiss' ? 'Flag dismissed' : 'Done'));
  } catch (err) {
    console.error('[Fraud] review:', err.message);
    return res.status(500).json(error('Could not complete the review'));
  }
};

// Re-runs the session-level rules over the last 7 days of closed sessions.
exports.sweep = async (req, res) => {
  try {
    const before = await FraudFlag.count();
    const sessions = await Session.findAll({
      where: { status: 'closed', open_at: { [Op.gte]: new Date(Date.now() - 7 * 86_400_000) } },
      attributes: ['id', 'class_id'],
    });
    for (const s of sessions) await sweepSession(s);
    const raised = (await FraudFlag.count()) - before;
    return res.json(success({ sessions: sessions.length, raised }, raised ? `${raised} new flag${raised === 1 ? '' : 's'}` : 'No new patterns found'));
  } catch (err) {
    console.error('[Fraud] sweep:', err.message);
    return res.status(500).json(error('Sweep failed'));
  }
};
