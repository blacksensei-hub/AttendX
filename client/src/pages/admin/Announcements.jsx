// client/src/pages/admin/Announcements.jsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Send, Clock, Trash2, Loader2, Bell, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

import { consoleApi } from '../../services/consoleService';
import { ConsoleHead, Panel, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Drawer, ConfirmDialog } from '../../components/console/overlays';
import { Field, Switch, Segmented, Select } from '../../components/console/controls';
import { timeAgo, fmtDateTime } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Announcements to any group: everyone, one role, one class (its
 * students and lecturer) or one department. In the app, by email, or
 * both; now or at a set time. Read receipts come from the in-app
 * notification being opened.
 * ═════════════════════════════════════════════════════════════════
 */

const STATUS_TONE = { draft: '', scheduled: 'brand', sending: 'amber', sent: 'green', failed: 'red' };
const EDITABLE = ['draft', 'scheduled', 'failed'];
const BLANK = { title: '', body: '', audience: 'all', audience_value: '', send_in_app: true, send_email: false, scheduled_for: null };

// datetime-local wants local "YYYY-MM-DDTHH:mm".
const toLocalInput = (d) => {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function Announcements() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  // ?new=1 opens the composer; &class=<id> aims it at that class.
  const [open, setOpen] = useState(() => {
    if (!params.get('new')) return null;
    const cls = params.get('class');
    return cls ? { ...BLANK, audience: 'class', audience_value: cls } : BLANK;
  });

  const { data, isPending } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: consoleApi.announcements,
    refetchInterval: (q) => (q.state.data?.announcements?.some(a => a.status === 'sending') ? 3000 : 30_000),
  });
  const list = data?.announcements ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-announcements'] });
  const close = () => { setOpen(null); if (params.get('new')) setParams({}, { replace: true }); };

  const columns = [
    { key: 'title', header: 'Announcement', render: a => <span><span className="cell-main">{a.title}</span><span className="cell-sub">{a.audienceLabel}</span></span> },
    { key: 'status', header: 'Status', render: a => <span className={`chip ${STATUS_TONE[a.status]}`}>{a.status}</span> },
    { key: 'channels', header: 'Via', render: a => (
      <span className="c-actions" style={{ gap: 6, color: 'var(--text-muted)' }}>
        {a.send_in_app && <Bell size={14} aria-label="In app" />}{a.send_email && <Mail size={14} aria-label="Email" />}
      </span>
    ) },
    { key: 'when', header: 'When', sort: a => new Date(a.sent_at ?? a.scheduled_for ?? a.created_at).getTime(), render: a => (
      <span className="c-subtle" title={fmtDateTime(a.sent_at ?? a.scheduled_for ?? a.created_at)}>
        {a.status === 'scheduled' ? `Due ${fmtDateTime(a.scheduled_for)}` : a.sent_at ? `Sent ${timeAgo(a.sent_at)}` : `Drafted ${timeAgo(a.created_at)}`}
      </span>
    ) },
    { key: 'read', header: 'Read', num: true, render: a => (a.status === 'sent' && a.send_in_app
      ? <span className="tabular">{a.read}<span className="c-muted"> / {a.delivered}</span></span>
      : <span className="c-muted">—</span>) },
  ];

  return (
    <div className="c-page">
      <ConsoleHead
        kicker="Comms / Announcements"
        title="Announcements"
        lede="Reach everyone, a role, a class or a department, in the app and by email. Read receipts show who has opened it."
        actions={<button type="button" className="btn-accent btn-sm" onClick={() => setOpen(BLANK)}><Plus size={15} /> New announcement</button>}
      />
      <Panel flush>
        <DataTable caption="Announcements" columns={columns} rows={list} loading={isPending} onRowClick={setOpen}
          empty={<Empty icon={Megaphone} title="No announcements yet" action={<button type="button" className="btn-accent btn-sm" onClick={() => setOpen(BLANK)}>Write the first one</button>}>
            Exam dates, timetable changes, campus closures: anything everyone should see.
          </Empty>} />
      </Panel>
      {open && (EDITABLE.includes(open.status ?? 'draft')
        ? <Composer value={open} onClose={close} onDone={() => { close(); refresh(); }} />
        : <SentDrawer value={open} onClose={close} />)}
    </div>
  );
}

