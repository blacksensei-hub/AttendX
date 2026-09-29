// client/src/pages/admin/Health.jsx
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { consoleApi } from '../../services/consoleService';
import { ConsoleHead, Panel, Sig, PanelSkeleton } from '../../components/console/Panel';
import { timeAgo, fmtDateTime } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * System health: is the server up, is the database reachable and
 * migrated, are the background jobs ticking, is email working.
 *
 * A job is "stalled" when its last tick is older than three of its
 * intervals; a stalled scheduler means sessions stop auto-closing.
 * ═════════════════════════════════════════════════════════════════
 */

const JOBS = [
  { key: 'sessionScheduler', label: 'Session auto-close', every: 30 },
  { key: 'scheduleRunner', label: 'Timetabled sessions', every: 60 },
  { key: 'announcements', label: 'Scheduled announcements', every: 60 },
  { key: 'digest', label: 'Weekly digest check', every: 300 },
];

const uptime = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

export default function Health() {
  const { data, isPending, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['admin-health'],
    queryFn: consoleApi.health,
    refetchInterval: 15_000,
  });

  const migrated = data && data.db.ok && data.db.missingTables.length === 0;
  const now = dataUpdatedAt || 0;

  return (
    <div className="c-page">
      <ConsoleHead
        kicker="System / Health"
        title="Health"
        lede={dataUpdatedAt ? `Checked ${timeAgo(dataUpdatedAt)}. Refreshes every 15 seconds.` : 'Checking…'}
        actions={<button type="button" className="btn-ghost btn-sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw size={14} className={isFetching ? 'animate-spin' : undefined} /> Check now</button>}
      />

      {isPending ? (
        <div className="c-grid">{[0, 1, 2, 3].map(i => <PanelSkeleton key={i} className="span-6" lines={4} />)}</div>
      ) : data && (
        <div className="c-grid">
          <Panel className="span-6" label="Server" title={<><Sig tone="live">Up</Sig> <span style={{ marginLeft: 8 }}>for {uptime(data.api.uptimeSec)}</span></>}>
            <dl className="dl">
              <dt>Started</dt><dd>{fmtDateTime(data.api.startedAt)}</dd>
              <dt>Node.js</dt><dd className="tabular">{data.api.node}</dd>
              <dt>Environment</dt><dd>{data.api.env}</dd>
              <dt>Memory</dt><dd className="tabular">{data.api.memoryMb} MB</dd>
              <dt>Live connections</dt><dd className="tabular">{data.sockets.connected}</dd>
            </dl>
          </Panel>

          <Panel className="span-6" label="Database" alert={!migrated}
                 title={!data.db.ok ? <Sig tone="bad">Unreachable</Sig> : migrated ? <Sig tone="live">Connected</Sig> : <Sig tone="warn">Migration needed</Sig>}>
            <dl className="dl">
              <dt>Latency</dt><dd className="tabular">{data.db.latencyMs ?? '—'} ms</dd>
              <dt>Admin console tables</dt>
              <dd>{migrated ? 'All present' : `Missing: ${data.db.missingTables.join(', ')}`}</dd>
            </dl>
            {!migrated && data.db.ok && (
              <p className="c-subtle" style={{ fontSize: 13, marginTop: 12 }}>
                Run <code style={{ fontFamily: 'var(--font-mono)' }}>server/sql/2026-09-27_admin_console.sql</code> against the database. Until then, fraud review, the audit trail, the calendar and announcements can't save.
              </p>
            )}
          </Panel>

          <Panel className="span-6" label="Background jobs" title="Schedulers">
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {JOBS.map(j => {
                const last = data.jobs[j.key];
                const age = last ? (now - new Date(last).getTime()) / 1000 : null;
                // A job ticks for the first time one interval after start,
                // so give it two before calling it stalled.
                const tone = age == null ? (data.api.uptimeSec < j.every * 2 ? 'idle' : 'bad') : age > j.every * 3 ? 'bad' : 'live';
                return (
                  <li key={j.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{j.label}<span className="c-muted" style={{ fontSize: 12, marginLeft: 8 }}>every {j.every >= 60 ? `${j.every / 60} min` : `${j.every}s`}</span></span>
                    <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className="c-muted" style={{ fontSize: 12 }}>{last ? timeAgo(last) : 'not yet'}</span>
                      <Sig tone={tone}>{tone === 'live' ? 'OK' : tone === 'bad' ? 'Stalled' : 'Starting'}</Sig>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel className="span-6" label="Email" alert={!data.email.configured || data.email.failed > data.email.sent}
                 title={!data.email.configured ? <Sig tone="bad">Not configured</Sig> : data.email.failed && !data.email.sent ? <Sig tone="bad">Failing</Sig> : <Sig tone="live">Working</Sig>}>
            <dl className="dl">
              <dt>Sent since start</dt><dd className="tabular">{data.email.sent}</dd>
              <dt>Failed since start</dt><dd className="tabular">{data.email.failed}</dd>
              {data.email.lastError && (<><dt>Last error</dt><dd style={{ color: 'var(--red)' }}>{data.email.lastError} <span className="c-muted">({timeAgo(data.email.lastErrorAt)})</span></dd></>)}
            </dl>
          </Panel>
        </div>
      )}
    </div>
  );
}
