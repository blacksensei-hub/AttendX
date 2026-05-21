import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery }                             from '@tanstack/react-query';
import { useNavigate }                          from 'react-router-dom';
import { motion, AnimatePresence }              from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
}                                               from 'recharts';
import {
  AlertTriangle, Radio, ArrowRight, X,
  BookOpen, CheckCircle, Sparkles, TrendingUp,
  LineChart as LineChartIcon, Smartphone,
  QrCode, ExternalLink, Loader,
}                                               from 'lucide-react';

import { classService }                         from '../../services/classService';
import { sessionService }                       from '../../services/sessionService';
import { useAuthStore }                         from '../../store/authStore';
import api                                      from '../../services/api';

import PageShell                                from '../../components/layout/PageShell';
import { AnimatedList, AnimatedItem }           from '../../components/ui/AnimatedList';
import { SPRING, TAP, EASE, DURATION }          from '../../lib/motion';

// ─── Deep link helpers ─────────────────────────────────────────
// Primary: standalone build uses attendx://
// Fallback: Expo Go uses exp+attendx://
function buildDeepLink(sessionId) {
  return `attendx://student/scan?sessionId=${sessionId}`;
}

function buildExpoGoLink(sessionId) {
  return `exp+attendx://student/scan?sessionId=${sessionId}`;
}

