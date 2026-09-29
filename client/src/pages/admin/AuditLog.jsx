// client/src/pages/admin/AuditLog.jsx
import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { FileDown, ScrollText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { consoleApi } from '../../services/consoleService';
import { listImpersonationLogs } from '../../services/adminService';
import { ConsoleHead, Panel, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Drawer } from '../../components/console/overlays';
import { Tabs, SearchInput, Select } from '../../components/console/controls';
import { timeAgo, fmtDateTime } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Audit trail: every sensitive action, who did it and what changed.
 *
 * Filter by kind of action, date range or free text; export what the
 * filters show as CSV. Opening an event shows its before/after values.
 * "View as sessions" keeps the older impersonation log, which predates
 * the trail and records how long each session lasted.
 * ═════════════════════════════════════════════════════════════════
 */

const GROUPS = [
  { value: '', label: 'Every action' },
  { value: 'user.', label: 'Accounts' },
  { value: 'users.', label: 'Imports and bulk changes' },
  { value: 'impersonation.', label: 'View as' },
  { value: 'attendance.', label: 'Attendance adjustments' },
  { value: 'appeal.', label: 'Appeals' },
  { value: 'session.', label: 'Sessions' },
  { value: 'class.', label: 'Classes' },
  { value: 'fraud.', label: 'Fraud reviews' },
  { value: 'settings.', label: 'Policy settings' },
  { value: 'semester.', label: 'Semesters' },
  { value: 'calendar.', label: 'Calendar events' },
  { value: 'announcement.', label: 'Announcements' },
];

const fmtValue = (v) => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function AuditLog() {
  const [tab, setTab] = useState('trail');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [openEvent, setOpenEvent] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(q.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const filters = { q: debounced || undefined, action: action || undefined, from: from || undefined, to: to || undefined };
  const { data, isPending } = useQuery({
    queryKey: ['admin-audit', filters, page],
    queryFn: () => consoleApi.audit({ ...filters, page, limit: 40 }),
    placeholderData: keepPreviousData,
    enabled: tab === 'trail',
  });
  const { data: logs, isPending: logsPending } = useQuery({
    queryKey: ['admin-impersonation-logs'],
    queryFn: listImpersonationLogs,
    enabled: tab === 'viewas',
  });

  const exportCsv = async () => {
    setExporting(true);
    try { await consoleApi.auditCsv(filters); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const columns = [
    { key: 'when', header: 'When', width: 150, render: e => <span className="c-subtle tabular" title={fmtDateTime(e.created_at)}>{timeAgo(e.created_at)}</span> },
    { key: 'who', header: 'Who', render: e => (
      <span><span className="cell-main">{e.actor_name ?? 'System'}</span><span className="cell-sub">{e.actor_role ?? ''}{e.on_behalf_of ? ' · via view as' : ''}</span></span>
    ) },
    { key: 'what', header: 'What', render: e => (
      <span><span style={{ color: 'var(--text-primary)' }}>{e.summary ?? e.action}</span><span className="cell-sub">{data?.actions?.[e.action] ?? e.action}</span></span>
    ) },
    { key: 'target', header: 'Target', render: e => <span className="c-subtle">{e.target_label ?? '—'}</span> },
  ];

  const logColumns = [
    { key: 'started', header: 'Started', render: l => <span className="c-subtle" title={fmtDateTime(l.started_at)}>{timeAgo(l.started_at)}</span> },
    { key: 'admin', header: 'Admin', render: l => <span className="cell-main">{l.admin?.name ?? 'Deleted admin'}</span> },
    { key: 'target', header: 'Viewed as', render: l => <span><span className="cell-main">{l.targetUser?.name ?? 'Deleted user'}</span><span className="cell-sub">{l.targetUser?.role ?? ''}</span></span> },
    { key: 'length', header: 'Length', render: l => (l.ended_at
      ? <span className="tabular c-subtle">{Math.max(1, Math.round((new Date(l.ended_at) - new Date(l.started_at)) / 60000))} min</span>
      : <span className="c-muted">Not ended</span>) },
    { key: 'reason', header: 'Reason', render: l => <span className="c-subtle">{l.reason ?? '—'}</span> },
  ];

  const changes = openEvent?.changes && typeof openEvent.changes === 'object' ? Object.entries(openEvent.changes) : [];

  return (
    <div className="c-page">
      <ConsoleHead
        kicker="Trust / Audit trail"
        title="Audit trail"
        lede="Every role change, reset, adjustment, review and policy change, with who made it. Nothing here can be edited or deleted."
        actions={tab === 'trail' && (
          <button type="button" className="btn-ghost btn-sm" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={15} />} Export CSV
          </button>
        )}
      />

      <Panel flush>
        <div style={{ padding: '6px 14px 0' }}>
          <Tabs label="Audit views" value={tab} onChange={setTab} tabs={[
            { value: 'trail', label: 'All changes', count: data?.total },
            { value: 'viewas', label: 'View-as sessions' },
          ]} />
        </div>

        {tab === 'trail' ? (
          <>
            <div className="c-toolbar" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
              <SearchInput value={q} onChange={setQ} placeholder="Search summaries, people, targets" label="Search the audit trail" />
              <Select label="Kind of action" value={action} onChange={v => { setAction(v); setPage(1); }} options={GROUPS} />
              <label className="c-actions" style={{ gap: 6, fontSize: 13 }}>
                <span className="c-label">From</span>
                <input type="date" className="c-input" style={{ width: 'auto' }} value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPage(1); }} />
              </label>
              <label className="c-actions" style={{ gap: 6, fontSize: 13 }}>
                <span className="c-label">To</span>
                <input type="date" className="c-input" style={{ width: 'auto' }} value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPage(1); }} />
              </label>
            </div>
            <DataTable
              caption="Audit events"
              columns={columns}
              rows={data?.events ?? []}
              loading={isPending}
              onRowClick={setOpenEvent}
              page={data?.page ?? page}
              totalPages={data?.totalPages ?? 1}
              total={data?.total}
              onPage={setPage}
              empty={<Empty icon={ScrollText} title="No matching events">Widen the date range or clear the filters.</Empty>}
            />
          </>
        ) : (
          <DataTable
            caption="View-as sessions"
            columns={logColumns}
            rows={logs?.logs ?? []}
            loading={logsPending}
            empty={<Empty title="No view-as sessions yet" />}
          />
        )}
      </Panel>

      <Drawer open={Boolean(openEvent)} onClose={() => setOpenEvent(null)}
              label={openEvent ? (data?.actions?.[openEvent.action] ?? openEvent.action) : ''}
              title={openEvent?.summary ?? ''}>
        {openEvent && (
          <>
            <dl className="dl">
              <dt>When</dt><dd>{fmtDateTime(openEvent.created_at)}</dd>
              <dt>Who</dt><dd>{openEvent.actor_name ?? 'System'}{openEvent.actor_role ? ` (${openEvent.actor_role})` : ''}</dd>
              {openEvent.on_behalf_of && (<><dt>During</dt><dd>A view-as session</dd></>)}
              <dt>Target</dt><dd>{openEvent.target_label ?? '—'}{openEvent.target_type ? <span className="c-muted"> · {openEvent.target_type}</span> : null}</dd>
              <dt>Action</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{openEvent.action}</dd>
              {openEvent.ip && (<><dt>IP address</dt><dd className="tabular">{openEvent.ip}</dd></>)}
            </dl>
            {changes.length > 0 && (
              <Panel label="Details" flush>
                <table className="dt">
                  <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
                  <tbody>
                    {changes.map(([k, v]) => (
                      <tr key={k}>
                        <td className="cell-main">{k}</td>
                        {Array.isArray(v) && v.length === 2
                          ? (<><td>{fmtValue(v[0])}</td><td style={{ color: 'var(--text-primary)' }}>{fmtValue(v[1])}</td></>)
                          : <td colSpan={2} style={{ overflowWrap: 'anywhere' }}>{fmtValue(v)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
