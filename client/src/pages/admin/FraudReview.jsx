// client/src/pages/admin/FraudReview.jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ScanSearch, Loader2, UserX, CircleSlash, BellRing, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';

import { consoleApi } from '../../services/consoleService';
import { ConsoleHead, Panel, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Drawer } from '../../components/console/overlays';
import { Tabs, Field } from '../../components/console/controls';
import { timeAgo, fmtDateTime } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Fraud review: patterns the server flagged, waiting for a person.
 *
 * Nothing here was blocked automatically; the scan and sign-in checks
 * that block are separate. A flag is evidence. The admin reads it and
 * decides: dismiss, warn the student, mark the session absent, or
 * deactivate the account. Every decision lands in the audit trail.
 * ═════════════════════════════════════════════════════════════════
 */

const SEVERITY = { high: 'red', medium: 'amber', low: '' };
const RESOLUTION = {
  dismissed: 'Dismissed', warned: 'Student warned', marked_absent: 'Marked absent', deactivated: 'Account deactivated',
};

function who(flag) {
  if (flag.user) return flag.user.name;
  const n = flag.evidence?.students?.length ?? 0;
  return n ? `${n} students` : '—';
}

export default function FraudReview() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');
  const [openId, setOpenId] = useState(null);
  const [sweeping, setSweeping] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['admin-fraud', status],
    queryFn: () => consoleApi.fraud({ status }),
    refetchInterval: status === 'open' ? 30_000 : false,
  });
  const flags = data?.flags ?? [];
  const kinds = data?.kinds ?? {};
  const counts = data?.counts ?? { open: 0, actioned: 0, dismissed: 0 };
  const current = flags.find(f => f.id === openId) ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-fraud'] });
    qc.invalidateQueries({ queryKey: ['admin-flag-count'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const sweep = async () => {
    setSweeping(true);
    try { toast.success((await consoleApi.sweepFraud()).message); refresh(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Sweep failed'); }
    finally { setSweeping(false); }
  };

  const columns = [
    { key: 'severity', header: 'Level', width: 90, sort: f => ({ high: 0, medium: 1, low: 2 }[f.severity]), render: f => <span className={`chip ${SEVERITY[f.severity]}`}>{f.severity}</span> },
    { key: 'kind', header: 'Pattern', render: f => (
      <span><span className="cell-main">{kinds[f.kind]?.label ?? f.kind}</span><span className="cell-sub">{f.summary}</span></span>
    ) },
    { key: 'who', header: 'Who', render: f => <span className="c-subtle">{who(f)}</span> },
    { key: 'where', header: 'Session', render: f => (f.session
      ? <span><span className="c-subtle">{f.session.class_name_snapshot ?? f.session.title}</span><span className="cell-sub">{fmtDateTime(f.session.open_at)}</span></span>
      : <span className="c-muted">Sign-in or account</span>) },
    status === 'open'
      ? { key: 'when', header: 'Raised', sort: f => new Date(f.created_at).getTime(), render: f => <span className="c-muted" title={fmtDateTime(f.created_at)}>{timeAgo(f.created_at)}</span> }
      : { key: 'res', header: 'Outcome', render: f => <span><span className="c-subtle">{RESOLUTION[f.resolution] ?? f.resolution}</span><span className="cell-sub">{f.reviewer?.name ?? ''} · {timeAgo(f.reviewed_at)}</span></span> },
  ];

  return (
    <div className="c-page">
      <ConsoleHead
        kicker="Trust / Fraud review"
        title="Fraud review"
        lede="Patterns worth a second look: several students on one phone, scans from outside the room, spoofed locations, repeated wrong-phone sign-ins. Flags never block anyone; you decide."
        actions={<button type="button" className="btn-ghost btn-sm" onClick={sweep} disabled={sweeping}>{sweeping ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={15} />} Run checks now</button>}
      />

      <Panel flush>
        <div style={{ padding: '6px 14px 0' }}>
          <Tabs label="Flag status" value={status} onChange={v => { setStatus(v); setOpenId(null); }} tabs={[
            { value: 'open', label: 'To review', count: counts.open },
            { value: 'actioned', label: 'Actioned', count: counts.actioned },
            { value: 'dismissed', label: 'Dismissed', count: counts.dismissed },
          ]} />
        </div>
        <DataTable
          caption="Fraud flags"
          columns={columns}
          rows={flags}
          loading={isPending}
          onRowClick={f => setOpenId(f.id)}
          empty={status === 'open'
            ? <Empty icon={ShieldCheck} title="Nothing to review">When a pattern shows up in scans or sign-ins, it is flagged here with the evidence.</Empty>
            : <Empty title="None yet" />}
        />
      </Panel>

      <FlagDrawer flag={current} kinds={kinds} onClose={() => setOpenId(null)} onDone={() => { setOpenId(null); refresh(); }} />
    </div>
  );
}

function FlagDrawer({ flag, kinds, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(null);
  const [shownId, setShownId] = useState(flag?.id);
  if (flag && flag.id !== shownId) { setShownId(flag.id); setNote(''); }

  const review = async (action) => {
    setWorking(action);
    try {
      const r = await consoleApi.reviewFlag(flag.id, { action, note: note.trim() });
      toast.success(action === 'dismiss' ? 'Dismissed' : `Done: ${r.affected} student${r.affected === 1 ? '' : 's'}`);
      onDone();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not complete the review');
    } finally {
      setWorking(null);
    }
  };

  const ev = flag?.evidence ?? {};
  const students = ev.students ?? (flag?.user ? [{ id: flag.user.id, name: flag.user.name, studentId_display: flag.user.student_id }] : []);
  const open = flag?.status === 'open';

  return (
    <Drawer open={Boolean(flag)} onClose={onClose}
      label={flag ? `${flag.severity} · raised ${timeAgo(flag.created_at)}` : ''}
      title={flag ? (kinds[flag.kind]?.label ?? flag.kind) : ''}
      footer={flag && open && (
        <>
          <button type="button" className="btn-ghost btn-sm" disabled={Boolean(working)} onClick={() => review('dismiss')}>
            {working === 'dismiss' ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Dismiss
          </button>
          <button type="button" className="btn-ghost btn-sm" disabled={Boolean(working)} onClick={() => review('warn')}>
            {working === 'warn' ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} Warn
          </button>
          {flag.session_id && (
            <button type="button" className="btn-ghost btn-sm" disabled={Boolean(working)} onClick={() => review('mark_absent')}>
              {working === 'mark_absent' ? <Loader2 size={14} className="animate-spin" /> : <CircleSlash size={14} />} Mark absent
            </button>
          )}
          <button type="button" className="btn-danger btn-sm" disabled={Boolean(working)} onClick={() => review('deactivate')}>
            {working === 'deactivate' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />} Deactivate
          </button>
        </>
      )}>
      {flag && (
        <>
          <p style={{ fontSize: 15, color: 'var(--text-primary)' }}>{flag.summary}</p>
          <dl className="dl">
            {flag.session && (<><dt>Session</dt><dd>{flag.session.class_name_snapshot ?? flag.session.title}, {fmtDateTime(flag.session.open_at)}</dd></>)}
            {ev.deviceId && (<><dt>Phone ID</dt><dd className="tabular" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{ev.deviceId}</dd></>)}
            {ev.lastDeviceId && (<><dt>Other phone</dt><dd style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{ev.lastDeviceId}</dd></>)}
            {ev.attempts != null && (<><dt>Attempts</dt><dd className="tabular">{ev.attempts}</dd></>)}
            {ev.lastDistanceM != null && (<><dt>Distance</dt><dd className="tabular">{ev.lastDistanceM.toLocaleString()} m from the room</dd></>)}
            {ev.resets != null && (<><dt>Phone resets</dt><dd className="tabular">{ev.resets} in 30 days (policy {ev.limit})</dd></>)}
            {ev.lat != null && (<><dt>Position</dt><dd className="tabular">{ev.lat.toFixed(6)}, {ev.lng.toFixed(6)}</dd></>)}
          </dl>

          {students.length > 0 && (
            <Panel label={students.length === 1 ? 'Student' : `${students.length} students`}>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {students.map(s => (
                  <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                    <span className="tabular c-muted">{s.studentId_display || ''}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {open ? (
            <Field label="Note for the record (optional)" hint="Saved with the decision and shown in the audit trail.">
              <textarea className="c-textarea" style={{ minHeight: 80 }} value={note} maxLength={2000} onChange={e => setNote(e.target.value)}
                        placeholder="e.g. Spoke to the student; the phone was shared for a good reason." />
            </Field>
          ) : (
            <Panel label="Decision" title={RESOLUTION[flag.resolution] ?? flag.resolution}>
              <p className="c-muted" style={{ fontSize: 13 }}>{flag.reviewer?.name ?? 'An admin'}, {fmtDateTime(flag.reviewed_at)}</p>
              {flag.resolution_note && <p style={{ marginTop: 8, fontSize: 14 }}>{flag.resolution_note}</p>}
            </Panel>
          )}
        </>
      )}
    </Drawer>
  );
}