function Composer({ value, onClose, onDone }) {
  const [form, setForm] = useState({ ...BLANK, ...value, audience_value: value.audience_value ?? '' });
  const [later, setLater] = useState(Boolean(value.scheduled_for));
  const [when, setWhen] = useState(value.scheduled_for ? toLocalInput(value.scheduled_for) : toLocalInput(Date.now() + 3600e3));
  const [count, setCount] = useState(null);
  const [working, setWorking] = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const { data: opts } = useQuery({ queryKey: ['admin-ann-options'], queryFn: consoleApi.annOptions, staleTime: 60_000 });

  // Live recipient count as the audience changes.
  useEffect(() => {
    if (form.audience !== 'all' && !form.audience_value) return undefined;
    let live = true;
    const t = setTimeout(() => {
      consoleApi.annCount(form.audience, form.audience_value).then(r => { if (live) setCount(r.recipients); }).catch(() => {});
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [form.audience, form.audience_value]);

  const payload = () => ({
    ...form,
    audience_value: form.audience === 'all' ? null : form.audience_value,
    scheduled_for: later ? new Date(when).toISOString() : null,
  });

  const save = async (andSend) => {
    setWorking(andSend ? 'send' : 'save');
    try {
      const r = await consoleApi.saveAnn(value.id, payload());
      if (andSend) {
        const sent = await consoleApi.sendAnn(r.announcement.id);
        toast.success(sent.message);
      } else {
        toast.success(r.message);
      }
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save');
    } finally {
      setWorking(null);
      setConfirmSend(false);
    }
  };
  const remove = async () => {
    setWorking('delete');
    try { await consoleApi.deleteAnn(value.id); toast.success('Deleted'); onDone(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not delete'); }
    finally { setWorking(null); }
  };

  const ready = form.title.trim() && form.body.trim() && (form.audience === 'all' || form.audience_value) && (form.send_in_app || form.send_email);
  const valueOptions = form.audience === 'role'
    ? [{ value: '', label: 'Choose a role' }, { value: 'student', label: 'Students' }, { value: 'lecturer', label: 'Lecturers' }, { value: 'admin', label: 'Admins' }]
    : form.audience === 'class'
      ? [{ value: '', label: 'Choose a class' }, ...(opts?.classes ?? []).map(c => ({ value: c.id, label: `${c.code} · ${c.name}` }))]
      : [{ value: '', label: 'Choose a department' }, ...(opts?.departments ?? []).map(d => ({ value: d, label: d }))];

  return (
    <>
      <Drawer open onClose={onClose} label={value.id ? `Announcement · ${value.status}` : 'New announcement'} title={form.title || 'Write an announcement'}
        footer={(
          <>
            {value.id && <button type="button" className="btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={remove} disabled={Boolean(working)}><Trash2 size={14} /> Delete</button>}
            <button type="button" className="btn-ghost btn-sm" onClick={() => save(false)} disabled={!ready || Boolean(working)}>
              {working === 'save' && <Loader2 size={14} className="animate-spin" />}{later ? <><Clock size={14} /> Schedule</> : 'Save draft'}
            </button>
            {!later && (
              <button type="button" className="btn-accent btn-sm" onClick={() => setConfirmSend(true)} disabled={!ready || Boolean(working)}>
                <Send size={14} /> Send now
              </button>
            )}
          </>
        )}>
        <Field label="Title"><input className="c-input" value={form.title} maxLength={150} onChange={e => set('title')(e.target.value)} placeholder="e.g. Mid-semester exams start 20 October" autoFocus /></Field>
        <Field label="Message" hint={`${form.body.length} characters. Line breaks are kept.`}>
          <textarea className="c-textarea" value={form.body} onChange={e => set('body')(e.target.value)} placeholder="What people need to know, and what to do about it." />
        </Field>

        <Field label="Who gets it">
          <Segmented label="Audience" value={form.audience} onChange={v => setForm(f => ({ ...f, audience: v, audience_value: '' }))}
            options={[{ value: 'all', label: 'Everyone' }, { value: 'role', label: 'A role' }, { value: 'class', label: 'A class' }, { value: 'department', label: 'A department' }]} />
        </Field>
        {form.audience !== 'all' && (
          <Select label="Group" value={form.audience_value} onChange={set('audience_value')} options={valueOptions} style={{ width: '100%' }} />
        )}
        <p className="c-subtle" style={{ fontSize: 13 }}>
          {count == null || (form.audience !== 'all' && !form.audience_value) ? 'Choose who it goes to.' : <><strong className="tabular" style={{ color: 'var(--text-primary)' }}>{count}</strong> {count === 1 ? 'person' : 'people'} with active accounts.</>}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
            <Switch checked={form.send_in_app} onChange={set('send_in_app')} label="In the app" /> In the app (with read receipts)
          </label>
          <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
            <Switch checked={form.send_email} onChange={set('send_email')} label="By email" /> By email
          </label>
          <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
            <Switch checked={later} onChange={setLater} label="Send later" /> Send later
          </label>
          {later && <input type="datetime-local" className="c-input" value={when} min={toLocalInput(Date.now() + 120e3)} onChange={e => setWhen(e.target.value)} aria-label="Send at" />}
        </div>

        {(form.title || form.body) && (
          <Panel label="Preview" title={form.title || 'Title'}>
            <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--text-subtle)' }}>{form.body || 'Message'}</p>
          </Panel>
        )}
      </Drawer>
      <ConfirmDialog open={confirmSend} onClose={() => setConfirmSend(false)} onConfirm={() => save(true)} busy={working === 'send'}
        title={`Send to ${count ?? '…'} ${count === 1 ? 'person' : 'people'}?`} confirmLabel="Send now">
        {form.send_email ? 'It goes out in the app and by email straight away.' : 'It appears in their notifications straight away.'} Sent announcements can't be edited or recalled.
      </ConfirmDialog>
    </>
  );
}

function SentDrawer({ value, onClose }) {
  const { data, isPending } = useQuery({ queryKey: ['admin-ann-receipts', value.id], queryFn: () => consoleApi.annReceipts(value.id) });
  const receipts = data?.receipts ?? [];
  const read = receipts.filter(r => r.read_at).length;
  return (
    <Drawer open onClose={onClose} label={`${value.status} · ${value.audienceLabel}`} title={value.title}>
      <dl className="dl">
        <dt>Sent</dt><dd>{fmtDateTime(value.sent_at)}</dd>
        <dt>Recipients</dt><dd className="tabular">{value.recipient_count}</dd>
        <dt>Via</dt><dd>{[value.send_in_app && 'In the app', value.send_email && 'Email'].filter(Boolean).join(' and ')}</dd>
        {value.author && (<><dt>By</dt><dd>{value.author.name}</dd></>)}
      </dl>
      <Panel label="Message"><p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{value.body}</p></Panel>
      {value.send_in_app && (
        <Panel label="Read receipts" title={isPending ? 'Loading…' : `${read} of ${receipts.length} have read it`} flush>
          <div className="barlist-track" style={{ margin: '0 18px 12px' }}>
            <div className="barlist-fill good" style={{ width: `${receipts.length ? (read / receipts.length) * 100 : 0}%` }} />
          </div>
          <table className="dt">
            <tbody>
              {receipts.slice(0, 200).map(r => (
                <tr key={r.user_id}>
                  <td><span className="cell-main">{r.user?.name ?? 'Deleted user'}</span><span className="cell-sub">{r.user?.role}</span></td>
                  <td className="num">{r.read_at ? <span className="c-subtle">{timeAgo(r.read_at)}</span> : <span className="c-muted">Not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </Drawer>
  );
}
