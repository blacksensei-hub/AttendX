// client/src/pages/lecturer/RequestsPage.jsx
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Loader2, Trash2, ExternalLink, Inbox, CalendarX2, MessageSquareWarning } from 'lucide-react';
import toast from 'react-hot-toast';

import PageShell, { PageHeader } from '../../components/layout/PageShell';
import StatusPill from '../../components/ui/StatusPill';
import { Panel, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Tabs, Segmented, Field } from '../../components/console/controls';
import { Drawer, ConfirmDialog } from '../../components/console/overlays';
import { teachingApi } from '../../services/teachingService';
import api from '../../services/api';
import { timeAgo } from '../../components/console/format';
import { fmtDay, fmtTime, plural } from '../../components/teaching/format';
import { classLabel } from '../../lib/names';

/**
 * ═════════════════════════════════════════════════════════════════
 * Requests from students, in one place.
 *
 *   Appeals            "I was there": the student disputes a record.
 *                      Approving marks them present or late.
 *   Excused absences   "I couldn't be there, here's why": approving
 *                      turns absences in the date range into excused,
 *                      and future sessions in it record excused at
 *                      close. Declining needs a reason for the student.
 *
 * Each request opens in a side panel with everything needed to decide.
 * The owner and co-lecturers of a class review its requests.
 * ═════════════════════════════════════════════════════════════════
 */

const STATUS_FILTERS = (list) => [
  { value: 'pending', label: 'Waiting', count: list.filter(r => r.status === 'pending').length },
  { value: 'approved', label: 'Approved', count: list.filter(r => r.status === 'approved').length },
  { value: 'rejected', label: 'Declined', count: list.filter(r => r.status === 'rejected').length },
  { value: 'all', label: 'All', count: list.length },
];

