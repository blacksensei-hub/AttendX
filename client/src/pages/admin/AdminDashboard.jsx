// client/src/pages/admin/AdminDashboard.jsx
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, MonitorPlay, Radio } from 'lucide-react';

import { consoleApi } from '../../services/consoleService';
import { useAuthStore } from '../../store/authStore';
import { ConsoleHead, Panel, Kpi, Sig, Empty, PanelSkeleton } from '../../components/console/Panel';
import { TrendLine } from '../../components/console/charts';
import AuditLine from '../../components/console/AuditLine';
import { pctFormat, timeAgo, usePanelReveal } from '../../components/console/format';
import { shortName, withStop } from '../../lib/names';

/**
 * ═════════════════════════════════════════════════════════════════
 * Admin overview: the institution right now.
 *
 * Four numbers that decide where an admin looks next (attendance this
 * semester, sessions live, students at risk, fraud flags waiting),
 * then the semester's weekly trend, what is live, who is on the
 * platform and the latest audit events. Polls every 30 seconds.
 * ═════════════════════════════════════════════════════════════════
 */

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function AdminDashboard() {
  const user = useAuthStore(s => s.user);
  const grid = useRef(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: consoleApi.overview,
    refetchInterval: 30_000,
  });
  usePanelReveal(grid, Boolean(data));

  const k = data?.kpis;
  const flags = k ? k.openFlags.high + k.openFlags.medium + k.openFlags.low : 0;
  const trend = (data?.trend ?? []).map(w => ({
    label: new Date(w.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    value: w.rate,
  }));

  return (
    <div className="c-page">
      <ConsoleHead
        kicker={`Admin / ${data?.range?.label ?? 'Overview'}`}
        title={withStop(`${greeting()}, ${shortName(user?.name) || 'admin'}`)}
        lede="Where the institution stands this semester, and what needs you next."
        actions={<Link to="/admin/ops" className="btn-ghost btn-sm"><MonitorPlay size={15} /> Ops wall</Link>}
      />

      {isError && (
        <Panel alert label="Could not load">
          <p className="c-subtle" style={{ fontSize: 14 }}>The overview did not load. <button type="button" className="btn-ghost btn-sm" onClick={() => refetch()}>Try again</button></p>
        </Panel>
      )}

      {isPending ? (
        <div className="c-grid">
          {[0, 1, 2, 3].map(i => <PanelSkeleton key={i} className="span-3" />)}
          <PanelSkeleton className="span-8" lines={5} />
          <PanelSkeleton className="span-4" lines={5} />
        </div>
      ) : data && (
        <div className="c-grid" ref={grid}>
          <Kpi className="span-3" label="Attendance rate" value={k.rate} format={pctFormat}
               foot={`${k.sessions} closed session${k.sessions === 1 ? '' : 's'} this ${data.range.label === 'All time' ? 'record' : 'semester'}`} />
          <Kpi className="span-3" label="Live now" value={k.liveSessions}
               delta={<Sig tone={k.liveSessions ? 'live' : 'idle'}>{k.liveSessions ? 'Live' : 'Quiet'}</Sig>}
               foot={k.liveSessions === 1 ? 'session taking attendance' : 'sessions taking attendance'} />
          <Kpi className="span-3" label="Students at risk" value={k.atRisk}
               foot={<Link to="/admin/at-risk" className="c-subtle">below their class minimum <ArrowUpRight size={12} style={{ verticalAlign: -2 }} /></Link>} />
          <Kpi className="span-3" label="Fraud flags to review" value={flags}
               delta={k.openFlags.high ? <span className="chip red">{k.openFlags.high} high</span> : null}
               foot={<Link to="/admin/fraud" className="c-subtle">{flags ? 'Open the queue' : 'Nothing waiting'} <ArrowUpRight size={12} style={{ verticalAlign: -2 }} /></Link>} />

          <Panel className="span-8" label="Attendance by week" title={data.range.label}
                 actions={<Link to="/admin/analytics" className="btn-ghost btn-sm">Analytics <ArrowUpRight size={14} /></Link>}>
            <TrendLine data={trend} />
          </Panel>

          <Panel className="span-4" label="Live now" title={k.liveSessions ? `${k.liveSessions} session${k.liveSessions === 1 ? '' : 's'} open` : 'No sessions open'}
                 actions={<Link to="/admin/sessions" className="btn-ghost btn-sm">Sessions</Link>}>
            {data.live.length === 0 ? (
              <Empty icon={Radio} title="Nothing live right now">Sessions appear here the moment a lecturer opens one.</Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.live.map(s => {
                  const pct = s.enrolled ? Math.round((s.marked / s.enrolled) * 100) : 0;
                  return (
                    <div key={s.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.className}</span>
                        <span className="tabular c-subtle">{s.marked}/{s.enrolled}</span>
                      </div>
                      <div className="barlist-track" style={{ marginTop: 6 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.className} seats marked`}>
                        <div className="barlist-fill good" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="c-muted" style={{ fontSize: 12, marginTop: 5 }}>{s.lecturer ?? 'Lecturer'} · opened {timeAgo(s.openAt)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel className="span-4" label="People" title="On the platform">
            <dl className="dl" style={{ fontSize: 14 }}>
              <dt>Students</dt><dd className="tabular">{k.students.toLocaleString()}</dd>
              <dt>Lecturers</dt><dd className="tabular">{k.lecturers.toLocaleString()}</dd>
              <dt>Active classes</dt><dd className="tabular">{k.classes.toLocaleString()}</dd>
              <dt>Invites not yet accepted</dt>
              <dd className="tabular">{k.pendingInvites ? <Link to="/admin/users?status=invited">{k.pendingInvites}</Link> : 0}</dd>
            </dl>
            <div className="c-actions" style={{ marginTop: 16 }}>
              <Link to="/admin/users" className="btn-ghost btn-sm">Users</Link>
              <Link to="/admin/users/import" className="btn-ghost btn-sm">Import from CSV</Link>
            </div>
          </Panel>

          <Panel className="span-8" label="Audit trail" title="Latest changes"
                 actions={<Link to="/admin/audit" className="btn-ghost btn-sm">Full trail <ArrowUpRight size={14} /></Link>}>
            {data.recent.length === 0
              ? <Empty title="Nothing recorded yet">Sensitive actions (role changes, resets, reviews) are listed here as they happen.</Empty>
              : <div className="feed">{data.recent.map(e => <AuditLine key={e.id} event={e} />)}</div>}
          </Panel>
        </div>
      )}
    </div>
  );
}
