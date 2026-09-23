import { useState, useEffect, useMemo }      from 'react';
import { useParams, useNavigate }            from 'react-router-dom';
import {
  useQuery, useMutation, useQueryClient,
}                                            from '@tanstack/react-query';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  StopCircle, RefreshCw, ArrowLeft, Wifi, WifiOff,
}                                            from 'lucide-react';
import { formatDistanceToNow }               from 'date-fns';
import toast                                 from 'react-hot-toast';

import { sessionService }                    from '../../services/sessionService';
import { useSocket }                         from '../../hooks/useSocket';
import QRCodeDisplay                         from '../../components/sessions/QRCodeDisplay';
import LiveAttendance                        from '../../components/sessions/LiveAttendanceList';

import PageShell                             from '../../components/layout/PageShell';
import { useIsMobile }                       from '../../hooks/useIsMobile';
import { SPRING, TAP }                       from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * LiveSessionPage — the lecturer's view during an active session.
 *
 * The demo-day centerpiece. This page receives the shared-element
 * transition from ClassCard via layoutId="class-morph-${classId}"
 * on the header card — clicking a live class from the Classes page
 * smoothly morphs into this header instead of a hard route change.
 *
 * Real-time attendance markings flow in via WebSocket. Stats update
 * live. The QR code rotates on a configurable interval with a pulse
 * ring warning 2 seconds before each rotation.
 * ═════════════════════════════════════════════════════════════════
 */
