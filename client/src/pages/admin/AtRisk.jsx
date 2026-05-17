// client/src/pages/admin/AtRisk.jsx

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, AlertCircle, TrendingDown, Mail, UserPlus,
  Loader2, RefreshCw, Search, ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAtRisk, notifyAtRiskStudent, notifyAtRiskLecturer } from '../../services/adminService';
import { useIsMobile } from '../../hooks/useIsMobile';

const BUCKETS = [
  {
    key:         'belowThreshold',
    label:       'Below threshold',
    description: 'Attendance percentage has dropped below the class threshold.',
    accent:      '#dc2626',
    bg:          'rgba(220,38,38,0.08)',
    icon:        ShieldAlert,
  },
  {
    key:         'approaching',
    label:       'Approaching threshold',
    description: 'Within 5 percentage points of falling below — early warning band.',
    accent:      '#f59e0b',
    bg:          'rgba(245,158,11,0.10)',
    icon:        AlertTriangle,
  },
  {
    key:         'recentDropouts',
    label:       'Recent dropouts',
    description: 'Missed two or more closed sessions in a row.',
    accent:      '#7c3aed',
    bg:          'rgba(124,58,237,0.10)',
    icon:        TrendingDown,
  },
];

export default function AdminAtRiskPage() {
  const isMobile = useIsMobile();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [busyKey,    setBusyKey]    = useState(null);
  const [activeBucket, setActiveBucket] = useState('belowThreshold');

  async function loadData(showSpinner = true) {
    if (showSpinner) setLoading(true); else setRefreshing(true);
    try {
      const result = await getAtRisk();
      setData(result);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load at-risk data');
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { loadData(); }, []);

  async function handleNotifyStudent(row) {
    const key = `${row.studentId}:${row.classId}:student`;
    setBusyKey(key);
    try {
      await notifyAtRiskStudent(row.studentId, row.classId);
      toast.success(`Notified ${row.studentName}`);
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setBusyKey(null); }
  }

  async function handleNotifyLecturer(row) {
    if (!row.lecturerId) { toast.error('No lecturer assigned'); return; }
    const key = `${row.studentId}:${row.classId}:lecturer`;
    setBusyKey(key);
    try {
      await notifyAtRiskLecturer(row.studentId, row.classId);
      toast.success(`Notified ${row.lecturerName || 'lecturer'}`);
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setBusyKey(null); }
  }

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const rows = data[activeBucket] || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.studentName   || '').toLowerCase().includes(q) ||
      (r.studentEmail  || '').toLowerCase().includes(q) ||
      (r.studentNumber || '').toLowerCase().includes(q) ||
      (r.className     || '').toLowerCase().includes(q)
    );
  }, [data, activeBucket, search]);

  const summary    = data?.summary || { totalAtRisk: 0, dropoutCount: 0 };
  const activeMeta = BUCKETS.find(b => b.key === activeBucket);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--text-muted)' }}>
        <Loader2 size={24} className="arSpin" />
        Computing at-risk students…
        <style>{`.arSpin{animation:arSpinK 0.9s linear infinite}@keyframes arSpinK{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 'var(--space-3)' : 'var(--space-6,24px)', maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font-display)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--text-xl)' : 'clamp(20px,2.5vw,28px)', fontWeight: 700, color: 'var(--text-primary)' }}>
            At-risk students
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {summary.totalAtRisk} students need attention
            {summary.dropoutCount > 0 && ` · ${summary.dropoutCount} recent dropouts`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadData(false)}
          disabled={refreshing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
        >
          {refreshing ? <Loader2 size={16} className="arSpin" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      {/* Bucket tabs — horizontal scroll on mobile */}
      <div style={{
        display: isMobile ? 'flex' : 'grid',
        gridTemplateColumns: isMobile ? undefined : 'repeat(3, 1fr)',
        gap: 10, marginBottom: 'var(--space-4)',
        overflowX: isMobile ? 'auto' : 'visible',
        paddingBottom: isMobile ? 4 : 0,
      }}>
        {BUCKETS.map(bucket => {
          const Icon     = bucket.icon;
          const count    = (data?.[bucket.key] || []).length;
          const isActive = activeBucket === bucket.key;
          return (
            <button
              key={bucket.key}
              type="button"
              onClick={() => setActiveBucket(bucket.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: isMobile ? '12px 14px' : 'var(--space-3,14px)',
                borderRadius: 'var(--radius-lg,14px)',
                border: `1px solid ${isActive ? bucket.accent : 'var(--border)'}`,
                background: isActive ? bucket.bg : 'var(--bg-card)',
                cursor: 'pointer', fontFamily: 'inherit',
                flexShrink: isMobile ? 0 : undefined,
                minWidth: isMobile ? 200 : undefined,
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bucket.bg, color: bucket.accent, flexShrink: 0 }}>
                <Icon size={16} />
              </div>
              {!isMobile && (
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{bucket.label}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{bucket.description}</div>
                </div>
              )}
              {isMobile && (
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{bucket.label}</div>
                </div>
              )}
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: bucket.accent, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active bucket header + search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeMeta && (
            <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeMeta.bg, color: activeMeta.accent }}>
              <activeMeta.icon size={14} />
            </div>
          )}
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{activeMeta?.label}</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-raised)', padding: '2px 10px', borderRadius: 99 }}>
            {filteredRows.length}
          </span>
        </div>
        <div style={{ position: 'relative', width: isMobile ? '100%' : 260, maxWidth: '100%' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} aria-hidden />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name, email, or class…"
            style={{ width: '100%', padding: '8px 10px 8px 28px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Rows */}
      <AnimatePresence mode="popLayout">
        {filteredRows.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg,14px)', border: '1px dashed var(--border)' }}
          >
            <AlertCircle size={26} color="var(--text-muted)" />
            <p style={{ margin: '12px 0 0', color: 'var(--text-muted)' }}>
              {search ? 'No students match your search.' : 'No students currently in this bucket.'}
            </p>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'grid', gap: 10 }}>
            {filteredRows.map(row => (
              <AtRiskRow
                key={`${row.studentId}-${row.classId}`}
                row={row}
                accent={activeMeta?.accent}
                bucket={activeBucket}
                busyKey={busyKey}
                isMobile={isMobile}
                onNotifyStudent={handleNotifyStudent}
                onNotifyLecturer={handleNotifyLecturer}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`.arSpin{animation:arSpinK 0.9s linear infinite}@keyframes arSpinK{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function AtRiskRow({ row, accent, bucket, busyKey, isMobile, onNotifyStudent, onNotifyLecturer }) {
  const studentBusy  = busyKey === `${row.studentId}:${row.classId}:student`;
  const lecturerBusy = busyKey === `${row.studentId}:${row.classId}:lecturer`;
  const barWidth     = Math.min(100, Math.max(0, row.percentage || 0));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg,12px)', padding: 'var(--space-3)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'stretch',
        gap: 14,
      }}
    >
      {/* Student info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {(row.studentName || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.studentName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
              {row.studentNumber && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-raised)', padding: '1px 6px', borderRadius: 99 }}>{row.studentNumber}</span>}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.studentEmail}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{row.percentage}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{row.attendedCount}/{row.totalSessions}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ position: 'relative', height: 5, background: 'var(--bg-raised)', borderRadius: 99 }}>
            <div style={{ height: 5, borderRadius: 99, background: accent, width: `${barWidth}%`, transition: 'width 0.3s' }} />
            <div style={{ position: 'absolute', left: `${Math.min(100, row.threshold)}%`, top: -2, bottom: -2, width: 2, background: 'var(--text-secondary)', borderRadius: 1, opacity: 0.4 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Class: <strong style={{ color: 'var(--text-primary)' }}>{row.className}</strong></span>
            <span>Threshold: {row.threshold}%</span>
          </div>
        </div>

        {bucket === 'recentDropouts' && (
          <div style={{ marginTop: 8, padding: '5px 8px', borderRadius: 6, background: 'rgba(124,58,237,0.10)', color: '#7c3aed', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
            <TrendingDown size={12} style={{ marginRight: 5 }} />
            Missed last {row.consecutiveMissed} consecutive sessions
          </div>
        )}
      </div>

      {/* Action buttons — row on desktop, row on mobile too but full width */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        justifyContent: isMobile ? 'stretch' : 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => onNotifyStudent(row)}
          disabled={studentBusy}
          style={{
            flex: isMobile ? 1 : undefined,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 'var(--radius-atomic)',
            border: 'none', background: 'var(--brand)', color: '#ffffff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}
        >
          {studentBusy ? <Loader2 size={13} className="arSpin" /> : <Mail size={13} />}
          Notify student
        </button>
        <button
          type="button"
          onClick={() => onNotifyLecturer(row)}
          disabled={lecturerBusy || !row.lecturerId}
          style={{
            flex: isMobile ? 1 : undefined,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 'var(--radius-atomic)',
            border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontSize: 12, fontWeight: 600,
            cursor: row.lecturerId ? 'pointer' : 'not-allowed',
            opacity: row.lecturerId ? 1 : 0.5, whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}
        >
          {lecturerBusy ? <Loader2 size={13} className="arSpin" /> : <UserPlus size={13} />}
          Notify lecturer
        </button>
      </div>
    </motion.div>
  );
}