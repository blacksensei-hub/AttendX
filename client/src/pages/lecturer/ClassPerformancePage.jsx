// client/src/pages/lecturer/ClassPerformancePage.jsx
import { useState, useMemo }             from 'react';
import { useParams, useNavigate }        from 'react-router-dom';
import { useQuery }                      from '@tanstack/react-query';
import { motion, AnimatePresence }       from 'framer-motion';
import {
  ArrowLeft, Users, TrendingUp, AlertTriangle,
  CheckCircle, ChevronDown, ChevronUp,
  Search, RefreshCw, GraduationCap,
}                                        from 'lucide-react';

import api                               from '../../services/api';
import PageShell                         from '../../components/layout/PageShell';
import StatusPill                        from '../../components/ui/StatusPill';
import { useIsMobile }                   from '../../hooks/useIsMobile';
import { SPRING, TAP, EASE, DURATION }   from '../../lib/motion';

// Risk → visual config
const RISK = {
  safe:    { label: 'Safe',    color: '#10b981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.25)'  },
  warning: { label: 'At risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)'  },
  danger:  { label: 'Danger',  color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)'   },
  none:    { label: 'No data', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)',border: 'rgba(148,163,184,0.25)' },
};

const FILTERS = ['all', 'danger', 'warning', 'safe', 'none'];

export default function ClassPerformancePage() {
  const { classId }  = useParams();
  const navigate     = useNavigate();
  const isMobile     = useIsMobile();

  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [expanded, setExpanded] = useState(null); // expanded student id

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['class-performance', classId],
    queryFn:  () => api.get(`/classes/${classId}/performance`).then(r => {
      const d = r.data;
      return d?.data ?? d;
    }),
  });

  const cls      = data?.class     ?? {};
  const summary  = data?.summary   ?? {};
  const allStudents = data?.students ?? [];

  const students = useMemo(() => {
    let rows = allStudents;
    if (filter !== 'all') rows = rows.filter(s => s.risk === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(s =>
        s.studentName?.toLowerCase().includes(q) ||
        s.studentEmail?.toLowerCase().includes(q) ||
        s.studentNumber?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allStudents, filter, search]);

  if (isLoading) {
    return (
      <PageShell>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 'var(--space-2)', color: 'var(--text-muted)' }}>
          <RefreshCw size={20} style={{ animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 'var(--text-sm)' }}>Loading student data…</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell gap="var(--space-4)">

      {/* Back */}
      <motion.button
        whileTap={TAP.button} whileHover={{ x: -2 }} transition={SPRING.snappy}
        onClick={() => navigate('/lecturer/classes')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-body)', alignSelf: 'flex-start' }}
      >
        <ArrowLeft size={14} />
        Back to classes
      </motion.button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={16} color="var(--brand-text)" />
            </div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--text-lg)' : 'clamp(18px,2vw,26px)', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Student performance
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            {cls.name} · {data?.totalSessions ?? 0} closed session{data?.totalSessions !== 1 ? 's' : ''} · threshold {cls.threshold}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <RefreshCw size={14} style={{ animation: isRefetching ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
        <SummaryCard label="Total students" value={summary.total ?? 0}          color="var(--brand-text)"  bg="var(--brand-subtle)"       icon={Users}          />
        <SummaryCard label="Avg attendance" value={`${summary.avgPercentage ?? 0}%`} color="var(--green)"  bg="rgba(16,185,129,0.08)"  icon={TrendingUp}     />
        <SummaryCard label="At risk"         value={summary.danger ?? 0}          color="#ef4444"           bg="rgba(239,68,68,0.08)"   icon={AlertTriangle}  />
        <SummaryCard label="Safe"            value={summary.safe ?? 0}            color="#10b981"           bg="rgba(16,185,129,0.08)"  icon={CheckCircle}    />
      </div>

      {/* Filters + search */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                border: `1px solid ${filter === f ? (RISK[f]?.border ?? 'var(--brand-border)') : 'var(--border)'}`,
                background: filter === f ? (RISK[f]?.bg ?? 'var(--brand-subtle)') : 'var(--bg-card)',
                color: filter === f ? (RISK[f]?.color ?? 'var(--brand-text)') : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? `All (${allStudents.length})` : `${RISK[f]?.label} (${allStudents.filter(s => s.risk === f).length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search students…"
            style={{ width: '100%', padding: '8px 10px 8px 28px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Student list */}
      {students.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg,14px)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          {allStudents.length === 0 ? 'No students enrolled in this class yet.' : 'No students match your filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map((student, idx) => (
            <StudentRow
              key={student.studentId}
              student={student}
              threshold={cls.threshold}
              isMobile={isMobile}
              isExpanded={expanded === student.studentId}
              onToggle={() => setExpanded(prev => prev === student.studentId ? null : student.studentId)}
              index={idx}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

// ─── Summary stat card ─────────────────────────────────────────
function SummaryCard({ label, value, color, bg, icon: Icon }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-3)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: bg, filter: 'blur(24px)', opacity: 0.7, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <Icon size={14} color={color} style={{ marginBottom: 6 }} />
        <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Student row ───────────────────────────────────────────────
function StudentRow({ student: s, threshold, isMobile, isExpanded, onToggle, index }) {
  const riskCfg  = RISK[s.risk] ?? RISK.none;
  const barWidth = Math.min(100, s.percentage);
  const barColor = s.risk === 'safe'    ? '#10b981'
                 : s.risk === 'warning' ? '#f59e0b'
                 : s.risk === 'danger'  ? '#ef4444'
                 : '#94a3b8';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), ...SPRING.snappy }}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-molecular)', overflow: 'hidden' }}
    >
      {/* Main row */}
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'var(--space-3)', cursor: 'pointer' }}
      >
        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          {(s.studentName || '?').charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.studentName}
            </span>
            {s.studentNumber && (
              <span style={{ fontSize: 11, color: 'var(--brand-text)', fontFamily: 'var(--font-mono)', background: 'var(--brand-subtle)', padding: '1px 6px', borderRadius: 99 }}>
                {s.studentNumber}
              </span>
            )}
            {/* Risk badge */}
            <span style={{ fontSize: 10, fontWeight: 700, color: riskCfg.color, background: riskCfg.bg, border: `1px solid ${riskCfg.border}`, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {riskCfg.label}
            </span>
          </div>
          {!isMobile && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.studentEmail}</div>
          )}

          {/* Progress bar */}
          <div style={{ marginTop: 8 }}>
            <div style={{ position: 'relative', height: 5, background: 'var(--bg-raised)', borderRadius: 99 }}>
              <div style={{ height: 5, borderRadius: 99, background: barColor, width: `${barWidth}%`, transition: 'width 0.5s' }} />
              {/* Threshold marker */}
              <div style={{ position: 'absolute', left: `${Math.min(100, threshold)}%`, top: -2, bottom: -2, width: 2, background: 'var(--text-muted)', borderRadius: 1, opacity: 0.4 }} />
            </div>
          </div>
        </div>

        {/* Percentage + count + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {s.percentage}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              {s.attendedCount}/{s.totalSessions}
            </div>
          </div>
          {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Session breakdown — expandable */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE.state }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px var(--space-3)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
                Session breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.sessions.map((sess, i) => {
                  const statusColor = sess.status === 'present' ? '#10b981'
                                    : sess.status === 'late'    ? '#f59e0b'
                                    : '#ef4444';
                  return (
                    <div key={sess.sessionId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sess.title}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        {sess.openAt ? new Date(sess.openAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, textTransform: 'capitalize', flexShrink: 0, minWidth: 42, textAlign: 'right' }}>
                        {sess.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}