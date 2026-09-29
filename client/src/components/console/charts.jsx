// client/src/components/console/charts.jsx
import { useLayoutEffect, useMemo, useRef, useState, useEffect, useId } from 'react';
import { motion } from 'framer-motion';
import { drawIn, revealGrid } from '../../lib/anime';
import { EASE } from '../../lib/motion';
import { toneFor } from './format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Console charts, plain SVG and CSS.
 *
 *   TrendLine  a percentage over time, optional dashed comparison
 *              series (last semester); draws in once with anime.js
 *   BarList    labelled horizontal bars, 0 to 100
 *   HeatGrid   weekday by hour; colour is the attendance rate,
 *              empty cells are hours with no sessions
 *
 * Every chart has a text alternative: values are in the markup
 * (titles, labels), never only in colour or position.
 * ═════════════════════════════════════════════════════════════════
 */

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function TrendLine({ data = [], compare, height = 190, yMax = 100, label = 'Attendance rate by week', threshold = null }) {
  const box = useRef(null);
  const svgRef = useRef(null);
  const drawn = useRef(false);
  const width = useWidth(box);
  const [hover, setHover] = useState(null);
  const gid = useId().replace(/:/g, '');

  const pad = { t: 12, r: 10, b: 24, l: 34 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const n = Math.max(data.length, compare?.length ?? 0);
  const x = (i) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - (Math.max(0, Math.min(yMax, v)) / yMax) * ih;

  const path = (series) => series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const line = width ? path(data) : '';
  const area = line ? `${line} L${x(data.length - 1).toFixed(1)},${pad.t + ih} L${x(0).toFixed(1)},${pad.t + ih} Z` : '';
  const prevLine = width && compare?.length ? path(compare) : '';

  // Draw the line in once, the first time there is something to draw.
  useLayoutEffect(() => {
    if (drawn.current || !line || !svgRef.current) return undefined;
    drawn.current = true;
    return drawIn(svgRef.current.querySelectorAll('.line'), { duration: 1200 });
  }, [line]);

  if (!data.length) {
    return <div className="dt-empty" style={{ height }}>Not enough closed sessions to draw a trend yet.</div>;
  }

  const onMove = (e) => {
    if (!width) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.l;
    const i = Math.round((px / (iw || 1)) * (n - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const h = hover != null ? data[hover] : null;
  return (
    <div className="trend" ref={box} style={{ position: 'relative' }}>
      {width > 0 && (
        <svg ref={svgRef} height={height} role="img" aria-label={`${label}: ${data.map(d => `${d.label} ${d.value}%`).join(', ')}`}
             onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={`trendFill-${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map(t => (
            <g key={t}>
              <line className="axis" x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} strokeDasharray={t ? '2 5' : undefined} />
              <text x={pad.l - 8} y={y(t) + 3} textAnchor="end">{t}</text>
            </g>
          ))}
          {threshold != null && (
            <g className="threshold">
              <line x1={pad.l} x2={pad.l + iw} y1={y(threshold)} y2={y(threshold)} />
              <text x={pad.l + iw} y={y(threshold) - 5} textAnchor="end">Minimum {threshold}%</text>
            </g>
          )}
          {prevLine && <path className="line prev" d={prevLine} />}
          <path d={area} fill={`url(#trendFill-${gid})`} />
          <path className="line" d={line} />
          {data.map((d, i) => (i === data.length - 1 || i === hover) && (
            <circle key={i} className="dot" cx={x(i)} cy={y(d.value)} r={i === hover ? 4.5 : 3.5} />
          ))}
          {/* Ticks span the longer series, so a comparison reads on one axis. */}
          {[0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => (
            <text key={`x${i}`} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{data[i]?.label ?? compare?.[i]?.label}</text>
          ))}
          {hover != null && <line className="axis" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} />}
        </svg>
      )}
      {h && (
        <div className="chip" style={{ position: 'absolute', top: 0, left: Math.min(Math.max(x(hover) - 60, 0), width - 150), pointerEvents: 'none' }}>
          <span className="tabular">{h.label}: {h.value}%</span>
          {compare?.[hover] && <span className="c-muted tabular">vs {compare[hover].value}%</span>}
        </div>
      )}
    </div>
  );
}

export function BarList({ rows = [], threshold = 75 }) {
  if (!rows.length) return <div className="dt-empty">Nothing to compare yet.</div>;
  return (
    <div className="barlist">
      {rows.map((r, i) => (
        <div key={r.label} className="barlist-row">
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.label}
            {r.meta && <span className="c-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{r.meta}</span>}
          </span>
          <span className="tabular" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.value}%</span>
          <div className="barlist-track" aria-hidden="true">
            <motion.div
              className={`barlist-fill ${toneFor(r.value, threshold)}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.max(0, Math.min(100, r.value)) / 100 }}
              transition={{ duration: 0.7, ease: EASE.entry, delay: 0.05 * i }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HeatGrid({ cells = [], fromHour = 7, toHour = 19 }) {
  const ref = useRef(null);
  const revealed = useRef(false);
  const map = useMemo(() => new Map(cells.map(c => [`${c.weekday}:${c.hour}`, c])), [cells]);
  // Colour is stretched over the rates actually present, so a grid of
  // 60 to 75% still shows which slots are weakest.
  const [lo, hi] = useMemo(() => {
    const rates = cells.map(c => c.rate);
    return rates.length ? [Math.min(...rates), Math.max(...rates)] : [0, 100];
  }, [cells]);
  const days = useMemo(() => {
    const used = new Set(cells.map(c => c.weekday));
    return [1, 2, 3, 4, 5, 6, 7].filter(d => d <= 5 || used.has(d));
  }, [cells]);
  const hours = Array.from({ length: toHour - fromHour + 1 }, (_, i) => fromHour + i);

  useLayoutEffect(() => {
    if (revealed.current || !cells.length || !ref.current) return undefined;
    revealed.current = true;
    return revealGrid(ref.current.querySelectorAll('.heat-cell'), { grid: [days.length, hours.length], from: 'first', each: 8 });
  }, [cells.length, days.length, hours.length]);

  return (
    <div>
      <div ref={ref} className="heat" style={{ gridTemplateColumns: `34px repeat(${hours.length}, minmax(0, 1fr))` }}>
        <span />
        {hours.map(h => <span key={h} style={{ textAlign: 'center' }}>{h % 2 ? '' : String(h).padStart(2, '0')}</span>)}
        {days.map(d => (
          <FragmentRow key={d} day={d} hours={hours} map={map} lo={lo} hi={hi} />
        ))}
      </div>
      <div className="heat" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <span>{lo}%</span>
        <span style={{ flex: '0 1 160px', height: 8, borderRadius: 999, background: 'linear-gradient(90deg, color-mix(in srgb, var(--brand) 20%, var(--bg-raised)), var(--brand))' }} />
        <span>{hi}%</span>
        <span style={{ marginLeft: 12, width: 12, height: 12, borderRadius: 3, boxShadow: 'inset 0 0 0 1px var(--border)' }} />
        <span>no sessions</span>
      </div>
    </div>
  );
}

function FragmentRow({ day, hours, map, lo, hi }) {
  return (
    <>
      <span style={{ alignSelf: 'center' }}>{DAYS[day - 1]}</span>
      {hours.map(h => {
        const c = map.get(`${day}:${h}`);
        const label = c
          ? `${DAYS[day - 1]} ${String(h).padStart(2, '0')}:00, ${c.sessions} session${c.sessions === 1 ? '' : 's'}, ${c.rate}% attendance`
          : `${DAYS[day - 1]} ${String(h).padStart(2, '0')}:00, no sessions`;
        return (
          <span
            key={h}
            className={`heat-cell${c ? '' : ' is-empty'}`}
            style={c ? { '--v': (0.2 + ((c.rate - lo) / (hi - lo || 1)) * 0.8).toFixed(2) } : undefined}
            title={label}
            aria-label={label}
            role="img"
          />
        );
      })}
    </>
  );
}
