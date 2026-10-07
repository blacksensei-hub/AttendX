// server/src/utils/roles.test.js   (run: npm test, in server/)
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { signupRole } = require('./roles');

test('students and lecturers can sign themselves up', () => {
  assert.equal(signupRole('student'), 'student');
  assert.equal(signupRole('lecturer'), 'lecturer');
});

test('no role means a student, as before', () => {
  assert.equal(signupRole(undefined), 'student');
  assert.equal(signupRole(null), 'student');
});

test('nobody can sign themselves up as an admin', () => {
  assert.equal(signupRole('admin'), null);
});

test('anything else is refused, not quietly turned into something', () => {
  for (const role of ['Admin', 'ADMIN', ' admin', 'superuser', '', ['admin'], { role: 'admin' }, 1]) {
    assert.equal(signupRole(role), null, JSON.stringify(role));
  }
});
