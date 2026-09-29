// client/src/pages/student/RequestsPage.jsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX2, Send, Loader2, Undo2, MessageSquareWarning, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

import PageShell, { PageHeader } from '../../components/layout/PageShell';
import StatusPill from '../../components/ui/StatusPill';
import { Panel, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Tabs, Field, Select } from '../../components/console/controls';
import { Drawer, ConfirmDialog } from '../../components/console/overlays';
import { meApi, EXCUSE_REASONS } from '../../services/teachingService';
import { classService } from '../../services/classService';
import api from '../../services/api';
import { timeAgo } from '../../components/console/format';
import { addDays, isoDay, fmtDay, fmtTime, plural } from '../../components/teaching/format';
import { classLabel } from '../../lib/names';

/**
 * ═════════════════════════════════════════════════════════════════
 * A student's requests.
 *
 *   Excused absences  ask for days you were (or will be) away to be
 *                     excused, with the reason and, if you have one, a
 *                     link to evidence. Choose several classes at once:
 *                     each goes to that class's lecturers. Approved
 *                     absences count towards the minimum.
 *   Appeals           records you disputed from your history, and
 *                     what your lecturer decided.
 *
 * ?new=1&class=<id>&date=YYYY-MM-DD opens the form filled in (links
 * from the timetable, the planner and history use this).
 * ═════════════════════════════════════════════════════════════════
 */

const blankForm = (classId, date) => ({
  classIds: classId ? [classId] : [],
  dateFrom: date ?? isoDay(),
  dateTo: date ?? isoDay(),
  reason: 'medical',
  note: '',
  evidenceUrl: '',
});

