// client/src/components/teaching/RegisterStrip.jsx
import { useLayoutEffect, useRef } from 'react';
import { revealGrid } from '../../lib/anime';
import { summariseRegister, fmtDay } from './format';

/**
 * ═════════════════════════════════════════════════════════════════
 * The register strip: one square per session, oldest on the left, the
 * way a paper register reads across. Teal present, amber late, violet
 * excused, a red ring for absent, a faint outline for sessions from
 * before the student enrolled. Each square has its date and status as
 * a tooltip, and the strip as a whole a text summary, so none of it is
 * colour alone.
 *
 * `large` shows a letter in each square and waves the squares in once
 * with anime.js (the drill-down page); the small strip in the class
 * register is static because a table can hold hundreds of them.
 * ═════════════════════════════════════════════════════════════════
 */

const LETTER = { present: 'P', late: 'L', excused: 'E', absent: 'A' };
const WORD = { present: 'present', late: 'late', excused: 'excused', absent: 'absent' };

export default function RegisterStrip({ statuses = [], sessions = [], large = false, label = 'Recent sessions' }) {
  const ref = useRef(null);
  const animated = useRef(false);

  useLayoutEffect(() => {
    if (!large || animated.current || !ref.current || statuses.length === 0) return undefined;
    animated.current = true;
    return revealGrid(ref.current.children, { each: 18 });
  }, [large, statuses.length]);

  return (
    <span ref={ref} className={`reg${large ? ' is-large' : ''}`} role="img"
          aria-label={`${label}: ${summariseRegister(statuses)}`}>
      {statuses.map((s, i) => {
        const when = sessions[i]?.openAt ? fmtDay(sessions[i].openAt) : `Session ${i + 1}`;
        return (
          <span key={sessions[i]?.id ?? sessions[i]?.sessionId ?? i}
                className={`reg-cell ${s ?? 'none'}`}
                title={`${when}: ${s ? WORD[s] : 'before enrolling'}`}>
            {s ? LETTER[s] : ''}
          </span>
        );
      })}
    </span>
  );
}

export function RegisterLegend() {
  return (
    <div className="reg-legend" aria-hidden="true">
      <span><span className="reg-cell present" /> Present</span>
      <span><span className="reg-cell late" /> Late</span>
      <span><span className="reg-cell excused" /> Excused</span>
      <span><span className="reg-cell absent" /> Absent</span>
    </div>
  );
}