function buildQrImageUrl(deepLink) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deepLink)}&bgcolor=0d0d1a&color=3b82f6&qzone=2`;
}

// ─── Scan Handoff Modal ────────────────────────────────────────
function ScanHandoffModal({ session, onClose }) {
  const [phase, setPhase] = useState('opening'); // opening | fallback
  const deepLink    = buildDeepLink(session.id);
  const expoGoLink  = buildExpoGoLink(session.id);
  const qrUrl       = buildQrImageUrl(deepLink);

  const openLink = useCallback((url) => {
    try { window.location.href = url; } catch {}
  }, []);

  // Try opening the app immediately on mount
  useEffect(() => {
    openLink(deepLink);
    const t = setTimeout(() => setPhase('fallback'), 2500);
    return () => clearTimeout(t);
  }, [deepLink, openLink]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: DURATION.fast }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-3)',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.92, opacity: 0, y: 16 }}
        transition={SPRING.gentle}
        style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-organism)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: '100%', maxWidth: 420, overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={18} color="var(--brand-text)" />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Mark Attendance</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{session.className}</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center', textAlign: 'center' }}>

          <AnimatePresence mode="wait" initial={false}>

            {/* Phase: opening — waiting to see if app launches */}
            {phase === 'opening' && (
              <motion.div key="opening"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader size={32} color="var(--brand-text)" />
                </motion.div>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15, marginBottom: 6 }}>Opening AttendX app…</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>
                    If the app doesn't open automatically, follow the instructions below.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Phase: fallback — app not installed or didn't open */}
            {phase === 'fallback' && (
              <motion.div key="fallback"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', width: '100%' }}
              >
                {/* QR code */}
                <div style={{ background: 'var(--bg-raised)', borderRadius: 14, padding: 12, border: '1px solid var(--border)' }}>
                  <img src={qrUrl} alt="Deep link QR code" width={160} height={160}
                    style={{ display: 'block', borderRadius: 8 }} />
                </div>

                <div>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>
                    Scan with Expo Go
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, maxWidth: 300 }}>
                    Open <strong>Expo Go</strong> on your phone and scan the QR code above, or tap the button below to open the app directly.
                  </p>
                </div>

                {/* Open in app buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  <button type="button" onClick={() => openLink(deepLink)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: 'var(--brand)', color: '#fff', borderRadius: 'var(--radius-atomic)', border: 'none', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', width: '100%' }}>
                    <Smartphone size={15} />
                    Open in AttendX app
                    <ExternalLink size={13} />
                  </button>
                  <button type="button" onClick={() => openLink(expoGoLink)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-atomic)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', width: '100%' }}>
                    <QrCode size={15} />
                    Open in Expo Go
                    <ExternalLink size={13} />
                  </button>
                </div>

                {/* Install instructions */}
                <div style={{ background: 'var(--bg-raised)', borderRadius: 'var(--radius-atomic)', padding: '10px 14px', border: '1px solid var(--border)', width: '100%' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Don't have Expo Go?
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => openLink('https://apps.apple.com/app/expo-go/id982107779')}
                      style={{ flex: 1, textAlign: 'center', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 8, border: 'none', fontSize: 11, color: 'var(--brand-text)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      App Store (iOS)
                    </button>
                    <button type="button" onClick={() => openLink('https://play.google.com/store/apps/details?id=host.exp.exponent')}
                      style={{ flex: 1, textAlign: 'center', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 8, border: 'none', fontSize: 11, color: 'var(--brand-text)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Google Play
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function StudentDashboard() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();

  // Track which session the handoff modal is open for
  const [handoffSession, setHandoffSession] = useState(null);

  const { data: classData } = useQuery({
    queryKey: ['enrolled-classes'],
    queryFn:  classService.getEnrolledClasses,
  });
  const classes = classData?.classes ?? [];

  const { data: sessionData } = useQuery({
    queryKey:        ['active-sessions'],
    queryFn:         sessionService.getActiveSessions,
    refetchInterval: 30_000,
  });
  const activeSessions = sessionData?.sessions ?? [];

  const { data: statsData } = useQuery({
    queryKey: ['student-stats'],
    queryFn:  () => api.get('/reports/student-stats').then(r => r.data),
  });
  const myStats = statsData ?? {};

  const { data: ratesData, isPending: ratesLoading } = useQuery({
    queryKey:        ['my-attendance-rates'],
    queryFn:         () => api.get('/thresholds/my-rates').then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
  });
  const rates  = ratesData?.rates ?? [];
  const atRisk = rates.filter(r => r.atRisk);

  const fingerprint = useMemo(
    () => atRisk.map(r => `${r.classId}:${r.attendanceRate}`).sort().join('|'),
    [atRisk]
  );

  const [dismissedFingerprint, setDismissedFingerprint] = useState(() => {
    try { return localStorage.getItem('attendx:dismissed-warning') ?? null; } catch { return null; }
  });

  const showWarning = atRisk.length > 0 && fingerprint !== dismissedFingerprint;

  const dismissWarning = () => {
    try { localStorage.setItem('attendx:dismissed-warning', fingerprint); } catch {}
    setDismissedFingerprint(fingerprint);
  };

  useEffect(() => {
    if (!ratesLoading && atRisk.length === 0 && dismissedFingerprint) {
      try { localStorage.removeItem('attendx:dismissed-warning'); } catch {}
      setDismissedFingerprint(null);
    }
  }, [ratesLoading, atRisk.length, dismissedFingerprint]);

  const pieData = [
    { name: 'Present', value: myStats?.present ?? 0, color: 'var(--green)' },
    { name: 'Late',    value: myStats?.late    ?? 0, color: 'var(--amber)' },
    { name: 'Absent',  value: myStats?.absent  ?? 0, color: 'var(--red)'   },
  ];

  const trendData = Array.isArray(myStats?.trend) ? myStats.trend : [];
  const hasTrend  = trendData.length >= 2;

  const STAT_CARDS = [
    { label: 'Classes',          value: classes.length,           icon: BookOpen,  color: 'var(--brand)',  bg: 'var(--brand-subtle)',  border: 'var(--brand-border)'  },
    { label: 'Sessions attended',value: myStats?.totalSessions ?? 0, icon: CheckCircle, color: 'var(--green)', bg: 'var(--green-bg)', border: 'var(--green-border)' },
    { label: 'On-time rate',     value: `${myStats?.onTimeRate ?? 0}%`, icon: Sparkles, color: 'var(--violet)', bg: 'var(--violet-bg)', border: 'var(--violet-border)' },
    { label: 'This month',       value: `${myStats?.thisMonth ?? 0}%`,  icon: TrendingUp, color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber-border)' },
  ];

  return (
    <PageShell gap="var(--space-4)">

      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.gentle}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Hi, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-md)', marginTop: '6px' }}>
          You have {activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''} right now.
        </p>
      </motion.div>

      {/* At-risk warning */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, height: 0, marginBottom: -16 }}
            transition={SPRING.snappy}
            style={{ padding: 'var(--space-3)', background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-molecular)', position: 'relative', overflow: 'hidden' }}
          >
            <motion.button whileHover={{ scale: 1.06 }} whileTap={TAP.button} onClick={dismissWarning}
              style={{ position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', borderRadius: 'var(--radius-atomic)', background: 'var(--bg-card)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 1 }}>
              <X size={14} strokeWidth={2.4} />
            </motion.button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', paddingRight: '36px' }}>
              <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2, ease: EASE.state, repeat: Infinity, repeatDelay: 1 }}
                style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-atomic)', background: 'var(--red-bg)', border: '1px solid var(--red-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
              </motion.div>
              <div>
                <p style={{ color: 'var(--red)', fontWeight: 700, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-display)' }}>Attendance warning</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', marginTop: '2px', lineHeight: 1.5 }}>
                  Your attendance in the following {atRisk.length === 1 ? 'class is' : 'classes are'} below the required minimum
                </p>
              </div>
            </div>

            <AnimatedList style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {atRisk.map(r => {
                const sessionsNeeded = r.totalSessions > 0
                  ? Math.max(0, Math.ceil((r.threshold / 100 * r.totalSessions) - r.attended)) : 0;
                return (
                  <AnimatedItem key={r.classId}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)', background: 'var(--bg-card)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-atomic)', padding: '10px 14px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{r.className}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                          {r.attended} of {r.totalSessions} sessions attended
                          {sessionsNeeded > 0 && <span style={{ color: 'var(--red)', marginLeft: '6px', fontWeight: 500 }}>· attend {sessionsNeeded} more to reach {r.threshold}%</span>}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-sm)', fontWeight: 700, padding: '4px 12px', fontFamily: 'var(--font-mono)', border: '1px solid var(--red-border)' }}>
                          {r.attendanceRate}%
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>/ {r.threshold}% min</span>
                      </div>
                    </div>
                  </AnimatedItem>
                );
              })}
            </AnimatedList>

            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', lineHeight: 1.5 }}>
              Contact your lecturer if you believe there is an error. You can also submit an attendance appeal from your{' '}
              <motion.button whileTap={TAP.button} onClick={() => navigate('/student/history')}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--brand-text)', cursor: 'pointer', fontWeight: 600, fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                attendance history
              </motion.button>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active sessions banner ───────────────────────────── */}
      {activeSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING.snappy}
          style={{ padding: 'var(--space-3)', background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-molecular)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span className="live-dot" style={{ width: '10px', height: '10px' }} />
            <p style={{ color: 'var(--brand-text)', fontWeight: 700, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-display)' }}>
              Active sessions — mark your attendance now
            </p>
          </div>

          <AnimatedList style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeSessions.map(session => (
              <AnimatedItem key={session.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', background: 'var(--bg-card)', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-atomic)', padding: '10px 14px', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{session.className}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
                      {session.title || 'Attendance session'} · Scan QR code with your phone
                    </p>
                  </div>
                  <motion.button
                    whileTap={TAP.button} whileHover={{ x: 2 }} transition={SPRING.snappy}
                    onClick={() => setHandoffSession(session)}
                    className="btn-primary"
                    style={{ padding: '8px 14px', flexShrink: 0 }}
                  >
                    <Smartphone size={13} />
                    Mark attendance
                    <ArrowRight size={13} />
                  </motion.button>
                </div>
              </AnimatedItem>
            ))}
          </AnimatedList>

          {/* Instruction note */}
          <p style={{ color: 'var(--brand-text)', fontSize: 11, marginTop: 10, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <QrCode size={11} />
            QR scanning requires the AttendX mobile app — tapping the button will open it automatically.
          </p>
        </motion.div>
      )}

      {/* Stats grid */}
      <AnimatedList style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg, border }) => (
          <AnimatedItem key={label} whileHover={{ y: -3 }} transition={SPRING.snappy}>
            <div style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-3)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', height: '100%' }}>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '120px', height: '120px', background: bg, filter: 'blur(40px)', opacity: 0.7, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: 'var(--radius-atomic)', background: bg, border: `1px solid ${border}`, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} strokeWidth={2.2} />
              </div>
              <p style={{ position: 'relative', fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</p>
              <p style={{ position: 'relative', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>{label}</p>
            </div>
          </AnimatedItem>
        ))}
      </AnimatedList>

      {/* Per-class attendance */}
      {rates.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.gentle, delay: 0.1 }}
          style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-md)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-md)' }}>Attendance by class</h3>
          <AnimatedList style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rates.map(r => <AnimatedItem key={r.classId}><ClassRateRow r={r} /></AnimatedItem>)}
          </AnimatedList>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-3)' }}>
            The marker line on each bar shows the minimum threshold for that class.
          </p>
        </motion.div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.gentle, delay: 0.2 }}
          style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-md)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>Your attendance over time</h3>
          {hasTrend ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="studentTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--green)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip cursor={{ stroke: 'var(--green)', strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-atomic)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)', fontSize: 'var(--text-sm)' }} />
                <Area type="monotone" dataKey="rate" stroke="var(--green)" strokeWidth={2.5} fill="url(#studentTrend)" dot={false} activeDot={{ r: 5, fill: 'var(--green)', stroke: 'var(--bg-card)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState icon={LineChartIcon} title="Not enough data yet" subtitle="Mark attendance in a few sessions to see your trend over time." />
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.gentle, delay: 0.25 }}
          style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)', alignSelf: 'flex-start' }}>Breakdown</h3>
          <PieChart width={160} height={160}>
            <Pie data={pieData} cx={80} cy={80} innerRadius={48} outerRadius={68} paddingAngle={3} dataKey="value">
              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'var(--space-2)', alignSelf: 'stretch' }}>
            {pieData.map(({ name, value, color }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: 'var(--radius-pill)', background: color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{name}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Deep link handoff modal */}
      <AnimatePresence>
        {handoffSession && (
          <ScanHandoffModal
            session={handoffSession}
            onClose={() => setHandoffSession(null)}
          />
        )}
      </AnimatePresence>

    </PageShell>
  );
}

function ChartEmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-atomic)', border: '1px dashed var(--border)', background: 'var(--bg-raised)' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-atomic)', background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} style={{ color: 'var(--brand-text)' }} strokeWidth={2.2} />
      </div>
      <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-display)', textAlign: 'center' }}>{title}</p>
      {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  );
}

function ClassRateRow({ r }) {
  const rate = r.attendanceRate;
  const color = rate === null ? 'var(--text-muted)' : rate < r.threshold ? 'var(--red)' : rate < r.threshold + 10 ? 'var(--amber)' : 'var(--green)';
  const bgColor = rate === null ? 'var(--bg-raised)' : rate < r.threshold ? 'var(--red-bg)' : rate < r.threshold + 10 ? 'var(--amber-bg)' : 'var(--green-bg)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.className}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
          {r.totalSessions === 0 ? 'No sessions held yet' : `${r.attended} of ${r.totalSessions} sessions`}
        </p>
      </div>
      <div style={{ flex: 2, minWidth: '140px', maxWidth: '220px', position: 'relative' }}>
        <div style={{ height: '6px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(rate ?? 0, 100)}%` }} transition={{ duration: 0.8, ease: EASE.entry }}
            style={{ height: '100%', background: color, borderRadius: 'var(--radius-pill)' }} />
        </div>
        <div style={{ position: 'absolute', left: `${r.threshold}%`, top: '-2px', width: '2px', height: '10px', background: 'var(--text-secondary)', borderRadius: '1px' }} />
      </div>
      <span style={{ background: bgColor, color, borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-sm)', fontWeight: 700, padding: '4px 12px', fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: '56px', textAlign: 'center', border: '1px solid', borderColor: color }}>
        {rate !== null ? `${rate}%` : '—'}
      </span>
    </div>
  );
}