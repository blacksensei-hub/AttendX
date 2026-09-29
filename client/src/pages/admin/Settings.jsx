// client/src/pages/admin/Settings.jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { consoleApi } from '../../services/consoleService';
import { ConsoleHead, Panel, PanelSkeleton } from '../../components/console/Panel';
import { Field, Switch, Select } from '../../components/console/controls';
import { fmtDateTime } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Policy settings: institution-wide defaults, in one place.
 *
 * The form is built from the schema the server sends (label, help,
 * limits), so a setting added on the server shows up here. Saving
 * sends only what changed; every change is recorded in the audit
 * trail with its before and after values.
 * ═════════════════════════════════════════════════════════════════
 */

const SECTIONS = [
  { title: 'Sessions and classes', label: 'Defaults', keys: ['session.late_threshold_min', 'session.qr_interval_sec', 'class.default_geofence_m', 'class.default_threshold_pct'],
    note: 'Used when a lecturer does not set their own. Existing classes and sessions keep their values.' },
  { title: 'Fraud checks', label: 'Trust', keys: ['fraud.geofence_attempts', 'fraud.device_mismatch_attempts', 'device.reset_limit_30d'],
    note: 'How many times a pattern repeats before it becomes a flag in the review queue. Flags never block anyone.' },
  { title: 'Weekly digest', label: 'Comms', keys: ['digest.enabled', 'digest.weekday', 'digest.hour'],
    note: 'A summary email to every active admin: attendance, students at risk, open flags.' },
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Settings() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['admin-settings'], queryFn: consoleApi.settings });
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const value = (k) => (k in draft ? draft[k] : data?.values?.[k]);
  const changed = Object.keys(draft).filter(k => draft[k] !== data?.values?.[k]);
  const set = (k) => (v) => setDraft(d => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await consoleApi.saveSettings(Object.fromEntries(changed.map(k => [k, draft[k]])));
      toast.success(r.message);
      setDraft({});
      qc.setQueryData(['admin-settings'], old => ({ ...old, values: r.values }));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const testDigest = async () => {
    setTesting(true);
    try { toast.success((await consoleApi.testDigest()).message); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not send the digest'); }
    finally { setTesting(false); }
  };

  const input = (k) => {
    const spec = data.schema[k];
    if (spec.type === 'bool') return <Switch checked={Boolean(value(k))} onChange={set(k)} label={spec.label} />;
    if (k === 'digest.weekday') return <Select label={spec.label} value={String(value(k))} onChange={v => set(k)(Number(v))} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} style={{ width: '100%' }} />;
    if (k === 'digest.hour') return <Select label={spec.label} value={String(value(k))} onChange={v => set(k)(Number(v))} options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }))} style={{ width: '100%' }} />;
    return (
      <input className="c-input tabular" type="number" min={spec.min} max={spec.max} step={1} value={value(k) ?? ''}
             onChange={e => set(k)(e.target.value === '' ? '' : Number(e.target.value))} />
    );
  };

  const invalid = changed.some(k => {
    const s = data?.schema?.[k];
    const v = draft[k];
    return s?.type === 'int' && (!Number.isInteger(v) || v < s.min || v > s.max);
  });

  return (
    <div className="c-page">
      <ConsoleHead
        kicker="System / Policy settings"
        title="Policy settings"
        lede="Institution-wide defaults. Every change is recorded in the audit trail."
        actions={(
          <>
            {changed.length > 0 && <button type="button" className="btn-ghost btn-sm" onClick={() => setDraft({})} disabled={saving}><RotateCcw size={14} /> Discard</button>}
            <button type="button" className="btn-accent btn-sm" onClick={save} disabled={!changed.length || invalid || saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save {changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'}` : ''}
            </button>
          </>
        )}
      />

      {isPending ? (
        <div className="c-grid">{[0, 1, 2].map(i => <PanelSkeleton key={i} className="span-12" lines={4} />)}</div>
      ) : data && (
        <div className="c-grid">
          {SECTIONS.map(sec => (
            <Panel key={sec.title} className="span-12" label={sec.label} title={sec.title}
              actions={sec.title === 'Weekly digest' && (
                <button type="button" className="btn-ghost btn-sm" onClick={testDigest} disabled={testing}>
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send me a test
                </button>
              )}>
              <p className="c-muted" style={{ fontSize: 13, marginTop: -6, marginBottom: 16 }}>
                {sec.note}
                {sec.title === 'Weekly digest' && data.digest?.lastSentAt && ` Last sent ${fmtDateTime(data.digest.lastSentAt)}.`}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 18 }}>
                {sec.keys.filter(k => data.schema[k]).map(k => {
                  const spec = data.schema[k];
                  const dirty = changed.includes(k);
                  return (
                    <Field key={k} label={<>{spec.label}{dirty && <span style={{ color: 'var(--brand-text)', marginLeft: 6 }}>●</span>}</>}
                           hint={spec.type === 'int' ? `${spec.help} ${spec.min} to ${spec.max}.`.trim() : spec.help}>
                      {input(k)}
                    </Field>
                  );
                })}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
