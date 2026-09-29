// client/src/pages/lecturer/ProjectorPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize, Minimize, X, Wifi, WifiOff } from 'lucide-react';

import { sessionService } from '../../services/sessionService';
import { useSocket } from '../../hooks/useSocket';
import Ticker from '../../components/ui/Ticker';
import { classLabel } from '../../lib/names';
import { reducedMotion } from '../../lib/anime';
import '../../components/teaching/teaching.css';

/**
 * ═════════════════════════════════════════════════════════════════
 * Projector mode: the live session for the wall.
 *
 * Full screen, always dark, readable from the back row: the rotating
 * QR code as large as the screen allows, how many have scanned out of
 * how many are enrolled, and a bar that drains until the code changes.
 * No names are shown, only counts, so it is safe on a shared screen.
 *
 * F toggles full screen and Esc returns to the lecturer's live page.
 * The code rotates on the session's own interval; scans arrive over
 * the session's socket room.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ProjectorPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { connected, on, off } = useSocket(sessionId);
  const [closedLive, setClosedLive] = useState(false);
  const [full, setFull] = useState(() => Boolean(document.fullscreenElement));
  const [scanned, setScanned] = useState(() => new Map());

  const { data: sessionData, isError } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => sessionService.getSession(sessionId),
    refetchInterval: 30_000,
    retry: false,
  });
  const session = sessionData?.session;
  const interval = session?.qr_interval ?? 5;

  const { data: snapshot } = useQuery({
    queryKey: ['attendance', sessionId],
    queryFn: () => sessionService.getLiveAttendance(sessionId),
    refetchInterval: 20_000,
  });

  // Rotate the code on the session's interval. A 404 means the
  // session has closed (or was never ours to show).
  const qr = useQuery({
    queryKey: ['projector-qr', sessionId],
    queryFn: () => sessionService.getCurrentQR(sessionId),
    refetchInterval: (q) => (q.state.error ? false : interval * 1000),
    refetchIntervalInBackground: true,
    retry: false,
    gcTime: 0,
    enabled: !closedLive,
  });
  const closed = closedLive || [400, 404].includes(qr.error?.response?.status);
  const token = qr.data?.token ?? null;
  const round = qr.dataUpdatedAt;

  // Scans as they happen, and the close.
  useEffect(() => {
    on('attendance:marked', (r) => setScanned(prev => new Map(prev).set(r.studentId, r.status)));
    on('session:closed', () => setClosedLive(true));
    return () => { off('attendance:marked'); off('session:closed'); };
  }, [on, off]);

  const counts = useMemo(() => {
    const all = new Map((snapshot?.records ?? []).filter(r => r.status === 'present' || r.status === 'late').map(r => [r.studentId, r.status]));
    scanned.forEach((v, k) => all.set(k, v));
    const late = [...all.values()].filter(v => v === 'late').length;
    return { total: all.size, late };
  }, [snapshot, scanned]);

  const enrolled = session?.enrollmentCount ?? 0;
  const share = enrolled ? Math.min(1, counts.total / enrolled) : 0;

  // Keyboard: F full screen, Esc back.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'f' || e.key === 'F') toggleFull();
      if (e.key === 'Escape' && !document.fullscreenElement) navigate(`/lecturer/session/${sessionId}`);
    };
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); };
  }, [navigate, sessionId]);

  const openAt = session?.open_at ? new Date(session.open_at) : null;
  const lateAt = openAt && session?.late_threshold != null ? new Date(openAt.getTime() + session.late_threshold * 60_000) : null;
  const t = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const cls = session?.class;

  return (
    <main className="projector" aria-label="Attendance projector">
      <div className="tools">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '8px 4px', color: connected ? '#2BD9B5' : '#F5B13D' }}>
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />} {connected ? 'Live' : 'Reconnecting'}
        </span>
        <button type="button" onClick={toggleFull} aria-label={full ? 'Leave full screen (F)' : 'Full screen (F)'}>
          {full ? <Minimize size={14} /> : <Maximize size={14} />} {full ? 'Exit full screen' : 'Full screen'}
        </button>
        <Link to={`/lecturer/session/${sessionId}`} aria-label="Back to the live page (Esc)"><X size={14} /> Close</Link>
      </div>

      <div className="qr-frame" role="img" aria-label={closed ? 'Session closed' : 'Attendance QR code, changes every few seconds'}>
        <AnimatePresence mode="popLayout" initial={false}>
          {closed || isError ? (
            <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#0B1B3F', textAlign: 'center', font: '650 clamp(22px, 3vw, 40px)/1.1 var(--font-display)' }}>
              Attendance<br />is closed
            </motion.div>
          ) : token ? (
            <motion.div key={round} initial={{ opacity: reducedMotion() ? 1 : 0.25 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} style={{ height: '100%' }}>
              <QRCodeSVG value={token} size={1024} level="M" marginSize={0} fgColor="#0B1B3F" bgColor="#ffffff" style={{ width: '100%', height: '100%' }} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 2.6vh, 32px)', minWidth: 0 }}>
        <p className="kick">{cls?.code ?? 'Session'} / {closed ? 'Session closed' : 'Scan with AttendX to mark attendance'}</p>
        <h1 className="title">{cls ? classLabel(cls.code, cls.name) : session?.title ?? 'Attendance'}</h1>
        <div>
          <p className="count" aria-live="polite">
            <Ticker value={counts.total} duration={500} /><small> / {enrolled}</small>
          </p>
          <p className="kick" style={{ marginTop: 10 }}>
            scanned in{counts.late ? `, ${counts.late} late` : ''}
          </p>
        </div>
        <div className="bar" aria-hidden="true">
          <motion.span initial={false} animate={{ scaleX: share }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
        </div>
        {!closed && (
          <div aria-hidden="true">
            <p className="kick" style={{ marginBottom: 8 }}>New code in {interval} seconds</p>
            <div className="bar" style={{ height: 4 }}>
              <motion.span key={round} style={{ background: 'rgba(238, 241, 247, .55)' }}
                initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: interval, ease: 'linear' }} />
            </div>
          </div>
        )}
        <p className="kick" style={{ lineHeight: 1.6 }}>
          {openAt && `Opened ${t(openAt)}`}{lateAt && ` · late after ${t(lateAt)}`}{session?.close_at && ` · closes ${t(new Date(session.close_at))}`}
        </p>
      </section>
    </main>
  );
}

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
