// client/src/pages/admin/AdminAuditPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence }          from 'framer-motion';
import {
  Shield, RefreshCw, ChevronLeft, ChevronRight,
  Clock, CheckCircle, AlertCircle, User, Filter,
  Eye,
}                                           from 'lucide-react';
import { format, formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';
import toast                                from 'react-hot-toast';
import api                                  from '../../services/api';
import { useIsMobile }                      from '../../hooks/useIsMobile';
import { SPRING }                           from '../../lib/motion';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: 'all',    label: 'All sessions'    },
  { value: 'ended',  label: 'Ended'           },
  { value: 'active', label: 'Still active'    },
];

export default function AdminAuditPage() {
  const isMobile = useIsMobile();

  const [logs,       setLogs]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [status,   setStatus]   = useState('all');
  const [adminId,  setAdminId]  = useState('');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');
  const [admins,   setAdmins]   = useState([]);

  // Expanded row for detail view
  const [expanded, setExpanded] = useState(null);

  // Fetch admin list for filter dropdown
  useEffect(() => {
    api.get('/admin/audit/admins').then(res => {
      const d = res.data;
      setAdmins(d?.admins ?? d?.data?.admins ?? []);
    }).catch(() => {});
  }, []);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const params = { page, limit: PAGE_SIZE, status };
      if (adminId) params.adminId = adminId;
      if (from)    params.from    = from;
      if (to)      params.to      = to;

      const res = await api.get('/admin/audit', { params });
      const d   = res.data?.data ?? res.data;
      setLogs(d?.logs       ?? []);
      setTotal(d?.total     ?? 0);
      setTotalPages(d?.totalPages ?? 1);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, status, adminId, from, to]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [status, adminId, from, to]);

  const formatDur = (minutes) => {
    if (minutes === null || minutes === undefined) return '—';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div style={{ padding: isMobile ? 'var(--space-3)' : 'var(--space-6)', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-display)' }}>

      {/* Header */}
      <header style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={18} color="var(--violet)" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--text-xl)' : 'clamp(20px,2.5vw,28px)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Audit Log
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {total.toLocaleString()} impersonation session{total !== 1 ? 's' : ''} recorded
            </p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 'var(--space-4)', alignItems: 'center' }}>

        {/* Status filter */}
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Admin filter */}
        {admins.length > 0 && (
          <select value={adminId} onChange={e => setAdminId(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">All admins</option>
            {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        {/* Date range */}
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }} />

        {/* Refresh */}
        <button type="button" onClick={() => fetchLogs(true)} disabled={refreshing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'auditSpin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Table / card list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 72, borderRadius: 'var(--radius-molecular)', opacity: 0.7 - i * 0.12 }} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', border: '1px dashed var(--border)' }}>
          <Shield size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>No impersonation sessions found</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sessions appear here when an admin uses "View as" on another user.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', border: '1px solid var(--border)', overflow: 'hidden' }}>

          {/* Desktop table header */}
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto auto', gap: 12, padding: '10px 16px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
              {['Admin', 'Viewed as', 'Reason', 'Started', 'Duration', 'Status'].map(h => (
                <p key={h} style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{h}</p>
              ))}
            </div>
          )}

          {/* Rows */}
          <AnimatePresence initial={false}>
            {logs.map((log, i) => {
              const isActive  = !log.ended_at;
              const isExp     = expanded === log.id;

              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  {/* Main row */}
                  <div
                    onClick={() => setExpanded(prev => prev === log.id ? null : log.id)}
                    style={{
                      display: isMobile ? 'flex' : 'grid',
                      gridTemplateColumns: isMobile ? undefined : '1fr 1fr 1fr auto auto auto',
                      flexDirection: isMobile ? 'column' : undefined,
                      gap: 12, padding: '12px 16px',
                      cursor: 'pointer', alignItems: isMobile ? 'stretch' : 'center',
                      background: isActive ? 'rgba(245,158,11,0.04)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isActive ? 'rgba(245,158,11,0.08)' : 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(245,158,11,0.04)' : 'transparent'}
                  >
                    {/* Admin */}
                    <UserCell name={log.admin?.name} email={log.admin?.email} icon={Shield} color="var(--violet)" />

                    {/* Target */}
                    <UserCell name={log.targetUser?.name} email={log.targetUser?.email} role={log.targetUser?.role} icon={Eye} color="var(--brand-text)" />

                    {/* Reason */}
                    <p style={{ margin: 0, fontSize: 12, color: log.reason ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: log.reason ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
                      {log.reason || 'No reason provided'}
                    </p>

                    {/* Started at */}
                    <div style={{ minWidth: isMobile ? 0 : 110 }}>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {format(new Date(log.started_at), 'dd MMM yyyy')}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {format(new Date(log.started_at), 'HH:mm:ss')}
                      </p>
                    </div>

                    {/* Duration */}
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', minWidth: 60 }}>
                      {formatDur(log.durationMin)}
                    </p>

                    {/* Status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {isActive ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#b45309', border: '1px solid rgba(245,158,11,0.25)' }}>
                          <Clock size={10} /> Active
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.10)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}>
                          <CheckCircle size={10} /> Ended
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  <AnimatePresence initial={false}>
                    {isExp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                          <DetailItem label="Session ID"  value={log.id}         mono />
                          <DetailItem label="Admin ID"    value={log.admin_id}   mono />
                          <DetailItem label="Target ID"   value={log.target_user_id} mono />
                          <DetailItem label="Started"     value={log.started_at ? format(new Date(log.started_at), 'dd MMM yyyy, HH:mm:ss') : '—'} />
                          <DetailItem label="Ended"       value={log.ended_at   ? format(new Date(log.ended_at),   'dd MMM yyyy, HH:mm:ss') : 'Still active'} />
                          <DetailItem label="Duration"    value={formatDur(log.durationMin)} />
                          {log.ip         && <DetailItem label="IP address"  value={log.ip}         mono />}
                          {log.user_agent && <DetailItem label="User agent"  value={log.user_agent} truncate />}
                          {log.reason     && <DetailItem label="Reason"      value={log.reason}     full />}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: page > 1 ? 'var(--text-primary)' : 'var(--text-muted)', cursor: page > 1 ? 'pointer' : 'not-allowed', fontSize: 13, fontFamily: 'inherit' }}>
            <ChevronLeft size={15} /> Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: page < totalPages ? 'var(--text-primary)' : 'var(--text-muted)', cursor: page < totalPages ? 'pointer' : 'not-allowed', fontSize: 13, fontFamily: 'inherit' }}>
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}

      <style>{`@keyframes auditSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── User cell ─────────────────────────────────────────────────
function UserCell({ name, email, role, icon: Icon, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={13} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name ?? '—'}</p>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {role ? `${role} · ` : ''}{email ?? ''}
        </p>
      </div>
    </div>
  );
}

// ─── Detail item ───────────────────────────────────────────────
function DetailItem({ label, value, mono, truncate, full }) {
  return (
    <div style={{ minWidth: 0, flex: full ? '1 1 100%' : 'none' }}>
      <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', overflow: truncate ? 'hidden' : 'visible', textOverflow: truncate ? 'ellipsis' : 'clip', whiteSpace: truncate ? 'nowrap' : 'normal', wordBreak: full ? 'break-word' : 'normal' }}>
        {value ?? '—'}
      </p>
    </div>
  );
}