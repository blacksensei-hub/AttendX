// client/src/pages/lecturer/LiveSessionPage.jsx
import { useState, useEffect, useRef }       from 'react';
import { useParams, useNavigate }            from 'react-router-dom';
import {
  useQuery, useMutation, useQueryClient,
}                                            from '@tanstack/react-query';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  Users, StopCircle, RefreshCw, Radio,
  ArrowLeft, Wifi, WifiOff,
}                                            from 'lucide-react';
import { formatDistanceToNow }               from 'date-fns';
import toast                                 from 'react-hot-toast';

import { sessionService }                    from '../../services/sessionService';
import { useSocket }                         from '../../hooks/useSocket';
import QRCodeDisplay                         from '../../components/sessions/QRCodeDisplay';
import LiveAttendance                        from '../../components/sessions/LiveAttendanceList';

import PageShell                             from '../../components/layout/PageShell';
import StatusPill                            from '../../components/ui/StatusPill';
import { AnimatedList, AnimatedItem }        from '../../components/ui/AnimatedList';
import { SPRING, TAP, EASE, DURATION }       from '../../lib/motion';

export default function LiveSessionPage() {
  const { sessionId }          = useParams();
  const navigate               = useNavigate();
  const qc                     = useQueryClient();
  const { connected, on, off } = useSocket(sessionId);
  const [attendance, setAttendance] = useState([]);

  // Distinguishes a manual close (this lecturer clicked "Close session")
  // from an automatic one (scheduler / force-close). The backend emits the
  // same `session:closed` socket event for both and it round-trips back to
  // this client, so without this flag a manual close would ALSO trigger the
  // "automatically closed" toast. Set synchronously in mutationFn so it's
  // already true by the time the socket event arrives.
  const manualCloseRef  = useRef(false);
  // Ensures only the first close signal (socket OR poll) is acted on, so an
  // automatic close can't fire the toast + navigate twice.
  const closeHandledRef = useRef(false);

  // Session data — polls every 30s
  const { data: sessionData, isLoading } = useQuery({
    queryKey:        ['session', sessionId],
    queryFn:         () => sessionService.getSession(sessionId),
    refetchInterval: 30_000,
  });

  // Auto-redirect when session closes externally (scheduler or Force-Close).
  // Two signals: the 30s poll returning status:'closed', and a WebSocket event.
  // Both paths redirect so whichever fires first wins.
  useEffect(() => {
    const session = sessionData?.session;
    if (session?.status === 'closed') {
      if (manualCloseRef.current || closeHandledRef.current) return;
      closeHandledRef.current = true;
      toast('Session was automatically closed', { icon: '🔒' });
      qc.invalidateQueries({ queryKey: ['classes'] });
      navigate('/lecturer/classes');
    }
  }, [sessionData?.session?.status]); // eslint-disable-line

  useEffect(() => {
    const handler = ({ sessionId: closedId }) => {
      if (closedId !== sessionId) return;
      if (manualCloseRef.current || closeHandledRef.current) return;
      closeHandledRef.current = true;
      toast('Session was automatically closed', { icon: '🔒' });
      qc.invalidateQueries({ queryKey: ['classes'] });
      navigate('/lecturer/classes');
    };
    on('session:closed', handler);
    return () => off('session:closed');
  }, [sessionId]); // eslint-disable-line

  // Attendance snapshot — onSuccess removed in RQ v5, useEffect instead
  const { data: attendanceSnapshot } = useQuery({
    queryKey:        ['attendance', sessionId],
    queryFn:         () => sessionService.getLiveAttendance(sessionId),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (attendanceSnapshot?.records) {
      setAttendance(attendanceSnapshot.records);
    }
  }, [attendanceSnapshot]);

  // WebSocket live attendance
  useEffect(() => {
    const handler = (record) => {
      setAttendance(prev => {
        const idx = prev.findIndex(r => r.studentId === record.studentId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...record, isNew: true };
          return updated;
        }
        return [{ ...record, isNew: true }, ...prev];
      });
    };
    on('attendance:marked', handler);
    return () => off('attendance:marked');
  }, []); // eslint-disable-line

  // Manual close
  const closeMut = useMutation({
    mutationFn: () => {
      // Mark this as a deliberate close BEFORE the request fires, so the
      // socket/poll handlers stay silent when the event round-trips back.
      manualCloseRef.current = true;
      return sessionService.closeSession(sessionId);
    },
    onSuccess:  () => {
      toast.success('Session closed');
      qc.invalidateQueries({ queryKey: ['classes'] });
      navigate('/lecturer/classes');
    },
    onError: (err) => {
      // Close failed — reset so a later auto-close still notifies correctly.
      manualCloseRef.current = false;
      toast.error(err.response?.data?.message || 'Failed to close session');
    },
  });

  if (isLoading) {
    return (
      <PageShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 'var(--space-2)', color: 'var(--text-muted)' }}>
          <RefreshCw size={20} style={{ animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 'var(--text-sm)' }}>Loading session…</span>
        </div>
      </PageShell>
    );
  }

  const session       = sessionData?.session;
  const counts        = {
    present: attendance.filter(r => r.status === 'present').length,
    late:    attendance.filter(r => r.status === 'late').length,
    absent:  Math.max(0, (session?.enrollmentCount ?? 0) - attendance.length),
  };
  const totalEnrolled = session?.enrollmentCount ?? 0;
  const classId       = session?.class?.id ?? session?.class_id;

  return (
    <PageShell gap="var(--space-4)">

      <motion.button
        whileTap={TAP.button} whileHover={{ x: -2 }} transition={SPRING.snappy}
        onClick={() => navigate('/lecturer/classes')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', alignSelf: 'flex-start' }}
      >
        <ArrowLeft size={14} />
        Back to classes
      </motion.button>

      <motion.div
        layoutId={classId ? `class-morph-${classId}` : undefined}
        transition={SPRING.gentle}
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-brand)', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', background: 'var(--brand-subtle)', filter: 'blur(50px)', opacity: 0.8, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '8px', flexWrap: 'wrap' }}>
              <StatusPill status="live" label="Live session" showSweep={false} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: connected ? 'var(--green)' : 'var(--amber)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {connected ? 'Real-time connected' : 'Connecting…'}
              </div>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session?.title || session?.class?.name || 'Session'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
              Opened {session?.open_at ? formatDistanceToNow(new Date(session.open_at), { addSuffix: true }) : '—'}
              {' · '}{totalEnrolled} enrolled
            </p>
          </div>

          <motion.button
            whileTap={TAP.button} whileHover={{ y: -1 }} transition={SPRING.snappy}
            onClick={() => { if (confirm('Close this session? Students will no longer be able to mark attendance.')) closeMut.mutate(); }}
            disabled={closeMut.isPending}
            className="btn-danger"
            style={{ padding: '10px var(--space-3)', opacity: closeMut.isPending ? 0.6 : 1 }}
          >
            <StopCircle size={15} />
            {closeMut.isPending ? 'Closing…' : 'Close session'}
          </motion.button>
        </div>
      </motion.div>

      <AnimatedList style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        <StatCard label="Present" count={counts.present} total={totalEnrolled} color="var(--green)" bg="var(--green-bg)" border="var(--green-border)" />
        <StatCard label="Late"    count={counts.late}    total={totalEnrolled} color="var(--amber)" bg="var(--amber-bg)" border="var(--amber-border)" />
        <StatCard label="Absent"  count={counts.absent}  total={totalEnrolled} color="var(--red)"   bg="var(--red-bg)"   border="var(--red-border)"   />
      </AnimatedList>

      <div style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: '1fr' }} className="lg:grid-cols-[auto_1fr]">

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING.gentle, delay: 0.1 }}
          style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-5) var(--space-4)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-3)' }}>
            <Radio size={13} style={{ color: 'var(--brand-text)' }} />
            <p style={{ color: 'var(--brand-text)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Display to students
            </p>
          </div>
          <QRCodeDisplay sessionId={sessionId} qrInterval={session?.qr_interval ?? 5} />
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.5 }}>
            Students scan this code from the AttendX app to mark their attendance. The code rotates every {session?.qr_interval ?? 5} seconds for security.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.gentle, delay: 0.15 }}
          style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)', minHeight: '400px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            <Users size={14} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-display)' }}>Live attendance</p>
            <AnimatePresence mode="wait">
              <motion.span
                key={attendance.length}
                initial={{ opacity: 0, scale: 0.6, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: 4 }}
                transition={SPRING.bounce}
                style={{ marginLeft: 'auto', color: 'var(--brand-text)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 600, background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', padding: '2px 10px', borderRadius: 'var(--radius-pill)' }}
              >
                {attendance.length}/{totalEnrolled || '?'}
              </motion.span>
            </AnimatePresence>
          </div>
          <LiveAttendance records={attendance} />
        </motion.div>
      </div>
    </PageShell>
  );
}

function StatCard({ label, count, total, color, bg, border }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <AnimatedItem whileHover={{ y: -3 }} transition={SPRING.snappy}>
      <div style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-3)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', height: '100%' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '120px', height: '120px', background: bg, filter: 'blur(40px)', opacity: 0.7, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
          <AnimatePresence mode="wait">
            <motion.p key={count} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.9 }} transition={SPRING.bounce}
              style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, color, lineHeight: 1 }}>
              {count}
            </motion.p>
          </AnimatePresence>
          {total > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>/{total}</span>}
        </div>
        <p style={{ position: 'relative', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>{label}</p>
        {total > 0 && (
          <div style={{ position: 'relative', width: '100%', height: '4px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.6, ease: EASE.entry }}
              style={{ height: '100%', background: color, borderRadius: 'var(--radius-pill)' }} />
          </div>
        )}
      </div>
    </AnimatedItem>
  );
}