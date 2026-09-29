// client/src/components/teaching/WeekTimetable.jsx
import { useLayoutEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { revealGrid } from '../../lib/anime';
import { useIsMobile } from '../../hooks/useIsMobile';
import { classLabel } from '../../lib/names';
import { addDays, dayLabel, isoDay } from './format';

/**
 * ═════════════════════════════════════════════════════════════════
 * A week of timetabled classes.
 *
 * Wide screens get a day-by-hour grid: each slot sits at its time,
 * with a coloured edge for what happened (teal held or live, red
 * missed, amber blocked by a holiday or exam period, cobalt still to
 * come), a hatched column for blocked days and a red line for now.
 * Phones get the same week as a list by day.
 *
 * Times are the institution's clock (UTC), exactly as the server
 * sends them. When the week changes the slots wave in with anime.js.
 *
 *   data    the /teaching/timetable or /me/timetable response
 *   sub     (slot) => the small line under the class name
 *   onSlot  (slot) => called when a slot is chosen
 * ═════════════════════════════════════════════════════════════════
 */

const STATE_WORD = { held: 'held', live: 'live now', missed: 'no session', blocked: 'no classes', upcoming: 'upcoming' };
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export function WeekNav({ week, onChange, busy }) {
  const start = week;
  const end = addDays(week, 6);
  const same = start.slice(0, 7) === end.slice(0, 7);
  const label = same
    ? `${Number(start.slice(8))} to ${dayLabel(end, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${dayLabel(start, { day: 'numeric', month: 'short' })} to ${dayLabel(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const thisWeek = (() => { const t = isoDay(); const dow = new Date(`${t}T00:00:00Z`).getUTCDay(); return addDays(t, -((dow + 6) % 7)); })();
  return (
    <div className="c-toolbar" aria-busy={busy || undefined}>
      <button type="button" className="icon-btn" onClick={() => onChange(addDays(week, -7))} aria-label="Previous week"><ChevronLeft size={16} /></button>
      <span className="tabular" style={{ fontWeight: 600, minWidth: 170, textAlign: 'center' }} aria-live="polite">{label}</span>
      <button type="button" className="icon-btn" onClick={() => onChange(addDays(week, 7))} aria-label="Next week"><ChevronRight size={16} /></button>
      {week !== thisWeek && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(thisWeek)}><CalendarDays size={14} /> This week</button>
      )}
    </div>
  );
}

export default function WeekTimetable({ data, sub, onSlot }) {
  const phone = useIsMobile(760);
  const gridRef = useRef(null);
  const classes = useMemo(() => new Map((data?.classes ?? []).map(c => [c.id, c])), [data]);
  const today = isoDay();

  const days = useMemo(() => {
    if (!data) return [];
    const all = Array.from({ length: 7 }, (_, i) => addDays(data.week.start, i));
    const used = new Set(data.slots.map(s => s.day));
    // Weekends only when something is on them.
    return all.filter((d, i) => i < 5 || used.has(d));
  }, [data]);

  const blockedOn = (day) => (data?.events ?? []).find(e => e.blocksSessions && e.startsOn <= day && e.endsOn >= day);

  const [fromH, toH] = useMemo(() => {
    const slots = data?.slots ?? [];
    if (!slots.length) return [8, 17];
    const lo = Math.min(...slots.map(s => toMin(s.start)));
    const hi = Math.max(...slots.map(s => toMin(s.end) + (toMin(s.end) < toMin(s.start) ? 1440 : 0)));
    return [Math.max(0, Math.floor(lo / 60) - 1), Math.min(24, Math.ceil(hi / 60) + 1)];
  }, [data]);

  // Wave the week's slots in whenever a different week arrives.
  useLayoutEffect(() => {
    if (!gridRef.current || !data) return undefined;
    return revealGrid(gridRef.current.querySelectorAll('.tt-slot, .agenda-item'), { each: 22 });
  }, [data?.week?.start, phone]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  const slotLabel = (s) => {
    const c = classes.get(s.classId);
    return `${classLabel(c?.code, c?.name)}, ${dayLabel(s.day, { weekday: 'long' })} ${s.start} to ${s.end}, ${STATE_WORD[s.state]}${sub ? `, ${sub(s) ?? ''}` : ''}`;
  };

  if (phone) {
    return (
      <div className="agenda" ref={gridRef}>
        {days.map(day => {
          const slots = data.slots.filter(s => s.day === day);
          const block = blockedOn(day);
          if (!slots.length && !block) return null;
          return (
            <section key={day} className={`agenda-day${day === today ? ' is-today' : ''}`}>
              <h3>{dayLabel(day)}{day === today ? ' · Today' : ''}{block ? ` · ${block.title}` : ''}</h3>
              {slots.map(s => {
                const c = classes.get(s.classId);
                return (
                  <button key={s.id} type="button" className={`agenda-item tt-${s.state}`} onClick={() => onSlot?.(s)} aria-label={slotLabel(s)}>
                    <span className="t">{s.start}<small>{s.end}</small></span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 650, lineHeight: 1.3 }}>{classLabel(c?.code, c?.name)}</span>
                      <span className="c-muted" style={{ fontSize: 12.5 }}>{sub?.(s) ?? c?.location ?? ''}</span>
                    </span>
                    <SlotSig state={s.state} />
                  </button>
                );
              })}
            </section>
          );
        })}
        {!data.slots.length && <p className="c-muted">No timetabled classes this week.</p>}
      </div>
    );
  }

  const hourPx = 58;
  const hours = Array.from({ length: toH - fromH }, (_, i) => fromH + i);
  const nowMin = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  return (
    <div className="tt" ref={gridRef} style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(0, 1fr))` }}>
      <div className="tt-dayhead" aria-hidden="true" />
      {days.map(day => {
        const block = blockedOn(day);
        return (
          <div key={day} className={`tt-dayhead${day === today ? ' is-today' : ''}${block ? ' is-blocked' : ''}`} title={block?.title}>
            <div className="d">{dayLabel(day, { weekday: 'short' })}</div>
            <div className="n tabular">{Number(day.slice(8))}</div>
          </div>
        );
      })}
      <div className="tt-hours" aria-hidden="true">
        {hours.map(h => <div key={h} className="tt-hour">{String(h).padStart(2, '0')}:00</div>)}
      </div>
      {days.map(day => {
        const slots = data.slots.filter(s => s.day === day);
        return (
          <div key={day} className={`tt-col${day === today ? ' is-today' : ''}${blockedOn(day) ? ' is-blocked' : ''}`}
               style={{ height: hours.length * hourPx }}>
            {hours.slice(1).map((h, i) => <div key={h} className="tt-line" style={{ top: (i + 1) * hourPx }} />)}
            {day === today && nowMin >= fromH * 60 && nowMin <= toH * 60 && (
              <div className="tt-now" style={{ top: ((nowMin - fromH * 60) / 60) * hourPx }} aria-hidden="true" />
            )}
            {slots.map(s => {
              const c = classes.get(s.classId);
              const top = ((toMin(s.start) - fromH * 60) / 60) * hourPx;
              const height = Math.max(34, (s.duration / 60) * hourPx - 4);
              return (
                <button key={s.id} type="button" className={`tt-slot ${s.state}`} style={{ top: top + 2, height }}
                        onClick={() => s.state !== 'blocked' && onSlot?.(s)} aria-label={slotLabel(s)}
                        title={s.blockedBy ? `No classes: ${s.blockedBy.title}` : undefined}>
                  <span className="t">{s.start}–{s.end}</span>
                  <span className="c">{classLabel(c?.code, c?.name)}</span>
                  {height > 60 && <span className="s">{sub?.(s) ?? c?.location ?? ''}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function SlotSig({ state }) {
  const tone = { held: 'good', live: 'live', missed: 'bad', blocked: 'warn', upcoming: 'idle' }[state];
  return <span className={`sig ${tone}`} style={{ fontSize: 12 }}>{STATE_WORD[state]}</span>;
}
