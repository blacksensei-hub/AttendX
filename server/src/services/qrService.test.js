// server/src/services/qrService.test.js
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { fake } = require('../test/fakes');

const SESSION = '11111111-1111-4111-8111-111111111111';
let row;
const created = [];
const updates = [];
fake('models/index.js', {
  QRToken: {
    findOne: async ({ where }) => (row && where.token === row.token ? row : null),
    create: async (values) => { created.push(values); return values; },
    update: async (values, options) => { updates.push({ values, options }); return [1]; },
  },
});
const { generateToken, validateToken } = require('./qrService');

beforeEach(() => {
  row = { token: 'tok', session_id: SESSION, expires_at: new Date(Date.now() + 5000) };
  created.length = 0;
  updates.length = 0;
});

test('a fresh code for this session is valid', async () => {
  const result = await validateToken('tok', SESSION);
  assert.equal(result.valid, true);
  assert.equal(result.qr, row);
});

test('an unknown code is refused', async () => {
  assert.deepEqual(await validateToken('photo-of-yesterday', SESSION), {
    valid: false, reason: 'QR code not recognised',
  });
});

test("another session's code is refused", async () => {
  const result = await validateToken('tok', '22222222-2222-4222-8222-222222222222');
  assert.equal(result.valid, false);
  assert.match(result.reason, /different session/);
});

test('the whole class can scan the same code', async () => {
  // Scanning doesn't use a code up; one scan per student is the attendance
  // table's unique index, not the code's.
  assert.equal((await validateToken('tok', SESSION)).valid, true);
  assert.equal((await validateToken('tok', SESSION)).valid, true);
});

test('an expired code is refused, and says how late it was', async () => {
  row.expires_at = new Date(Date.now() - 1500);
  const result = await validateToken('tok', SESSION);
  assert.equal(result.valid, false);
  assert.match(result.reason, /expired/);
  assert.ok(result.expiredMsAgo >= 1500 && result.expiredMsAgo < 2500, `expiredMsAgo ${result.expiredMsAgo}`);
});

test('a new code lives for its interval plus a two-second grace', async () => {
  const before = Date.now();
  await generateToken(SESSION, 5);
  const life = created[0].expires_at.getTime() - before;
  assert.ok(life >= 7000 && life < 7200, `lives ${life}ms`);
  assert.equal(created[0].session_id, SESSION);
  assert.ok(created[0].token.startsWith(SESSION.slice(0, 8) + '.'));
});

test("a new code ends the session's previous ones", async () => {
  await generateToken(SESSION, 5);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].options.where.session_id, SESSION);
  assert.ok(updates[0].values.expires_at.getTime() <= Date.now());
});

test('every code is different', async () => {
  await generateToken(SESSION, 5);
  await generateToken(SESSION, 5);
  assert.notEqual(created[0].token, created[1].token);
});
