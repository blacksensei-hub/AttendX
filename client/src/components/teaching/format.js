// client/src/components/teaching/format.js

/** Helpers shared by the lecturer and student pages (kept out of the
 *  component files so fast refresh keeps working). */

// Teal at or above the minimum, amber within 5 points, red further below.
export const rateTone = (rate, threshold) =>
  rate == null ? 'warn' : rate >= threshold ? 'good' : rate >= threshold - 5 ? 'warn' : 'bad';

const WORD = { present: 'present', late: 'late', excused: 'excused', absent: 'absent' };
export function summariseRegister(statuses) {
  const n = { present: 0, late: 0, excused: 0, absent: 0 };
  statuses.forEach(s => { if (s in n) n[s] += 1; });
  return Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${v} ${WORD[k]}`).join(', ') || 'no sessions';
}

export const fmtDay = (d, opts = {}) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...opts });
export const fmtWeekday = (d) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Dates on the institution's clock (UTC, see server timetableService).
export const isoDay = (d = new Date()) => new Date(d).toISOString().slice(0, 10);
export const addDays = (day, n) => isoDay(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000);
export function mondayOf(day = isoDay()) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}
export const dayLabel = (day, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/**
 * "What it takes": given where a student stands and the sessions still
 * to come, how many more they need, how many they can miss, and where
 * they would finish if they miss `miss` of the rest.
 */
export function planFor({ counted, held, threshold, remaining }, miss = 0) {
  const total = held + remaining;
  const needTotal = Math.ceil((threshold / 100) * total - 1e-9);
  const mustAttend = Math.max(0, needTotal - counted);
  const reachable = mustAttend <= remaining;
  const canMiss = reachable ? remaining - mustAttend : 0;
  const attendFromNow = Math.max(0, remaining - miss);
  const projected = total ? Math.round(((counted + attendFromNow) / total) * 1000) / 10 : null;
  const best = total ? Math.round(((counted + remaining) / total) * 1000) / 10 : null;
  return { total, mustAttend, canMiss, reachable, projected, best };
}
