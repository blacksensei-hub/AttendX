// server/src/services/classAccess.js
const { Op } = require('sequelize');
const { Class, ClassStaff } = require('../models');

/**
 * ═════════════════════════════════════════════════════════════════
 * Who may do what with a class.
 *
 * A class has one owner (classes.lecturer_id) and any number of
 * co-lecturers and teaching assistants (class_staff). Permissions:
 *
 *   view   see the class, its register, reports and timetable
 *   run    open and close sessions, show the QR code
 *   edit   change attendance, review appeals and excuse requests,
 *          edit schedules and the attendance minimum
 *   own    delete the class or a session report, manage staff
 *
 *   owner        view run edit own
 *   co_lecturer  view run edit
 *   ta           view run
 * ═════════════════════════════════════════════════════════════════
 */

const GRANTS = {
  owner:       new Set(['view', 'run', 'edit', 'own']),
  co_lecturer: new Set(['view', 'run', 'edit']),
  ta:          new Set(['view', 'run']),
};

const can = (role, perm) => Boolean(role && GRANTS[role]?.has(perm));

// Postgres rejects a malformed uuid with an error; treat it as "not found".
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// The caller's role on one class: 'owner', 'co_lecturer', 'ta' or null.
async function roleOn(userId, cls) {
  if (!cls) return null;
  if (cls.lecturer_id === userId) return 'owner';
  const row = await ClassStaff.findOne({ where: { class_id: cls.id, user_id: userId }, attributes: ['role'] });
  return row?.role ?? null;
}

/**
 * The class if the user holds `perm` on it, otherwise null (callers
 * answer 404 either way, so a class you can't see looks like one that
 * doesn't exist). The role is attached as cls.myRole.
 */
async function findClassFor(userId, classId, perm = 'view', options = {}) {
  if (!isUuid(classId)) return null;
  const cls = await Class.findByPk(classId, options);
  const role = await roleOn(userId, cls);
  if (!can(role, perm)) return null;
  cls.myRole = role;
  return cls;
}

// Ids of every class the user holds `perm` on, with their role.
async function classRoles(userId, perm = 'view') {
  const [owned, staffed] = await Promise.all([
    Class.findAll({ where: { lecturer_id: userId }, attributes: ['id'] }),
    ClassStaff.findAll({ where: { user_id: userId }, attributes: ['class_id', 'role'] }),
  ]);
  const roles = new Map(owned.map(c => [c.id, 'owner']));
  staffed.forEach(s => { if (!roles.has(s.class_id)) roles.set(s.class_id, s.role); });
  for (const [id, role] of roles) if (!can(role, perm)) roles.delete(id);
  return roles;
}

async function classIdsFor(userId, perm = 'view') {
  return [...(await classRoles(userId, perm)).keys()];
}

/**
 * SQL condition for raw queries: the class aliased `alias` is one the
 * user teaches (owner or any staff role). Bind the user id as `param`.
 * Used where a query only reads, so every staff role qualifies.
 */
const taughtBySql = (alias = 'c', param = ':lecturerId') =>
  `(${alias}.lecturer_id = ${param} OR EXISTS (SELECT 1 FROM class_staff cs_ WHERE cs_.class_id = ${alias}.id AND cs_.user_id = ${param}))`;

// The same for the roles that may change attendance and review
// requests (owner and co-lecturers, not TAs).
const reviewableBySql = (alias = 'c', param = ':lecturerId') =>
  `(${alias}.lecturer_id = ${param} OR EXISTS (SELECT 1 FROM class_staff cs_ WHERE cs_.class_id = ${alias}.id AND cs_.user_id = ${param} AND cs_.role = 'co_lecturer'))`;

// Sequelize where-clause equivalent for Class.findAll.
async function taughtWhere(userId, perm = 'view') {
  return { id: { [Op.in]: await classIdsFor(userId, perm) } };
}

// Everyone who should hear about a class's requests: owner and co-lecturers.
async function reviewersOf(cls) {
  const staff = await ClassStaff.findAll({ where: { class_id: cls.id, role: 'co_lecturer' }, attributes: ['user_id'] });
  return [...new Set([cls.lecturer_id, ...staff.map(s => s.user_id)])];
}

module.exports = { GRANTS, can, isUuid, roleOn, findClassFor, classRoles, classIdsFor, taughtBySql, reviewableBySql, taughtWhere, reviewersOf };
