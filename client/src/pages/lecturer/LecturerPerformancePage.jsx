// client/src/pages/lecturer/LecturerPerformancePage.jsx
import { useState, useMemo }             from 'react';
import { useQuery }                      from '@tanstack/react-query';
import { motion, AnimatePresence }       from 'framer-motion';
import {
  GraduationCap, ChevronDown, ChevronUp,
  Search, RefreshCw, Users, TrendingUp,
  AlertTriangle, CheckCircle, BookOpen,
}                                        from 'lucide-react';

import api                               from '../../services/api';
import PageShell, { PageHeader }         from '../../components/layout/PageShell';
import { useIsMobile }                   from '../../hooks/useIsMobile';
import { SPRING, EASE, DURATION }        from '../../lib/motion';

const RISK = {
  safe:    { label: 'Safe',    color: '#10b981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.25)'  },
  warning: { label: 'At risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)'  },
  danger:  { label: 'Danger',  color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)'   },
  none:    { label: 'No data', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)',border: 'rgba(148,163,184,0.25)' },
};

export default function LecturerPerformancePage() {
  const isMobile    = useIsMobile();
  const [search,    setSearch]    = useState('');
  const [expanded,  setExpanded]  = useState(null); // expanded class id

  // Fetch all lecturer classes
  const { data: classData, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn:  () => api.get('/classes').then(r => {
      const d = r.data;
      return d?.data ?? d;
    }),
  });

  const classes = classData?.classes ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.trim().toLowerCase();
    return classes.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q)
    );
  }, [classes, search]);

  return (
    <PageShell>
      <PageHeader
        title="Student Performance"
        subtitle={
          classesLoading
            ? 'Loading…'
            : `${classes.length} class${classes.length !== 1 ? 'es' : ''} · click any class to see student breakdown`
        }
      />

      {/* Search */}
      {classes.length > 0 && (
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search classes…"
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
      )}

      {/* Empty state */}
      {!classesLoading && classes.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) var(--space-3)', background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-molecular)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-molecular)', background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
            <BookOpen size={28} style={{ color: 'var(--brand-text)' }} />
          </div>
          <p style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-md)', marginBottom: 6 }}>No classes yet</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', maxWidth: 300 }}>
            Create a class to start tracking student performance.
          </p>
        </div>
      )}

      {/* Class list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(cls => (
          <ClassPerformanceRow
            key={cls.id}
            cls={cls}
            isMobile={isMobile}
            isExpanded={expanded === cls.id}
            onToggle={() => setExpanded(prev => prev === cls.id ? null : cls.id)}
          />
        ))}
      </div>
    </PageShell>
  );
}

// ─── Class row — fetches performance only when expanded ────────
function ClassPerformanceRow({ cls, isMobile, isExpanded, onToggle }) {
  const [studentSearch,  setStudentSearch]  = useState('');
  const [riskFilter,     setRiskFilter]     = useState('all');
  const [expandedStudent, setExpandedStudent] = useState(null);

  // Only fetch when expanded
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['class-performance', cls.id],
    queryFn:  () => api.get(`/classes/${cls.id}/performance`).then(r => {
      const d = r.data;
      return d?.data ?? d;
    }),
    enabled: isExpanded,
  });

  const summary     = data?.summary   ?? {};
  const allStudents = data?.students  ?? [];
  const threshold   = data?.class?.threshold ?? cls.attendance_threshold ?? 75;

  const students = useMemo(() => {
    let rows = allStudents;
    if (riskFilter !== 'all') rows = rows.filter(s => s.risk === riskFilter);
    if (studentSearch.trim()) {
      const q = studentSearch.trim().toLowerCase();
      rows = rows.filter(s =>
        s.studentName?.toLowerCase().includes(q) ||
        s.studentEmail?.toLowerCase().includes(q) ||
        s.studentNumber?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allStudents, riskFilter, studentSearch]);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-molecular)', overflow: 'hidden' }}>

      {/* Class header — always visible, click to expand */}
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: 'var(--space-3)', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        {/* Icon */}
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <GraduationCap size={18} color="var(--brand-text)" />
        </div>

        {/* Class info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cls.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--brand-text)', fontFamily: 'var(--font-mono)', background: 'var(--brand-subtle)', padding: '1px 8px', borderRadius: 99 }}>
              {cls.code}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={11} />
              {cls.enrollmentCount ?? 0} students
            </span>
            {isExpanded && data && (
              <>
                <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={11} />
                  {summary.avgPercentage ?? 0}% avg
                </span>
                {(summary.danger ?? 0) > 0 && (
                  <span style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={11} />
                    {summary.danger} at risk
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chevron + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isExpanded && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); refetch(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}
              title="Refresh"
            >
              <RefreshCw size={14} style={{ animation: isRefetching ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          )}
          {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE.state }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Loading */}
              {isLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
                  <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Loading student data…
                </div>
              )}

              {!isLoading && data && (
                <>
                  {/* Summary mini-cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 8 }}>
                    <MiniStat label="Total"   value={summary.total   ?? 0} color="var(--brand-text)"  />
                    <MiniStat label="Avg"     value={`${summary.avgPercentage ?? 0}%`} color="#10b981" />
                    <MiniStat label="Danger"  value={summary.danger  ?? 0} color="#ef4444"            />
                    <MiniStat label="Safe"    value={summary.safe    ?? 0} color="#10b981"            />
                  </div>

                  {/* Filter + search row */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Risk filter pills */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {['all','danger','warning','safe','none'].map(f => (
                        <button key={f} type="button" onClick={() => setRiskFilter(f)}
                          style={{
                            padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                            border: `1px solid ${riskFilter === f ? (RISK[f]?.border ?? 'var(--brand-border)') : 'var(--border)'}`,
                            background: riskFilter === f ? (RISK[f]?.bg ?? 'var(--brand-subtle)') : 'var(--bg-raised)',
                            color: riskFilter === f ? (RISK[f]?.color ?? 'var(--brand-text)') : 'var(--text-muted)',
                            cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                          }}
                        >
                          {f === 'all' ? `All (${allStudents.length})` : `${RISK[f]?.label} (${allStudents.filter(s => s.risk === f).length})`}
                        </button>
                      ))}
                    </div>

                    {/* Student search */}
                    <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 0 }}>
                      <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      <input
                        type="text" value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                        placeholder="Search students…"
                        style={{ width: '100%', padding: '6px 8px 6px 24px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>

                  {/* Student rows */}
                  {students.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
                      {allStudents.length === 0 ? 'No students enrolled yet.' : 'No students match your filter.'}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {students.map((s, idx) => (
                        <StudentRow
                          key={s.studentId}
                          student={s}
                          threshold={threshold}
                          isMobile={isMobile}
                          isExpanded={expandedStudent === s.studentId}
                          onToggle={() => setExpandedStudent(prev => prev === s.studentId ? null : s.studentId)}
                          index={idx}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Mini stat ─────────────────────────────────────────────────
function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-raised)', borderRadius: 'var(--radius-atomic)', padding: '10px 12px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ─── Student row with expandable session breakdown ─────────────
function StudentRow({ student: s, threshold, isMobile, isExpanded, onToggle, index }) {
  const riskCfg  = RISK[s.risk] ?? RISK.none;
  const barWidth = Math.min(100, s.percentage);
  const barColor = s.risk === 'safe'    ? '#10b981'
                 : s.risk === 'warning' ? '#f59e0b'
                 : s.risk === 'danger'  ? '#ef4444'
                 : '#94a3b8';

  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Main row */}
      <button
        type="button"
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        {/* Avatar */}
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
          {(s.studentName || '?').charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.studentName}
            </span>
            {s.studentNumber && (
              <span style={{ fontSize: 10, color: 'var(--brand-text)', fontFamily: 'var(--font-mono)', background: 'var(--brand-subtle)', padding: '1px 5px', borderRadius: 99 }}>
                {s.studentNumber}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 700, color: riskCfg.color, background: riskCfg.bg, border: `1px solid ${riskCfg.border}`, padding: '1px 6px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {riskCfg.label}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 6 }}>
            <div style={{ position: 'relative', height: 4, background: 'var(--bg-card)', borderRadius: 99 }}>
              <div style={{ height: 4, borderRadius: 99, background: barColor, width: `${barWidth}%`, transition: 'width 0.5s' }} />
              <div style={{ position: 'absolute', left: `${Math.min(100, threshold)}%`, top: -2, bottom: -2, width: 2, background: 'var(--text-muted)', borderRadius: 1, opacity: 0.35 }} />
            </div>
          </div>
        </div>

        {/* Percentage + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: barColor, lineHeight: 1 }}>{s.percentage}%</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{s.attendedCount}/{s.totalSessions}</div>
          </div>
          {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
        </div>
      </button>

      {/* Session breakdown */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE.state }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Session breakdown
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {s.sessions.map(sess => {
                  const sc = sess.status === 'present' ? '#10b981' : sess.status === 'late' ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={sess.sessionId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sess.title}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        {sess.openAt ? new Date(sess.openAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: sc, textTransform: 'capitalize', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
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
    </div>
  );
}