// client/src/pages/admin/AdminSessions.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MonitorPlay, Radio, RefreshCw, Square } from 'lucide-react';
import toast from 'react-hot-toast';

import { adminService } from '../../services/adminService';
import { ConsoleHead, Panel, Sig, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { ConfirmDialog } from '../../components/console/overlays';
import { timeAgo, fmtDateTime } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Live sessions across the institution, refreshed every 15 seconds.
 * Force-closing runs the same close as the lecturer's button: absences
 * are recorded, students are emailed their result, and the close is
 * written to the audit trail.
 * ═════════════════════════════════════════════════════════════════
 */
export default function AdminSessions() {
  const qc = useQueryClient();
  const [closing, setClosing] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, isPending, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin-active-sessions'],
    queryFn: adminService.getActiveSessions,
    refetchInterval: 15_000,
  });
  const sessions = data?.sessions ?? [];

  const forceClose = async () => {
    setBusy(true);
    try {
      await adminService.forceCloseSession(closing.id);
      toast.success('Session closed. Absences recorded.');
      setClosing(null);
      qc.invalidateQueries({ queryKey: ['admin-active-sessions'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not close the session');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'class', header: 'Class', sort: s => s.class?.name ?? '', render: s => (
      <span><span className="cell-main">{s.class?.name ?? s.class_name_snapshot}</span><span className="cell-sub">{s.class?.code ?? ''}{s.title ? ` · ${s.title}` : ''}</span></span>
    ) },
    { key: 'lecturer', header: 'Lecturer', render: s => <span className="c-subtle">{s.class?.lecturer?.name ?? '—'}</span> },
    { key: 'opened', header: 'Opened', sort: s => new Date(s.open_at).getTime(), render: s => <span className="c-subtle" title={fmtDateTime(s.open_at)}>{timeAgo(s.open_at)}</span> },
    { key: 'closes', header: 'Closes', render: s => <span className="c-subtle tabular">{s.close_at ? new Date(s.close_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'When the lecturer closes it'}</span> },
    { key: 'marked', header: 'Marked', num: true, sort: s => s.attendanceCount, render: s => <span className="tabular">{s.attendanceCount}</span> },
    { key: 'action', header: '', num: true, render: s => (
      <button type="button" className="btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setClosing(s); }}><Square size={13} /> Force close</button>
    ) },
  ];

  return (
    <div className="c-page">
      <ConsoleHead
        kicker="Teaching / Sessions"
        title="Live sessions"
        lede={dataUpdatedAt ? `Updated ${timeAgo(dataUpdatedAt)}. Refreshes every 15 seconds.` : 'Every session taking attendance right now.'}
        actions={(
          <>
            <button type="button" className="btn-ghost btn-sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw size={14} className={isFetching ? 'animate-spin' : undefined} /> Refresh</button>
            <Link to="/admin/ops" className="btn-ghost btn-sm"><MonitorPlay size={15} /> Ops wall</Link>
          </>
        )}
      />
      <Panel flush label={<Sig tone={sessions.length ? 'live' : 'idle'}>{sessions.length} live</Sig>}>
        <DataTable caption="Live sessions" columns={columns} rows={sessions} loading={isPending}
          empty={<Empty icon={Radio} title="No sessions are open">They appear here the moment a lecturer or the timetable opens one.</Empty>} />
      </Panel>

      <ConfirmDialog open={Boolean(closing)} onClose={() => setClosing(null)} onConfirm={forceClose} busy={busy} danger
        title={`Close ${closing?.class?.name ?? 'this session'} now?`} confirmLabel="Force close">
        Students who haven't scanned are marked absent and everyone is emailed their result, exactly as when the lecturer closes it. The close is recorded in the audit trail.
      </ConfirmDialog>
    </div>
  );
}
