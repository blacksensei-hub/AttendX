// server/src/controllers/authController.test.js
//
// One phone per student: the binding made at sign-in, through login, with
// the database and fraud log swapped for stand-ins.
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { fake, response } = require('../test/fakes');

process.env.JWT_SECRET = 'test-only-secret';
process.env.JWT_EXPIRES_IN = '1h';

let user;
const attempts = [];
fake('models/index.js', {
  User: {
    scope: () => ({ findOne: async ({ where }) => (user && where.email === user.email ? user : null) }),
    update: async () => [1],
  },
});
fake('services/fraudService.js', {
  recordAttempt: (attempt) => { attempts.push(attempt); return Promise.resolve(); },
});
fake('services/inviteService.js', { hashToken: () => 'hash' });

const { login } = require('./authController');

let passwordHash;
before(async () => { passwordHash = await bcrypt.hash('correct horse', 4); });

beforeEach(() => {
  attempts.length = 0;
  user = {
    id: 'u1', email: 'ama@example.test', name: 'Ama', role: 'student', token_version: 0,
    password: passwordHash, is_active: true, invite_token_hash: null,
    bound_mobile_device_id: null, mobile_device_bound_at: null,
    async update(values) { Object.assign(this, values); return this; },
  };
});

async function signIn(body) {
  const res = response();
  await login({ ip: '10.0.0.7', body: { email: 'ama@example.test', password: 'correct horse', ...body } }, res);
  return res;
}

test("a student's first sign-in from the app binds their phone", async () => {
  const res = await signIn({ platform: 'mobile', deviceId: 'phone-1' });
  assert.equal(res.statusCode, 200);
  assert.equal(user.bound_mobile_device_id, 'phone-1');
  assert.ok(user.mobile_device_bound_at instanceof Date);
});

test('the same phone signs in again', async () => {
  user.bound_mobile_device_id = 'phone-1';
  const res = await signIn({ platform: 'mobile', deviceId: 'phone-1' });
  assert.equal(res.statusCode, 200);
});

test('another phone is refused, and the attempt is kept for review', async () => {
  user.bound_mobile_device_id = 'phone-1';
  const res = await signIn({ platform: 'mobile', deviceId: 'phone-2' });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /different phone/);
  assert.equal(res.body.token, undefined);
  assert.equal(attempts[0].reason, 'device_mismatch');
  assert.equal(user.bound_mobile_device_id, 'phone-1');   // the binding is not moved
});

test('a wrong password says nothing about the phone', async () => {
  user.bound_mobile_device_id = 'phone-1';
  const res = await signIn({ password: 'wrong', platform: 'mobile', deviceId: 'phone-2' });
  assert.equal(res.statusCode, 401);
  assert.equal(attempts.length, 0);
});

test('signing in on the website never binds or checks a phone', async () => {
  user.bound_mobile_device_id = 'phone-1';
  const res = await signIn({ platform: 'web', deviceId: 'laptop' });
  assert.equal(res.statusCode, 200);
  assert.equal(user.bound_mobile_device_id, 'phone-1');
});

test("lecturers aren't bound to a phone", async () => {
  user.role = 'lecturer';
  const res = await signIn({ platform: 'mobile', deviceId: 'phone-9' });
  assert.equal(res.statusCode, 200);
  assert.equal(user.bound_mobile_device_id, null);
});

test('a deactivated account cannot sign in', async () => {
  user.is_active = false;
  assert.equal((await signIn({})).statusCode, 403);
});
