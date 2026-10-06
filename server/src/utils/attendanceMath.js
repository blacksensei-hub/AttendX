// server/src/utils/attendanceMath.js

/**
 * How many sessions in a row a student must attend to bring their rate
 * back up to `threshold` percent, having attended `attended` of `total`.
 *
 * Every session attended adds one to both counts, so the target moves
 * as they go: 6 of 10 against a 75% minimum needs 6 more (12 of 16),
 * not the 2 that "75% of 10, minus 6" suggests. Solved in whole numbers:
 *
 *   (attended + n) * 100 >= threshold * (total + n)
 *   n >= (threshold * total - 100 * attended) / (100 - threshold)
 *
 * Returns 0 when the rate is already at the minimum, and null when no
 * number of sessions can get there (a 100% minimum after any miss).
 */
function sessionsToRecover({ attended, total, threshold }) {
  const short = threshold * total - 100 * attended;
  if (short <= 0) return 0;
  if (threshold >= 100) return null;
  const gain = 100 - threshold;
  return Math.floor((short + gain - 1) / gain);   // ceil, without float error
}

/**
 * What a student at risk is told. `remaining` is how many timetabled
 * sessions are left this semester, or null when no semester is set (so
 * there is nothing to check the number against).
 *
 *   sessions   in a row to get back to the minimum, or null if never
 *   reachable  false when that is more than the sessions left
 */
function recoveryPlan({ attended, total, threshold, remaining = null }) {
  const sessions = sessionsToRecover({ attended, total, threshold });
  const reachable = sessions !== null && (remaining === null || sessions <= remaining);
  return { sessions, remaining, reachable };
}

module.exports = { sessionsToRecover, recoveryPlan };
