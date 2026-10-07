// server/src/services/classAccess.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { fake } = require('../test/fakes');

const OWNER = 'owner';
const CO = 'co-lecturer';
const TA = 'assistant';
const STRANGER = 'someone-else';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ID = '44444444-4444-4444-8444-444444444444';

const classes = [
  { id: CLASS_ID, lecturer_id: OWNER },
  { id: OTHER_ID, lecturer_id: STRANGER },
];
const staff = [
  { class_id: CLASS_ID, user_id: CO, role: 'co_lecturer' },
  { class_id: CLASS_ID, user_id: TA, role: 'ta' },
  { class_id: OTHER_ID, user_id: OWNER, role: 'ta' },
];
fake('models/index.js', {
  Class: {
    findByPk: async (id) => { const c = classes.find(x => x.id === id); return c ? { ...c } : null; },
    findAll: async ({ where }) => classes.filter(c => c.lecturer_id === where.lecturer_id),
  },
  ClassStaff: {
    findOne: async ({ where }) => staff.find(s => s.class_id === where.class_id && s.user_id === where.user_id) ?? null,
    findAll: async ({ where }) => staff.filter(s => (where.user_id === undefined || s.user_id === where.user_id)
      && (where.class_id === undefined || s.class_id === where.class_id)
      && (where.role === undefined || s.role === where.role)),
  },
});
const { can, findClassFor, classIdsFor, reviewersOf } = require('./classAccess');

test('the permission table: owner, co-lecturer, teaching assistant', () => {
  const table = {
    owner:       { view: true, run: true, edit: true, own: true },
    co_lecturer: { view: true, run: true, edit: true, own: false },
    ta:          { view: true, run: true, edit: false, own: false },
  };
  for (const [role, perms] of Object.entries(table))
    for (const [perm, allowed] of Object.entries(perms))
      assert.equal(can(role, perm), allowed, `${role} ${perm}`);
});

test('no role, or an unknown one, grants nothing', () => {
  for (const role of [null, undefined, '', 'student', 'admin'])
    assert.equal(can(role, 'view'), false, String(role));
});

test('each person reaches the class only as far as their role allows', async () => {
  const cases = [
    [OWNER, 'own', true], [OWNER, 'edit', true],
    [CO, 'edit', true], [CO, 'own', false],
    [TA, 'run', true], [TA, 'edit', false],
    [STRANGER, 'view', false],
  ];
  for (const [who, perm, allowed] of cases) {
    const cls = await findClassFor(who, CLASS_ID, perm);
    assert.equal(Boolean(cls), allowed, `${who} ${perm}`);
  }
});

test('the role found is attached to the class', async () => {
  assert.equal((await findClassFor(OWNER, CLASS_ID)).myRole, 'owner');
  assert.equal((await findClassFor(TA, CLASS_ID)).myRole, 'ta');
});

test("a class that doesn't exist, or a malformed id, is just not found", async () => {
  assert.equal(await findClassFor(OWNER, '55555555-5555-4555-8555-555555555555'), null);
  assert.equal(await findClassFor(OWNER, "1' OR '1'='1"), null);
  assert.equal(await findClassFor(OWNER, undefined), null);
});

test('class lists respect the permission asked for', async () => {
  // The owner owns one class and is a TA on another.
  assert.deepEqual((await classIdsFor(OWNER, 'view')).sort(), [CLASS_ID, OTHER_ID].sort());
  assert.deepEqual(await classIdsFor(OWNER, 'edit'), [CLASS_ID]);
  assert.deepEqual(await classIdsFor(STRANGER, 'view'), [OTHER_ID]);
});

test('requests go to the owner and co-lecturers, never TAs', async () => {
  assert.deepEqual((await reviewersOf(classes[0])).sort(), [CO, OWNER].sort());
});
