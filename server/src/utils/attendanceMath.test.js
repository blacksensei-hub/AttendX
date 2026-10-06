// server/src/utils/attendanceMath.test.js   (run: npm test, in server/)
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { sessionsToRecover, recoveryPlan } = require('./attendanceMath');

// The rate after attending n more, as the dashboard works it out.
const rateAfter = ({ attended, total }, n) => ((attended + n) * 100) / (total + n);

test('6 of 10 against 75% needs 6 more, not 2', () => {
  assert.equal(sessionsToRecover({ attended: 6, total: 10, threshold: 75 }), 6);
  assert.ok(rateAfter({ attended: 6, total: 10 }, 2) < 75);    // the old answer fell short
  assert.equal(rateAfter({ attended: 6, total: 10 }, 6), 75);
});

test('the answer is always the fewest sessions that reach the minimum', () => {
  for (const threshold of [50, 60, 70, 75, 80, 90, 95, 99]) {
    for (let total = 1; total <= 40; total += 1) {
      for (let attended = 0; attended <= total; attended += 1) {
        const n = sessionsToRecover({ attended, total, threshold });
        const at = { attended, total };
        assert.ok(rateAfter(at, n) >= threshold, `${attended}/${total} @${threshold}: ${n} is not enough`);
        if (n > 0) assert.ok(rateAfter(at, n - 1) < threshold, `${attended}/${total} @${threshold}: ${n - 1} would do`);
      }
    }
  }
});

test('nothing is needed at or above the minimum, or before any session', () => {
  assert.equal(sessionsToRecover({ attended: 3, total: 4, threshold: 75 }), 0);
  assert.equal(sessionsToRecover({ attended: 10, total: 10, threshold: 100 }), 0);
  assert.equal(sessionsToRecover({ attended: 0, total: 0, threshold: 75 }), 0);
});

test('a 100% minimum can never be reached again after a miss', () => {
  assert.equal(sessionsToRecover({ attended: 9, total: 10, threshold: 100 }), null);
  assert.deepEqual(recoveryPlan({ attended: 9, total: 10, threshold: 100, remaining: 20 }), {
    sessions: null, remaining: 20, reachable: false,
  });
});

test('out of reach when more are needed than are left this semester', () => {
  assert.deepEqual(recoveryPlan({ attended: 6, total: 10, threshold: 75, remaining: 5 }), {
    sessions: 6, remaining: 5, reachable: false,
  });
  assert.equal(recoveryPlan({ attended: 6, total: 10, threshold: 75, remaining: 6 }).reachable, true);
  assert.equal(recoveryPlan({ attended: 6, total: 10, threshold: 75, remaining: 0 }).reachable, false);
});

test('with no semester set there is no limit to check against', () => {
  assert.deepEqual(recoveryPlan({ attended: 6, total: 10, threshold: 75 }), {
    sessions: 6, remaining: null, reachable: true,
  });
});