export default function RequestsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'excuses' ? 'excuses' : 'appeals';
  const setTab = (t) => setParams(t === 'appeals' ? {} : { tab: t }, { replace: true });
  const [status, setStatus] = useState('pending');
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const appeals = useQuery({ queryKey: ['lecturer-appeals'], queryFn: () => api.get('/appeals/lecturer').then(r => r.data), refetchInterval: 30_000 });
  const excuses = useQuery({ queryKey: ['lecturer-excuses'], queryFn: () => teachingApi.excuses('all'), refetchInterval: 30_000 });
  const appealList = useMemo(() => appeals.data?.appeals ?? [], [appeals.data]);
  const excuseList = useMemo(() => excuses.data?.requests ?? [], [excuses.data]);
  const list = tab === 'appeals' ? appealList : excuseList;
  const rows = status === 'all' ? list : list.filter(r => r.status === status);
  const waiting = { appeals: appealList.filter(a => a.status === 'pending').length, excuses: excuseList.filter(x => x.status === 'pending').length };

  const refresh = () => {
    ['lecturer-appeals', 'lecturer-appeals-count', 'lecturer-excuses', 'lecturer-excuse-count', 'class-hub', 'class-roster', 'class-student']
      .forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };
  const close = () => { setOpen(null); setNote(''); };

  const reviewAppeal = useMutation({
    mutationFn: ({ id, decision, status: st }) => api.put(`/appeals/${id}/review`, { decision, status: st, lecturer_note: note.trim() || undefined }),
    onSuccess: (_, v) => { toast.success(v.decision === 'approved' ? `Approved, marked ${v.status}` : 'Appeal declined'); refresh(); close(); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not save the decision'),
  });
  const reviewExcuse = useMutation({
    mutationFn: ({ id, decision }) => teachingApi.reviewExcuse(id, decision, note.trim()),
    onSuccess: (r) => { toast.success(r.message); refresh(); close(); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not save the decision'),
  });
  const deleteAll = useMutation({
    mutationFn: () => api.delete('/appeals/lecturer/all').then(r => r.data),
    onSuccess: (r) => { toast.success(r.message ?? 'Appeals deleted'); refresh(); setConfirmDeleteAll(false); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not delete them'),
  });

  const appealColumns = [
    { key: 'student', header: 'Student', sort: a => a.student?.name, render: a => (
      <span><span className="cell-main">{a.student?.name}</span><span className="cell-sub">{a.student?.student_id ?? a.student?.email}</span></span>
    ) },
    { key: 'session', header: 'Session', sort: a => Date.parse(a.session?.open_at), render: a => (
      <span><span style={{ color: 'var(--text-primary)' }}>{a.session?.class_name_snapshot}</span><span className="cell-sub">{fmtDay(a.session?.open_at, { weekday: 'short' })} · {fmtTime(a.session?.open_at)}</span></span>
    ) },
    { key: 'reason', header: 'Their reason', render: a => <span className="c-subtle" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 360 }}>{a.reason}</span> },
    { key: 'status', header: 'Status', render: a => <StatusPill status={a.status} showSweep={false} /> },
    { key: 'when', header: 'Sent', num: true, sort: a => Date.parse(a.created_at), render: a => <span className="c-muted">{timeAgo(a.created_at)}</span> },
  ];
  const excuseColumns = [
    { key: 'student', header: 'Student', sort: x => x.student?.name, render: x => (
      <span><span className="cell-main">{x.student?.name}</span><span className="cell-sub">{x.student?.studentNumber ?? x.student?.email}</span></span>
    ) },
    { key: 'class', header: 'Class', sort: x => x.class?.code, render: x => <span><span style={{ color: 'var(--text-primary)' }}>{x.class?.code}</span><span className="cell-sub">{x.class?.name}</span></span> },
    { key: 'range', header: 'Dates', sort: x => x.dateFrom, render: x => <span className="tabular" style={{ whiteSpace: 'nowrap' }}>{x.range}</span> },
    { key: 'reason', header: 'Reason', render: x => x.reasonLabel },
    { key: 'effect', header: 'Absences', num: true, render: x => (x.status === 'pending'
      ? <span className="tabular">{x.sessions?.filter(s => s.status === 'absent').length ?? 0}</span>
      : x.status === 'approved' ? <span className="tabular c-muted">{x.appliedCount} changed</span> : <span className="c-muted">–</span>) },
    { key: 'status', header: 'Status', render: x => <StatusPill status={x.status} showSweep={false} label={x.status === 'rejected' ? 'declined' : undefined} /> },
    { key: 'when', header: 'Sent', num: true, sort: x => Date.parse(x.createdAt), render: x => <span className="c-muted">{timeAgo(x.createdAt)}</span> },
  ];

  const loading = tab === 'appeals' ? appeals.isPending : excuses.isPending;
  const total = waiting.appeals + waiting.excuses;

  return (
    <PageShell>
      <PageHeader
        kicker="Lecturer / Requests"
        title={total ? `${total} to` : 'All caught'}
        accent={total ? 'review.' : 'up.'}
        subtitle={total
          ? `${plural(waiting.appeals, 'appeal')} and ${plural(waiting.excuses, 'excused-absence request')} waiting for you.`
          : 'No appeals or excuse requests are waiting. New ones also arrive by email.'}
      />

      <Tabs label="Request type" value={tab} onChange={(t) => { setTab(t); setStatus('pending'); }} tabs={[
        { value: 'appeals', label: 'Appeals', count: waiting.appeals },
        { value: 'excuses', label: 'Excused absences', count: waiting.excuses },
      ]} />

      <Panel flush>
        <div className="c-toolbar" style={{ padding: 14, borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
          <Segmented label="Status" value={status} onChange={setStatus} options={STATUS_FILTERS(list)} />
          {tab === 'appeals' && appealList.length > 0 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmDeleteAll(true)}><Trash2 size={13} /> Clear appeal history</button>
          )}
        </div>
        <DataTable
          caption={tab === 'appeals' ? 'Appeals' : 'Excused-absence requests'}
          columns={tab === 'appeals' ? appealColumns : excuseColumns}
          rows={rows}
          loading={loading}
          onRowClick={r => { setOpen({ kind: tab, item: r }); setNote(''); }}
          empty={<Empty icon={tab === 'appeals' ? MessageSquareWarning : CalendarX2}
                        title={status === 'pending' ? 'Nothing waiting' : 'None here'}>
            {tab === 'appeals'
              ? 'Students appeal a record from their history when they believe they were marked wrongly.'
              : 'Students ask for an absence to be excused from their Requests page, before or after the day.'}
          </Empty>}
        />
      </Panel>

      {/* ── Review panel ──────────────────────────────────────── */}
      <Drawer open={Boolean(open)} onClose={close} wide
              label={open?.kind === 'appeals' ? 'Appeal' : 'Excused absence'}
              title={open?.item.student?.name}
              footer={open?.item.status === 'pending' && (open.kind === 'appeals' ? (
                <>
                  <button type="button" className="btn-ghost btn-sm" disabled={reviewAppeal.isPending}
                          onClick={() => reviewAppeal.mutate({ id: open.item.id, decision: 'rejected' })}><X size={14} /> Decline</button>
                  <button type="button" className="btn-ghost btn-sm" disabled={reviewAppeal.isPending}
                          onClick={() => reviewAppeal.mutate({ id: open.item.id, decision: 'approved', status: 'late' })}><Check size={14} /> Approve as late</button>
                  <button type="button" className="btn-accent btn-sm" disabled={reviewAppeal.isPending}
                          onClick={() => reviewAppeal.mutate({ id: open.item.id, decision: 'approved', status: 'present' })}>
                    {reviewAppeal.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve as present
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-ghost btn-sm" disabled={reviewExcuse.isPending || !note.trim()}
                          title={note.trim() ? undefined : 'Add a note for the student first'}
                          onClick={() => reviewExcuse.mutate({ id: open.item.id, decision: 'rejected' })}><X size={14} /> Decline</button>
                  <button type="button" className="btn-accent btn-sm" disabled={reviewExcuse.isPending}
                          onClick={() => reviewExcuse.mutate({ id: open.item.id, decision: 'approved' })}>
                    {reviewExcuse.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Excuse {open.item.range}
                  </button>
                </>
              ))}>
        {open?.kind === 'appeals' && <AppealDetail a={open.item} />}
        {open?.kind === 'excuses' && <ExcuseDetail x={open.item} />}
        {open?.item.status === 'pending' && (
          <Field label={open.kind === 'excuses' ? 'Note to the student' : 'Note to the student (optional)'}
                 hint={open.kind === 'excuses' ? 'Required when declining; they see it in the app and by email.' : 'They see it in the email about your decision.'}>
            <textarea className="c-textarea" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} style={{ minHeight: 90 }} />
          </Field>
        )}
      </Drawer>

      <ConfirmDialog open={confirmDeleteAll} onClose={() => setConfirmDeleteAll(false)} busy={deleteAll.isPending} danger
                     title={`Delete all ${appealList.length} appeals?`} confirmLabel="Delete appeals"
                     onConfirm={() => deleteAll.mutate()}>
        Removes every appeal in classes you own, decided or not. Students no longer see them. Attendance already
        changed by an approval stays as it is. This can't be undone.
      </ConfirmDialog>
    </PageShell>
  );
}

function AppealDetail({ a }) {
  return (
    <>
      <dl className="dl">
        <dt>Student</dt><dd>{a.student?.name}<span className="c-muted"> · {a.student?.student_id ?? a.student?.email}</span></dd>
        <dt>Class</dt><dd>{a.session?.class_name_snapshot}</dd>
        <dt>Session</dt><dd>{a.session?.title || 'Attendance session'}, {fmtDay(a.session?.open_at, { weekday: 'long', year: 'numeric' })} at {fmtTime(a.session?.open_at)}</dd>
        <dt>Sent</dt><dd>{timeAgo(a.created_at)}</dd>
        <dt>Status</dt><dd><StatusPill status={a.status} showSweep={false} /></dd>
      </dl>
      <Quote label="What they say">{a.reason}</Quote>
      {a.lecturer_note && <Quote label="Your note">{a.lecturer_note}</Quote>}
      {a.session?.class_id && (
        <Link className="link-row" to={`/lecturer/classes/${a.session.class_id}/students/${a.student?.id}`}>
          <Inbox size={14} /> Their whole register for this class
        </Link>
      )}
    </>
  );
}

function ExcuseDetail({ x }) {
  const absences = (x.sessions ?? []).filter(s => s.status === 'absent').length;
  return (
    <>
      <dl className="dl">
        <dt>Student</dt><dd>{x.student?.name}<span className="c-muted"> · {x.student?.studentNumber ?? x.student?.email}</span></dd>
        <dt>Class</dt><dd>{classLabel(x.class?.code, x.class?.name)}</dd>
        <dt>Dates</dt><dd>{x.range}</dd>
        <dt>Reason</dt><dd>{x.reasonLabel}</dd>
        <dt>Sent</dt><dd>{timeAgo(x.createdAt)}</dd>
        {x.reviewer && <><dt>Decided by</dt><dd>{x.reviewer.name}{x.appliedCount ? `, ${plural(x.appliedCount, 'record')} changed` : ''}</dd></>}
      </dl>
      <Quote label="Their explanation">{x.note}</Quote>
      {x.evidenceUrl && (
        <a className="link-row" href={x.evidenceUrl} target="_blank" rel="noreferrer noopener"><ExternalLink size={14} /> Open the evidence they linked</a>
      )}
      {x.reviewerNote && <Quote label="Note to the student">{x.reviewerNote}</Quote>}
      {x.status === 'pending' && (
        <div>
          <p className="c-label" style={{ marginBottom: 8 }}>If you excuse it</p>
          {x.sessions?.length ? (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {x.sessions.map(s => (
                <li key={s.sessionId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                  <span>{fmtDay(s.openAt, { weekday: 'short' })} · {fmtTime(s.openAt)}</span>
                  {s.status === 'absent'
                    ? <span><StatusPill status="absent" showSweep={false} /> → <StatusPill status="excused" showSweep={false} /></span>
                    : <StatusPill status={s.status} showSweep={false} />}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="c-muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            {absences ? `${plural(absences, 'absence')} become excused. ` : 'No recorded absences yet. '}
            Sessions that close later in these dates record them as excused.
          </p>
        </div>
      )}
    </>
  );
}

function Quote({ label, children }) {
  return (
    <div>
      <p className="c-label" style={{ marginBottom: 6 }}>{label}</p>
      <blockquote style={{
        margin: 0, padding: '12px 14px', borderLeft: '3px solid var(--brand)', borderRadius: '0 10px 10px 0',
        background: 'var(--bg-raised)', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      }}>{children}</blockquote>
    </div>
  );
}
