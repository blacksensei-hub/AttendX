// server/src/middleware/rateLimiters.test.js
//
// The sign-up limiter, through a real Express app: only accounts actually
// created count, and the 101st from one network in an hour is refused. Also
// checks the register route really uses it.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { fake } = require('../test/fakes');

const { signupLimiter } = require('./rateLimiters');

let server;
let base;

before(async () => {
  const app = express();
  app.use(express.json());
  // Stands in for the register controller: 201 when "ok", 400 otherwise.
  app.post('/register', signupLimiter, (req, res) =>
    res.status(req.body.ok ? 201 : 400).json({ success: Boolean(req.body.ok) }));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

const signUp = async (ok) => {
  const res = await fetch(`${base}/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok }),
  });
  return { status: res.status, body: await res.json() };
};

test('refused sign-ups never use the allowance, and the 101st account in an hour is refused', async () => {
  // A form full of typos, many times over: none of it counts.
  for (let i = 0; i < 150; i += 1) assert.equal((await signUp(false)).status, 400);

  // A lecture hall's worth of real sign-ups from one network.
  for (let i = 0; i < 100; i += 1) assert.equal((await signUp(true)).status, 201, `sign-up ${i + 1}`);

  const blocked = await signUp(true);
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.message, /Too many new accounts from this network/);
});

test('the register route uses the sign-up limiter', () => {
  const handler = (_req, res) => res.end();
  fake('controllers/authController.js', {
    register: handler, login: handler, getMe: handler, changePassword: handler,
    checkInvite: handler, acceptInvite: handler,
  });
  fake('middleware/authenticate.js', (_req, _res, next) => next());
  const router = require('../routes/auth');
  const layer = router.stack.find((l) => l.route?.path === '/register' && l.route.methods.post);
  assert.ok(layer, 'no POST /register route');
  assert.ok(layer.route.stack.some((s) => s.handle === signupLimiter), 'register is not rate limited');
});
