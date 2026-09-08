// client/src/pages/admin/AuditLog.jsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Loader2, Search, Clock, ArrowRight, ShieldOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { listImpersonationLogs } from '../../services/adminService';
import { useIsMobile }           from '../../hooks/useIsMobile';

/**
 * ═════════════════════════════════════════════════════════════════
 * AuditLog — impersonation history.
 *
 * The impersonate modal tells admins "This action is logged." This
 * page is where that log is actually visible — without it the claim
 * is unverifiable and the recorded data is write-only.
 *
 * Rows come from GET /impersonation/logs (newest first, capped at 100
 * server-side). Search filters client-side over the loaded rows, which
 * is fine at that size; if the cap ever rises this should move to a
 * server-side query.
 *
 * A row with no ended_at means the session was never explicitly
 * stopped — usually the token simply expired, or the admin closed the
 * tab. Worth surfacing rather than hiding, since a long-running open
 * session is exactly what an auditor would want to notice.
 * ═════════════════════════════════════════════════════════════════
 */
export default function AuditLogPage() {
  const isMobile = useIsMobile();

  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await listImpersonationLogs();
        setLogs(data.logs || []);
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const term = search.trim().toLowerCase();
  const visible = term
    ? logs.filter(l =>
        [l.admin?.name, l.admin?.email, l.targetUser?.name, l.targetUser?.email, l.reason]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(term))
      )
    : logs;

  return (
    <div style={{ padding: isMobile ? 'var(--space-3)' : 'var(--space-6)', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-display)' }}>

      {/* Header */}
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--text-xl)' : 'clamp(20px,2.5vw,28px)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Audit log
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Every time an admin views AttendX as another user, it's recorded here.
          {logs.length > 0 && ` Showing the ${logs.length} most recent.`}
        </p>
      </header>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-4)', maxWidth: 420 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} aria-hidden />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by admin, user, or reason…"
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 20px', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={26} className="audSpin" />
          <span>Loading audit log…</span>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState hasLogs={logs.length > 0} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(log => <LogRow key={log.id} log={log} isMobile={isMobile} />)}
        </div>
      )}

      <style>{`.audSpin{animation:audSpinK 0.9s linear infinite}@keyframes audSpinK{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Single log entry ─────────────────────────────────────────
function LogRow({ log, isMobile }) {
  const started = log.started_at ? new Date(log.started_at) : null;
  const ended   = log.ended_at   ? new Date(log.ended_at)   : null;
  const open    = Boolean(started && !ended);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--radius-molecular)',
        padding:      'var(--space-3)',
      }}
    >
      {/* Who → whom */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           10,
        flexWrap:      'wrap',
        marginBottom:  8,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--violet-bg)', border: '1px solid var(--violet-border)',
          color: 'var(--violet)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Shield size={15} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14 }}>
            <strong style={{ color: 'var(--text-primary)' }}>
              {log.admin?.name || 'Unknown admin'}
            </strong>
            <ArrowRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <strong style={{ color: 'var(--text-primary)' }}>
              {log.targetUser?.name || 'Unknown user'}
            </strong>
            {log.targetUser?.role && (
              <span style={{
                padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                background: 'var(--bg-raised)', color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}>
                {log.targetUser.role}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {log.admin?.email}
          </div>
        </div>

        {open && (
          <span
            title="No end time recorded — the token likely expired or the tab was closed"
            style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 99,
              fontSize: 11, fontWeight: 700,
              background: 'var(--amber-bg)', color: 'var(--amber)',
              border: '1px solid var(--amber-border)',
            }}
          >
            <ShieldOff size={11} />
            Not closed
          </span>
        )}
      </div>

      {/* Reason */}
      {log.reason && (
        <p style={{
          margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)',
          lineHeight: 1.5,
          borderLeft: '3px solid var(--border)', paddingLeft: 10,
        }}>
          {log.reason}
        </p>
      )}

      {/* Meta */}
      <div style={{
        display: 'flex', gap: isMobile ? 8 : 16, flexWrap: 'wrap',
        fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} />
          {started ? started.toLocaleString() : '—'}
        </span>
        <span>{formatDuration(started, ended)}</span>
        {log.ip && <span>IP {log.ip}</span>}
      </div>
    </motion.div>
  );
}

// ─── Duration helper ──────────────────────────────────────────
function formatDuration(started, ended) {
  if (!started) return '';
  if (!ended)   return 'duration unknown';

  const ms = ended - started;
  if (ms < 0) return 'duration unknown';

  const mins = Math.floor(ms / 60000);
  if (mins < 1)  return 'under a minute';
  if (mins < 60) return `${mins} min`;

  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

// ─── Empty state ──────────────────────────────────────────────
function EmptyState({ hasLogs }) {
  return (
    <div style={{
      padding: '48px 20px', textAlign: 'center',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-molecular)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14, margin: '0 auto 12px',
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Shield size={24} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>
        {hasLogs ? 'No matching entries' : 'Nothing logged yet'}
      </p>
      <p style={{ margin: '6px auto 0', fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.5 }}>
        {hasLogs
          ? 'Try a different search term.'
          : 'Impersonation events appear here as soon as an admin views AttendX as another user.'}
      </p>
    </div>
  );
}