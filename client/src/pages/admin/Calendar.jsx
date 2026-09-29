// client/src/pages/admin/Calendar.jsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarPlus, Plus, Archive, Trash2, Loader2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

import { consoleApi } from '../../services/consoleService';
import { ConsoleHead, Panel, Sig, Empty } from '../../components/console/Panel';
import { Drawer, ConfirmDialog } from '../../components/console/overlays';
import { Field, Switch, Select } from '../../components/console/controls';

/**
 * ═════════════════════════════════════════════════════════════════
 * Academic calendar: semesters, and the days sessions don't happen.
 *
 * The month view shades each day by how many sessions opened on it
 * and marks holidays, breaks, exam periods and events. Periods set to
 * "no sessions" stop the timetable from auto-opening classes on those
 * days. The current semester is what reports and at-risk lists cover
 * by default.
 * ═════════════════════════════════════════════════════════════════
 */

const KINDS = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'break', label: 'Break' },
  { value: 'exam', label: 'Exam period' },
  { value: 'event', label: 'Event' },
];
const KIND_TONE = { holiday: 'red', break: 'brand', exam: 'amber', event: '' };
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const iso = (d) => d.toISOString().slice(0, 10);
const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shiftMonth = (m, by) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return iso(d).slice(0, 7);
};
const fmtDay = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function Calendar() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(iso(new Date()).slice(0, 7));
  const [editEvent, setEditEvent] = useState(params.get('new') === 'event' ? { kind: 'holiday', blocks_sessions: true } : null);
  const [editSemester, setEditSemester] = useState(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin-calendar', month],
    queryFn: () => consoleApi.calendar(month),
    placeholderData: keepPreviousData,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-calendar'] });

  const today = iso(new Date());
  const first = new Date(`${month}-01T00:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);

  const events = data?.events ?? [];
  const maxSessions = Math.max(1, ...Object.values(data?.sessionsByDay ?? {}));
  const current = data?.semesters?.find(s => s.id === data.currentSemesterId);
  const closeNew = () => { setEditEvent(null); if (params.get('new')) setParams({}, { replace: true }); };

  return (
    <div className="c-page">
      <ConsoleHead
        kicker={`Teaching / ${current ? current.name : 'No current semester'}`}
        title="Calendar"
        lede="Semesters set what reports cover by default. Holidays, breaks and exam periods marked 'no sessions' stop timetabled sessions from opening."
        actions={(
          <>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setEditSemester({})}><Plus size={15} /> Semester</button>
            <button type="button" className="btn-accent btn-sm" onClick={() => setEditEvent({ kind: 'holiday', blocks_sessions: true })}><CalendarPlus size={15} /> Holiday or period</button>
          </>
        )}
      />

      <div className="c-grid">
        <Panel className="span-8" label="Month" title={monthLabel(month)}
          actions={(
            <>
              <button type="button" className="icon-btn" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setMonth(today.slice(0, 7))}>Today</button>
              <button type="button" className="icon-btn" onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
            </>
          )}>
          <div role="grid" aria-label={monthLabel(month)} aria-busy={isPending}
               style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
            {DOW.map(d => <span key={d} className="c-label" role="columnheader" style={{ padding: '0 6px 6px' }}>{d}</span>)}
            {cells.map((day, i) => {
              if (!day) return <span key={`b${i}`} />;
              const n = data?.sessionsByDay?.[day] ?? 0;
              const dayEvents = events.filter(e => e.starts_on <= day && e.ends_on >= day);
              const blocked = dayEvents.some(e => e.blocks_sessions);
              return (
                <button key={day} type="button" role="gridcell"
                  onClick={() => setEditEvent({ kind: 'holiday', blocks_sessions: true, starts_on: day, ends_on: day })}
                  aria-label={`${fmtDay(day)}: ${n} session${n === 1 ? '' : 's'}${dayEvents.length ? `, ${dayEvents.map(e => e.title).join(', ')}` : ''}`}
                  style={{
                    minHeight: 84, padding: 7, textAlign: 'left', borderRadius: 10, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 4, font: 'inherit',
                    border: `1px solid ${day === today ? 'var(--brand)' : 'var(--border)'}`,
                    background: n ? `color-mix(in srgb, var(--brand) ${Math.round(6 + (n / maxSessions) * 18)}%, var(--bg-card))` : blocked ? 'var(--red-bg)' : 'var(--bg-card)',
                    transition: 'border-color var(--duration-fast) var(--ease-state)',
                  }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span className="tabular" style={{ fontWeight: day === today ? 700 : 500, color: day === today ? 'var(--brand-text)' : 'var(--text-primary)' }}>{Number(day.slice(8))}</span>
                    {n > 0 && <span className="tabular c-muted" style={{ fontSize: 11 }}>{n}</span>}
                  </span>
                  {dayEvents.slice(0, 2).map(e => (
                    <span key={e.id} className={`chip ${KIND_TONE[e.kind]}`}
                          style={{ fontSize: 10.5, padding: '1px 6px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', display: 'block' }}>
                      {e.title}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
          <p className="c-muted" style={{ fontSize: 12, marginTop: 12 }}>Shading: sessions opened that day. Click a day to mark it.</p>
        </Panel>

        <div className="span-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel label="Semesters" title={current ? `Now: ${current.name}` : 'No semester covers today'}>
            {!data?.semesters?.length ? (
              <Empty title="No semesters yet" action={<button type="button" className="btn-accent btn-sm" onClick={() => setEditSemester({})}>Add the current semester</button>}>
                Reports cover all time until one is added.
              </Empty>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.semesters.map(s => (
                  <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: s.is_archived ? 0.6 : 1 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{s.name} {s.id === data.currentSemesterId && <Sig tone="live">Current</Sig>}</p>
                      <p className="c-muted tabular" style={{ fontSize: 12 }}>{fmtDay(s.starts_on)} to {fmtDay(s.ends_on)}{s.is_archived ? ' · archived' : ''}</p>
                    </div>
                    <button type="button" className="icon-btn" onClick={() => setEditSemester(s)} aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel label="This month" title={events.length ? `${events.length} marked period${events.length === 1 ? '' : 's'}` : 'Nothing marked'}>
            {events.length === 0 ? (
              <p className="c-muted" style={{ fontSize: 13 }}>Every timetabled session this month runs as normal.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {events.map(e => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setEditEvent(e)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className={`chip ${KIND_TONE[e.kind]}`}>{KINDS.find(k => k.value === e.kind)?.label}</span>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{e.title}</span>
                      </span>
                      <span className="c-muted tabular" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                        {e.starts_on === e.ends_on ? fmtDay(e.starts_on) : `${fmtDay(e.starts_on)} to ${fmtDay(e.ends_on)}`}{e.blocks_sessions ? ' · no sessions' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <EventDrawer value={editEvent} onClose={closeNew} onSaved={() => { closeNew(); refresh(); }} />
      <SemesterDrawer value={editSemester} onClose={() => setEditSemester(null)} onSaved={() => { setEditSemester(null); refresh(); }} />
    </div>
  );
}

function useForm(value) {
  const [form, setForm] = useState(value ?? {});
  const [seen, setSeen] = useState(value);
  if (value !== seen) { setSeen(value); setForm(value ?? {}); }
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  return [form, set];
}

function EventDrawer({ value, onClose, onSaved }) {
  const [form, set] = useForm(value);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(value?.id);

  const save = async () => {
    setSaving(true);
    try {
      await consoleApi.saveEvent(value.id, { ...form, ends_on: form.ends_on || form.starts_on });
      toast.success(editing ? 'Saved' : 'Added to the calendar');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setSaving(true);
    try { await consoleApi.deleteEvent(value.id); toast.success('Removed'); setConfirmDelete(false); onSaved(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not remove'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Drawer open={Boolean(value)} onClose={onClose} label="Calendar" title={editing ? form.title || 'Edit period' : 'Mark a holiday or period'}
        footer={(
          <>
            {editing && <button type="button" className="btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Remove</button>}
            <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-accent btn-sm" onClick={save} disabled={saving || !form.title?.trim() || !form.starts_on}>
              {saving && <Loader2 size={14} className="animate-spin" />} {editing ? 'Save' : 'Add'}
            </button>
          </>
        )}>
        <Field label="Title"><input className="c-input" value={form.title ?? ''} maxLength={120} onChange={e => set('title')(e.target.value)} placeholder="e.g. Farmers' Day" autoFocus /></Field>
        <Field label="Type"><Select label="Type" value={form.kind ?? 'holiday'} onChange={set('kind')} options={KINDS} style={{ width: '100%' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="From"><input type="date" className="c-input" value={form.starts_on ?? ''} onChange={e => set('starts_on')(e.target.value)} /></Field>
          <Field label="To" hint="Leave as From for one day"><input type="date" className="c-input" value={form.ends_on ?? ''} min={form.starts_on} onChange={e => set('ends_on')(e.target.value)} /></Field>
        </div>
        <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
          <Switch checked={form.blocks_sessions ?? true} onChange={set('blocks_sessions')} label="No sessions" />
          <span style={{ fontSize: 14 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>No sessions on these days</span>
            <span className="c-muted" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>Timetabled sessions won't open automatically, and lecturers aren't counted as having missed them.</span>
          </span>
        </label>
        <Field label="Note (optional)"><textarea className="c-textarea" style={{ minHeight: 80 }} value={form.note ?? ''} onChange={e => set('note')(e.target.value)} /></Field>
      </Drawer>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} busy={saving} danger title={`Remove "${value?.title}"?`} confirmLabel="Remove">
        Timetabled sessions will run on these days again.
      </ConfirmDialog>
    </>
  );
}

function SemesterDrawer({ value, onClose, onSaved }) {
  const [form, set] = useForm(value);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(value?.id);

  const run = async (fn, ok) => {
    setSaving(true);
    try { await fn(); toast.success(ok); setConfirmDelete(false); onSaved(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Drawer open={Boolean(value)} onClose={onClose} label="Semester" title={editing ? value.name : 'Add a semester'}
        footer={(
          <>
            {editing && (
              <>
                <button type="button" className="btn-ghost btn-sm" onClick={() => run(() => consoleApi.archiveSemester(value.id), value.is_archived ? 'Restored' : 'Archived')} disabled={saving}>
                  <Archive size={14} /> {value.is_archived ? 'Restore' : 'Archive'}
                </button>
                <button type="button" className="btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</button>
              </>
            )}
            <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-accent btn-sm" disabled={saving || !form.name?.trim() || !form.starts_on || !form.ends_on}
                    onClick={() => run(() => consoleApi.saveSemester(value.id, { name: form.name, starts_on: form.starts_on, ends_on: form.ends_on }), 'Semester saved')}>
              {saving && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </>
        )}>
        <Field label="Name"><input className="c-input" value={form.name ?? ''} maxLength={80} onChange={e => set('name')(e.target.value)} placeholder="e.g. Semester 1, 2026/27" autoFocus /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Starts"><input type="date" className="c-input" value={form.starts_on ?? ''} onChange={e => set('starts_on')(e.target.value)} /></Field>
          <Field label="Ends"><input type="date" className="c-input" value={form.ends_on ?? ''} min={form.starts_on} onChange={e => set('ends_on')(e.target.value)} /></Field>
        </div>
        <p className="c-muted" style={{ fontSize: 12.5 }}>Semesters can't overlap. Archiving keeps a semester's data and reports; it just leaves the default pickers.</p>
      </Drawer>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} busy={saving} danger title={`Delete ${value?.name}?`} confirmLabel="Delete"
        onConfirm={() => run(() => consoleApi.deleteSemester(value.id), 'Semester deleted')}>
        Attendance data is not touched; only the semester's dates go. Archive it instead to keep it selectable in reports.
      </ConfirmDialog>
    </>
  );
}
