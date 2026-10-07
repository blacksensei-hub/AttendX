// client/src/pages/admin/OpsWall.jsx
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { io } from 'socket.io-client';
import { Maximize2, Minimize2, X, Radio } from 'lucide-react';

import { consoleApi } from '../../services/consoleService';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import BrandMark from '../../components/ui/BrandMark';
import Ticker from '../../components/ui/Ticker';
import { Panel, Sig, Empty } from '../../components/console/Panel';
import { pctFormat, timeAgo } from '../../components/console/format';
import { SPRING } from '../../lib/motion';
import '../../components/console/console.css';

/**
 * ═════════════════════════════════════════════════════════════════
 * Live operations wall: full screen, built for a projector.
 *
 * Loads a snapshot, then stays current from the "admin:ops" socket
 * room: scans bump their session's seat count and the per-minute
 * chart in place; sessions opening or closing trigger a resync; fraud
 * flags join the feed. A slow resync every minute and on reconnect
 * covers anything missed. Class names and counts only, never student
 * names.
 * ═════════════════════════════════════════════════════════════════
 */

const FEED_MAX = 14;
const KEY = ['admin-ops'];

const minuteKey = (d) => { const x = new Date(d); x.setSeconds(0, 0); return x.getTime(); };

function useNow(ms) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export default function OpsWall() {
  const qc = useQueryClient();
  const token = useAuthStore(s => s.token);
  const setInConsole = useUIStore(s => s.setInConsole);
  const wall = useRef(null);
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState([]);
  const [full, setFull] = useState(false);
  const now = useNow(1000);

  useEffect(() => { setInConsole(true); return () => setInConsole(false); }, [setInConsole]);

  const { data } = useQuery({ queryKey: KEY, queryFn: consoleApi.ops, refetchInterval: 60_000 });

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:5000', { auth: { token }, reconnectionDelay: 2000 });
    const push = (item) => setFeed(f => [{ id: `${item.at}-${Math.random()}`, ...item }, ...f].slice(0, FEED_MAX));

    socket.on('connect', () => { setConnected(true); qc.invalidateQueries({ queryKey: KEY }); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('ops:scan', (e) => {
      qc.setQueryData(KEY, old => {
        if (!old) return old;
        const k = minuteKey(e.at);
        const hit = old.perMinute.some(m => minuteKey(m.minute) === k);
        return {
          ...old,
          open: old.open.map(s => (s.id === e.sessionId ? { ...s, marked: s.marked + 1 } : s)),
          today: { ...old.today, scans: old.today.scans + 1, late: old.today.late + (e.status === 'late' ? 1 : 0) },
          perMinute: hit
            ? old.perMinute.map(m => (minuteKey(m.minute) === k ? { ...m, scans: m.scans + 1 } : m))
            : [...old.perMinute, { minute: new Date(k).toISOString(), scans: 1 }],
        };
      });
      push({ tone: e.status === 'late' ? 'amber' : 'green', text: `${e.className}: marked ${e.status}`, at: e.at });
    });
    socket.on('ops:session', (e) => {
      qc.invalidateQueries({ queryKey: KEY });
      push({ tone: e.type === 'opened' ? 'brand' : 'muted', text: `${e.className}: session ${e.type}${e.scheduled ? ' (timetable)' : ''}`, at: e.at });
    });
    socket.on('ops:flag', (e) => {
      qc.setQueryData(KEY, old => (old ? { ...old, openFlags: old.openFlags + 1 } : old));
      push({ tone: 'red', text: `Fraud flag: ${e.label}`, at: e.at });
    });
    return () => socket.disconnect();
  }, [token, qc]);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : wall.current?.requestFullscreen?.());

  // Last 60 minutes of scans, one bar per minute.
  const buckets = new Map((data?.perMinute ?? []).map(m => [minuteKey(m.minute), m.scans]));
  const end = minuteKey(now);
  const minutes = Array.from({ length: 60 }, (_, i) => { const t = end - (59 - i) * 60000; return { t, n: buckets.get(t) ?? 0 }; });
  const peak = Math.max(1, ...minutes.map(m => m.n));
  const lastHour = minutes.reduce((a, m) => a + m.n, 0);
  const open = data?.open ?? [];
  const today = data?.today ?? { scans: 0, late: 0, sessions: 0 };

  return (
    <div ref={wall} className="console" style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-primary)', position: 'relative' }}>
      <div className="console-grid" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1, padding: 'clamp(16px, 2.2vw, 32px)', display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100dvh' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <BrandMark size={30} suffix="Ops" />
          <Sig tone={connected ? 'live' : 'warn'}>{connected ? 'Live' : 'Reconnecting'}</Sig>
          <time className="tabular" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'clamp(16px, 1.6vw, 24px)', color: 'var(--text-subtle)' }}>
            {new Date(now).toLocaleTimeString('en-GB')}
          </time>
          <button type="button" className="icon-btn" onClick={toggleFull} aria-label={full ? 'Exit full screen' : 'Full screen'}>{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          <Link to="/admin" className="icon-btn" aria-label="Leave the ops wall"><X size={16} /></Link>
        </header>

        <div style={{ display: 'grid', gap: 'var(--c-gap)', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          {[
            ['Sessions live', open.length],
            ['Scans today', today.scans],
            ['Scans, last hour', lastHour],
            ['Arrived late today', today.scans ? (today.late / today.scans) * 100 : 0, pctFormat],
            ['Fraud flags open', data?.openFlags ?? 0],
          ].map(([label, value, format]) => (
            <Panel key={label} label={label}>
              <span className="kpi-value" style={{ fontSize: 'clamp(30px, 3.4vw, 54px)' }}>
                <Ticker value={value} format={format} duration={600} />
              </span>
            </Panel>
          ))}
        </div>

        <div className="c-grid" style={{ flex: 1, alignItems: 'start' }}>
          <Panel className="span-8" label="Live sessions" title={open.length ? `${open.length} taking attendance` : 'No sessions open'}>
            {open.length === 0 ? (
              <Empty icon={Radio} title="Quiet right now">Sessions appear here the moment a lecturer or the timetable opens one.</Empty>
            ) : (
              <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                <AnimatePresence initial={false}>
                  {open.map(s => {
                    const pct = s.enrolled ? Math.min(100, Math.round((s.marked / s.enrolled) * 100)) : 0;
                    return (
                      <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={SPRING.gentle}
                        style={{ padding: 16, borderRadius: 12, background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <span className="c-label">{s.code ?? 'Class'}</span>
                          <Sig tone="live">Live</Sig>
                        </div>
                        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 650, fontSize: 'clamp(16px, 1.4vw, 20px)', marginTop: 6, lineHeight: 1.2 }}>{s.className}</p>
                        <p className="c-muted" style={{ fontSize: 12.5, marginTop: 4 }}>{s.lecturer ?? 'Lecturer'}{s.location ? ` · ${s.location}` : ''}</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
                          <span className="kpi-value" style={{ marginTop: 0, fontSize: 'clamp(26px, 2.4vw, 38px)' }}><Ticker value={s.marked} duration={500} /></span>
                          <span className="c-muted tabular">/ {s.enrolled} seats</span>
                          <span className="tabular" style={{ marginLeft: 'auto', color: 'var(--green)', fontWeight: 600 }}>{pct}%</span>
                        </div>
                        <div className="barlist-track" style={{ marginTop: 8 }}>
                          <motion.div className="barlist-fill good" animate={{ scaleX: pct / 100 }} initial={false} transition={SPRING.gentle} style={{ width: '100%' }} />
                        </div>
                        <p className="c-muted" style={{ fontSize: 12, marginTop: 8 }}>Opened {timeAgo(s.openAt)}{s.closeAt ? ` · closes ${new Date(s.closeAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </Panel>

          <div className="span-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Panel label="Scans per minute" title="Last hour">
              <div role="img" aria-label={`${lastHour} scans in the last hour`} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
                {minutes.map(m => (
                  <span key={m.t} title={`${new Date(m.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}: ${m.n}`}
                        style={{ flex: 1, height: `${Math.max(2, (m.n / peak) * 100)}%`, borderRadius: 2, background: m.n ? 'var(--brand)' : 'var(--bg-raised)', transition: 'height 400ms var(--ease-entry)' }} />
                ))}
              </div>
              <div className="c-label" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span>-60 min</span><span>now</span></div>
            </Panel>

            <Panel label="Feed" title="As it happens">
              {feed.length === 0 ? (
                <p className="c-muted" style={{ fontSize: 13 }}>Scans, sessions opening and closing, and fraud flags appear here live.</p>
              ) : (
                <div className="feed" aria-live="polite">
                  <AnimatePresence initial={false}>
                    {feed.map(f => (
                      <motion.div key={f.id} className="feed-item" layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={SPRING.snappy}>
                        <span className={`feed-mark ${f.tone}`} aria-hidden="true" />
                        <span style={{ fontSize: 13.5 }}>{f.text}</span>
                        <time>{new Date(f.at).toLocaleTimeString('en-GB')}</time>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
