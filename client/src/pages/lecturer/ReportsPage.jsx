// client/src/pages/lecturer/ReportsPage.jsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, Trash2, ClipboardList, Loader2, FileBarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';

import PageShell, { PageHeader } from '../../components/layout/PageShell';
import StatusPill from '../../components/ui/StatusPill';
import { Panel, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { SearchInput, Select } from '../../components/console/controls';
import { ConfirmDialog } from '../../components/console/overlays';
import RateMeter from '../../components/teaching/RateMeter';
import { download } from '../../services/consoleService';
import api from '../../services/api';
import { fmtDay, fmtTime, plural } from '../../components/teaching/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Reports: every session of every class the lecturer teaches.
 *
 * One table, newest first, 25 to a page, narrowed by class and by a
 * search on the session title. Each row shows the session's counts
 * and rate; a row opens the session's register, where records can be
 * adjusted with a reason. CSV and PDF export per session, or for a
 * whole class once one is chosen. Only a class's owner can delete a
 * session's report, and only once it has closed.
 * ═════════════════════════════════════════════════════════════════
 */

const PAGE = 25;

export default function ReportsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [classId, setClassId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data, isPending } = useQuery({
    queryKey: ['all-sessions'],
    queryFn: () => api.get('/reports/all-sessions').then(r => r.data),
  });
  const sessions = useMemo(() => data?.sessions ?? [], [data]);

  const classes = useMemo(() => {
    const m = new Map();
    sessions.forEach(s => { if (s.classId && !m.has(s.classId)) m.set(s.classId, { id: s.classId, name: s.className }); });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions
      .filter(s => classId === 'all' || s.classId === classId)
      .filter(s => !q || `${s.title ?? ''} ${s.className}`.toLowerCase().includes(q))
      .map(s => {
        const counted = s.present + s.late + (s.excused ?? 0);
        const absent = Math.max(0, s.total - counted);
        return { ...s, counted, absent, rate: s.status === 'closed' && s.total ? Math.round((counted / s.total) * 1000) / 10 : null };
      });
  }, [sessions, classId, search]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, totalPages);
  const visible = rows.slice((current - 1) * PAGE, current * PAGE);

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/reports/session/${id}`).then(r => r.data),
    onSuccess: (r) => { toast.success(r.message ?? 'Deleted'); setDeleting(null); qc.invalidateQueries({ queryKey: ['all-sessions'] }); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not delete it'),
  });

  const exportFile = async (key, type, params, name) => {
    setBusy(key);
    try { await download(`/reports/export/${type}`, `${name}.${type}`, params); }
    catch { toast.error('Export failed'); }
    finally { setBusy(null); }
  };
  const slug = (s) => String(s ?? 'attendance').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const chosen = classes.find(c => c.id === classId);

  const columns = [
    { key: 'date', header: 'Date', sort: s => Date.parse(s.openAt), render: s => (
      <span><span className="cell-main">{fmtDay(s.openAt, { weekday: 'short' })}</span><span className="cell-sub">{fmtTime(s.openAt)}</span></span>
    ) },
    { key: 'class', header: 'Class', sort: s => s.className, render: s => (
      <span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.className}</span><span className="cell-sub">{s.title || 'Attendance session'}</span></span>
    ) },
    { key: 'rate', header: 'Attendance', width: 190, sort: s => s.rate ?? -1, render: s => (s.status === 'open'
      ? <StatusPill status="live" label="Live" showSweep={false} />
      : <RateMeter rate={s.rate} threshold={75} />) },
    { key: 'present', header: 'Present', num: true, sort: s => s.present },
    { key: 'late', header: 'Late', num: true, sort: s => s.late },
    { key: 'excused', header: 'Excused', num: true, sort: s => s.excused ?? 0, render: s => s.excused ?? 0 },
    { key: 'absent', header: 'Absent', num: true, sort: s => s.absent, render: s => (s.status === 'open' ? <span className="c-muted">–</span> : s.absent) },
    { key: 'act', header: '', num: true, render: s => (
      <span className="c-actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }} onClick={e => e.stopPropagation()}>
        <button type="button" className="icon-btn" title="Download CSV" aria-label={`CSV for ${s.className}, ${fmtDay(s.openAt)}`}
                onClick={() => exportFile(`${s.id}csv`, 'csv', { sessionId: s.id }, `${slug(s.className)}-${s.openAt.slice(0, 10)}`)}>
          {busy === `${s.id}csv` ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
        </button>
        <button type="button" className="icon-btn" title="Download PDF" aria-label={`PDF for ${s.className}, ${fmtDay(s.openAt)}`}
                onClick={() => exportFile(`${s.id}pdf`, 'pdf', { sessionId: s.id }, `${slug(s.className)}-${s.openAt.slice(0, 10)}`)}>
          {busy === `${s.id}pdf` ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
        </button>
        {s.myRole === 'owner' && s.status === 'closed' && (
          <button type="button" className="icon-btn" title="Delete this report" aria-label={`Delete the report for ${s.className}, ${fmtDay(s.openAt)}`}
                  onClick={() => setDeleting(s)}>
            <Trash2 size={14} />
          </button>
        )}
      </span>
    ) },
  ];

  return (
    <PageShell>
      <PageHeader
        kicker="Lecturer / Reports"
        title="Every"
        accent="session."
        subtitle={isPending ? 'Loading your sessions…'
          : `${plural(sessions.length, 'session')} across ${plural(classes.length, 'class', 'classes')}. Open one for its register; change a record there, with a reason.`}
        action={chosen && (
          <>
            <button type="button" className="btn-ghost" disabled={busy === 'classcsv'}
                    onClick={() => exportFile('classcsv', 'csv', { classId: chosen.id }, slug(chosen.name))}>
              {busy === 'classcsv' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Class CSV
            </button>
            <button type="button" className="btn-ghost" disabled={busy === 'classpdf'}
                    onClick={() => exportFile('classpdf', 'pdf', { classId: chosen.id }, slug(chosen.name))}>
              {busy === 'classpdf' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Class PDF
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate(`/lecturer/classes/${chosen.id}?tab=grades`)}>
              <FileBarChart2 size={15} /> Grades
            </button>
          </>
        )}
      />

      <Panel flush>
        <div className="c-toolbar" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <Select label="Class" value={classId} onChange={v => { setClassId(v); setPage(1); }}
                  options={[{ value: 'all', label: `All classes (${sessions.length})` }, ...classes.map(c => ({ value: c.id, label: c.name }))]} />
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Session title or class" label="Search sessions" />
          <span className="c-muted tabular" style={{ marginLeft: 'auto', fontSize: 12.5 }}>{plural(rows.length, 'session')}</span>
        </div>
        <DataTable
          caption="Sessions"
          columns={columns}
          rows={visible}
          loading={isPending}
          onRowClick={s => navigate(s.status === 'open' ? `/lecturer/session/${s.id}` : `/lecturer/session/${s.id}/roster`)}
          page={current} totalPages={totalPages} total={rows.length} onPage={setPage}
          empty={<Empty icon={ClipboardList} title={search || classId !== 'all' ? 'No sessions match' : 'No sessions yet'}>
            {search || classId !== 'all' ? 'Try another class or search.' : 'Sessions you run appear here once they open.'}
          </Empty>}
        />
      </Panel>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        busy={remove.isPending}
        danger
        title="Delete this session's report?"
        confirmLabel="Delete report"
        onConfirm={() => remove.mutate(deleting.id)}
      >
        {deleting && `${deleting.className}, ${fmtDay(deleting.openAt, { weekday: 'long', year: 'numeric' })}. `}
        Its attendance records go with it, and every student's rate is worked out again without it. This can't be undone.
      </ConfirmDialog>
    </PageShell>
  );
}