export default function StudentRequestsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('excuses');
  const [form, setForm] = useState(() => blankForm(params.get('class'), params.get('date')));
  const [composing, setComposing] = useState(params.get('new') === '1');
  const [withdraw, setWithdraw] = useState(null);

  // Opened from a link: start from its class and date, then clean the URL.
  useEffect(() => {
    if (params.get('new') === '1') setParams({}, { replace: true });
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const excuses = useQuery({ queryKey: ['my-excuses'], queryFn: meApi.excuses });
  const appeals = useQuery({ queryKey: ['my-appeals'], queryFn: () => api.get('/appeals/my').then(r => r.data) });
  const enrolled = useQuery({ queryKey: ['enrolled-classes'], queryFn: classService.getEnrolledClasses });
  const classes = useMemo(() => enrolled.data?.classes ?? [], [enrolled.data]);
  const requests = excuses.data?.requests ?? [];
  const appealList = appeals.data?.appeals ?? [];

  const send = useMutation({
    mutationFn: () => meApi.requestExcuse({ ...form, evidenceUrl: form.evidenceUrl.trim() || undefined }),
    onSuccess: (r) => {
      toast.success(r.message);
      setComposing(false);
      setForm(blankForm());
      qc.invalidateQueries({ queryKey: ['my-excuses'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not send it'),
  });
  const undo = useMutation({
    mutationFn: (id) => meApi.withdrawExcuse(id),
    onSuccess: (r) => { toast.success(r.message); setWithdraw(null); qc.invalidateQueries({ queryKey: ['my-excuses'] }); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not withdraw it'),
  });

  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const today = isoDay();
  const valid = form.classIds.length > 0 && form.dateFrom && form.dateTo >= form.dateFrom && form.note.trim().length >= 10;
  const waiting = requests.filter(r => r.status === 'pending').length;

  const excuseColumns = [
    { key: 'class', header: 'Class', sort: x => x.class?.code, render: x => <span><span className="cell-main">{x.class?.code}</span><span className="cell-sub">{x.class?.name}</span></span> },
    { key: 'range', header: 'Dates', sort: x => x.dateFrom, render: x => <span className="tabular" style={{ whiteSpace: 'nowrap' }}>{x.range}</span> },
    { key: 'reason', header: 'Reason', render: x => x.reasonLabel },
    { key: 'status', header: 'Status', render: x => <StatusPill status={x.status} showSweep={false} label={x.status === 'rejected' ? 'declined' : x.status === 'pending' ? 'waiting' : undefined} /> },
    { key: 'result', header: 'Outcome', render: x => (
      x.status === 'approved' ? <span className="c-subtle">{x.appliedCount ? `${plural(x.appliedCount, 'absence')} excused` : 'Approved'}{x.reviewer ? ` by ${x.reviewer.name}` : ''}</span>
        : x.status === 'rejected' ? <span className="c-subtle" title={x.reviewerNote}>{x.reviewerNote}</span>
          : x.status === 'pending' ? <span className="c-muted">Sent {timeAgo(x.createdAt)}</span> : <span className="c-muted">Withdrawn</span>
    ) },
    { key: 'act', header: '', num: true, render: x => (x.status === 'pending'
      ? <button type="button" className="btn-ghost btn-sm" onClick={() => setWithdraw(x)}><Undo2 size={13} /> Withdraw</button> : null) },
  ];
  const appealColumns = [
    { key: 'session', header: 'Session', sort: a => Date.parse(a.session?.open_at), render: a => (
      <span><span className="cell-main">{a.session?.class_name_snapshot}</span><span className="cell-sub">{fmtDay(a.session?.open_at, { weekday: 'short' })} · {fmtTime(a.session?.open_at)}</span></span>
    ) },
    { key: 'reason', header: 'What you said', render: a => <span className="c-subtle">{a.reason}</span> },
    { key: 'status', header: 'Status', render: a => <StatusPill status={a.status} showSweep={false} label={a.status === 'rejected' ? 'declined' : a.status === 'pending' ? 'waiting' : undefined} /> },
    { key: 'note', header: 'Lecturer\'s note', render: a => <span className="c-subtle">{a.lecturer_note ?? '–'}</span> },
  ];

  return (
    <PageShell>
      <PageHeader
        kicker="Student / Requests"
        title="Your"
        accent="requests."
        subtitle={waiting ? `${plural(waiting, 'request')} waiting for a lecturer.` : 'Ask for an absence to be excused, before or after the day, and follow your appeals.'}
        action={<button type="button" className="btn-primary" onClick={() => setComposing(true)}><CalendarX2 size={15} /> Excuse an absence</button>}
      />

      <Tabs label="Request type" value={tab} onChange={setTab} tabs={[
        { value: 'excuses', label: 'Excused absences', count: requests.length },
        { value: 'appeals', label: 'Appeals', count: appealList.length },
      ]} />

      <Panel flush>
        {tab === 'excuses' ? (
          <DataTable caption="Your excused-absence requests" columns={excuseColumns} rows={requests} loading={excuses.isPending}
            empty={<Empty icon={CalendarX2} title="No requests yet"
                          action={<button type="button" className="btn-accent btn-sm" onClick={() => setComposing(true)}>Excuse an absence</button>}>
              Ill, bereaved, away on university business? Ask here and your lecturer decides.
            </Empty>} />
        ) : (
          <DataTable caption="Your appeals" columns={appealColumns} rows={appealList} loading={appeals.isPending}
            empty={<Empty icon={MessageSquareWarning} title="No appeals">If a record is wrong, appeal it from your attendance history.</Empty>} />
        )}
      </Panel>

      <Drawer open={composing} onClose={() => setComposing(false)} label="Excused absence" title="Ask to excuse an absence"
              footer={(
                <>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setComposing(false)}>Cancel</button>
                  <button type="button" className="btn-accent btn-sm" disabled={!valid || send.isPending} onClick={() => send.mutate()}>
                    {send.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send to {form.classIds.length > 1 ? `${form.classIds.length} classes` : 'your lecturer'}
                  </button>
                </>
              )}>
        <div className="c-field">
          <span className="c-label">Classes</span>
          {classes.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {classes.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.classIds.includes(c.id)} style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                         onChange={e => set({ classIds: e.target.checked ? [...form.classIds, c.id] : form.classIds.filter(id => id !== c.id) })} />
                  {classLabel(c.code, c.name)}
                </label>
              ))}
            </div>
          ) : <span className="hint">You aren't in any classes yet.</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="From">
            <input className="c-input" type="date" value={form.dateFrom} min={addDays(today, -30)} max={addDays(today, 120)}
                   onChange={e => set({ dateFrom: e.target.value, dateTo: form.dateTo < e.target.value ? e.target.value : form.dateTo })} />
          </Field>
          <Field label="To">
            <input className="c-input" type="date" value={form.dateTo} min={form.dateFrom} max={form.dateFrom ? addDays(form.dateFrom, 30) : undefined}
                   onChange={e => set({ dateTo: e.target.value })} />
          </Field>
        </div>
        <Field label="Reason">
          <Select label="Reason" value={form.reason} onChange={v => set({ reason: v })} style={{ width: '100%' }}
                  options={Object.entries(EXCUSE_REASONS).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Explain briefly" hint={`${form.note.trim().length < 10 ? 'At least 10 characters. ' : ''}Your lecturer reads this.`}>
          <textarea className="c-textarea" value={form.note} maxLength={2000} onChange={e => set({ note: e.target.value })}
                    placeholder="e.g. I was admitted to the university clinic with malaria from Monday to Wednesday." style={{ minHeight: 110 }} />
        </Field>
        <Field label="Link to evidence (optional)" hint="A shared link to a medical note or letter, if you have one.">
          <input className="c-input" type="url" value={form.evidenceUrl} onChange={e => set({ evidenceUrl: e.target.value })} placeholder="https://" />
        </Field>
        {form.evidenceUrl && !/^https?:\/\//i.test(form.evidenceUrl) && (
          <p className="err" style={{ fontSize: 12, color: 'var(--red)' }}>Start the link with https://</p>
        )}
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Up to 31 days at a time, from 30 days ago to four months ahead. Approved absences count towards each class minimum.
          <Link className="link-row" style={{ marginLeft: 6, fontSize: 12.5 }} to="/student/history"><ExternalLink size={12} /> Your history</Link>
        </p>
      </Drawer>

      <ConfirmDialog open={Boolean(withdraw)} onClose={() => setWithdraw(null)} busy={undo.isPending}
                     title="Withdraw this request?" confirmLabel="Withdraw" onConfirm={() => undo.mutate(withdraw.id)}>
        {withdraw && `${withdraw.class?.code}, ${withdraw.range}. Your lecturer won't be asked to decide it. You can send a new one later.`}
      </ConfirmDialog>
    </PageShell>
  );
}