export default function LiveSessionPage() {
  const { sessionId }          = useParams();
  const navigate               = useNavigate();
  const qc                     = useQueryClient();
  const { connected, on, off } = useSocket(sessionId);
  const isMobile               = useIsMobile();

  // ── Session data ─────────────────────────────────────────────
  const { data: sessionData, isLoading } = useQuery({
    queryKey:        ['session', sessionId],
    queryFn:         () => sessionService.getSession(sessionId),
    refetchInterval: 30_000,
  });

  // ── Attendance: server snapshot + live socket arrivals ───────
  // TanStack Query v5 dropped useQuery's onSuccess, so the snapshot
  // used to be fetched and then thrown away: after a refresh the
  // list showed nobody until new scans arrived. Now the snapshot is
  // read from the query itself and live records are layered on top.
  const { data: snapshot } = useQuery({
    queryKey: ['attendance', sessionId],
    queryFn:  () => sessionService.getLiveAttendance(sessionId),
  });
  const [live, setLive] = useState([]);

  useEffect(() => {
    const handler = (record) => {
      setLive(prev => [{ ...record, isNew: true }, ...prev.filter(r => r.studentId !== record.studentId)]);
    };
    on('attendance:marked', handler);
    return () => off('attendance:marked');
  }, []);   // eslint-disable-line

  const attendance = useMemo(() => {
    const liveIds = new Set(live.map(r => r.studentId));
    return [...live, ...(snapshot?.records ?? []).filter(r => !liveIds.has(r.studentId))];
  }, [live, snapshot]);

  // ── Close session ────────────────────────────────────────────
  const closeMut = useMutation({
    mutationFn: () => sessionService.closeSession(sessionId),
    onSuccess:  () => {
      toast.success('Session closed');
      qc.invalidateQueries({ queryKey: ['classes'] });
      navigate('/lecturer/classes');
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to close session'),
  });

  // ── Loading skeleton ─────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <div style={{
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          minHeight:     '60vh',
          gap:           'var(--space-2)',
          color:         'var(--text-muted)',
        }}>
          <RefreshCw
            size={20}
            style={{ animation: 'spin 0.8s linear infinite' }}
          />
          <span style={{ fontSize: 'var(--text-sm)' }}>
            Loading session…
          </span>
        </div>
      </PageShell>
    );
  }

  const session = sessionData?.session;
  const counts  = {
    present: attendance.filter(r => r.status === 'present').length,
    late:    attendance.filter(r => r.status === 'late').length,
    absent:  Math.max(0, (session?.enrollmentCount ?? 0) - attendance.length),
  };
  const totalEnrolled = session?.enrollmentCount ?? 0;
  const classId       = session?.class?.id ?? session?.class_id;
  // One seat per enrolled student, filled in the order they scanned
  const seats = [
    ...attendance
      .slice()
      .sort((a, b) => new Date(a.marked_at ?? 0) - new Date(b.marked_at ?? 0))
      .map(r => (r.status === 'late' ? 'late' : 'present')),
    ...Array(Math.max(0, totalEnrolled - attendance.length)).fill('empty'),
  ];
  const openedAgo = session?.open_at
    ? formatDistanceToNow(new Date(session.open_at), { addSuffix: true })
    : null;

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Back link ───────────────────────────────────────── */}
      <motion.button
        whileTap={TAP.button}
        whileHover={{ x: -2 }}
        transition={SPRING.snappy}
        onClick={() => navigate('/lecturer/classes')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 0, cursor: 'pointer',
          fontFamily: 'var(--font-body)', alignSelf: 'flex-start',
        }}
      >
        <ArrowLeft size={14} /> Back to classes
      </motion.button>

      {/* ── Header. Shares a layoutId with ClassCard so a live card
          morphs into this block when the lecturer clicks it. ───── */}
      <motion.header
        layoutId={classId ? `class-morph-${classId}` : undefined}
        transition={SPRING.gentle}
        style={{
          display:        'flex',
          flexWrap:       'wrap',
          alignItems:     'flex-end',
          justifyContent: 'space-between',
          gap:            'var(--space-3)',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="kicker">
            <span className="live-dot" />
            Live / {session?.class?.code || session?.class?.name || 'Session'}
            {openedAgo && <> / opened {openedAgo}</>}
          </p>
          <h1 style={{
            marginTop:     14,
            fontFamily:    'var(--font-display)',
            fontSize:      'clamp(32px, 4.2vw, 56px)',
            fontWeight:    650,
            color:         'var(--text-primary)',
            letterSpacing: '-0.036em',
            lineHeight:    1,
            textWrap:      'balance',
          }}>
            {session?.title || session?.class?.name || 'Session'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="kicker" style={{
            padding: '8px 12px', borderRadius: 'var(--radius-pill)',
            background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)',
            color: connected ? 'var(--green)' : 'var(--amber)',
          }}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Real-time on' : 'Connecting'}
          </span>
          <motion.button
            whileTap={TAP.button}
            onClick={() => {
              if (confirm('Close this session? Students will no longer be able to mark attendance, and everyone who did not scan will be marked absent.')) {
                closeMut.mutate();
              }
            }}
            disabled={closeMut.isPending}
            className="btn-danger"
          >
            <StopCircle size={15} />
            {closeMut.isPending ? 'Closing…' : 'Close session'}
          </motion.button>
        </div>
      </motion.header>

      {/* ── Projector panel + the room ──────────────────────────── */}
      <div style={{
        display:             'grid',
        gap:                 'var(--space-3)',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.05fr) minmax(0, 1fr)',
        alignItems:          'start',
      }}>

        {/* QR panel: the thing on the projector */}
        <motion.section
          aria-label="QR code for students"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING.gentle, delay: 0.08 }}
          style={{
            background:    'var(--bg-card)',
            borderRadius:  'var(--radius-organism)',
            padding:       'clamp(24px, 3vw, 44px) var(--space-4)',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            boxShadow:     'var(--shadow-md)',
            position:      isMobile ? 'relative' : 'sticky',
            top:           92,
          }}
        >
          <p className="kicker" style={{ marginBottom: 'var(--space-4)' }}>
            <span className="dot" /> Show this to the class
          </p>

          <QRCodeDisplay
            sessionId={sessionId}
            qrInterval={session?.qr_interval ?? 5}
            size={isMobile ? 220 : 300}
          />

          <p style={{
            color: 'var(--text-subtle)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)',
            textAlign: 'center', maxWidth: '36ch', lineHeight: 1.55,
          }}>
            Students scan from their seat. The code changes every {session?.qr_interval ?? 5} seconds, so a forwarded photo stops working almost at once.
          </p>
        </motion.section>

        {/* The room */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
          <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <LiveCount label="Present"  count={counts.present} total={totalEnrolled} tone="var(--green-fill)" />
            <LiveCount label="Late"     count={counts.late}    total={totalEnrolled} tone="var(--amber-fill)" />
            <LiveCount label="Not yet"  count={counts.absent}  total={totalEnrolled} tone="var(--text-muted)" />
          </div>

          {totalEnrolled > 0 && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)',
              padding: 'var(--space-3)', boxShadow: 'var(--shadow-md)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 12 }}>
                <p className="kicker">The room / one seat per student</p>
                <p className="kicker num" style={{ color: 'var(--text-primary)' }}>
                  {attendance.length} / {totalEnrolled}
                </p>
              </div>
              <div className="seats" aria-hidden="true" style={{ gap: 5 }}>
                {seats.map((st, i) => (
                  <motion.span
                    key={i}
                    className={`seat${st === 'present' ? ' is-present' : st === 'late' ? ' is-late' : ''}`}
                    initial={st !== 'empty' ? { scale: 0.4 } : false}
                    animate={{ scale: 1 }}
                    transition={SPRING.bounce}
                    style={{ width: 11, height: 11 }}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-md)', minHeight: 360,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: 'var(--space-3)', borderBottom: '1px solid var(--border)',
            }}>
              <p style={{ fontWeight: 650, color: 'var(--text-primary)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                Arrivals
              </p>
              <AnimatePresence mode="wait">
                <motion.span
                  key={attendance.length}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={SPRING.snappy}
                  className="kicker"
                >
                  {attendance.length} scanned
                </motion.span>
              </AnimatePresence>
            </div>
            <LiveAttendance records={attendance} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ─── Live count tile ───────────────────────────────────────────
function LiveCount({ label, count, total, tone }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)',
      padding: '16px', boxShadow: 'var(--shadow-md)', minWidth: 0,
    }}>
      <p className="kicker"><span className="dot" style={{ background: tone }} />{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
        <AnimatePresence mode="wait">
          <motion.span
            key={count}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={SPRING.bounce}
            className="num"
            style={{
              fontFamily: 'var(--font-display)', fontWeight: 650, fontSize: 'clamp(30px, 3.4vw, 46px)',
              letterSpacing: '-0.045em', lineHeight: 0.9, color: 'var(--text-primary)',
            }}
          >
            {count}
          </motion.span>
        </AnimatePresence>
        {total > 0 && <span className="num" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>/{total}</span>}
      </div>
    </div>
  );
}
