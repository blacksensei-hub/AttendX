// client/src/components/teaching/CalendarFeed.jsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Copy, Check, Download, RefreshCw, Link2Off, BellRing, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Panel } from '../console/Panel';
import { Segmented } from '../console/controls';
import { ConfirmDialog } from '../console/overlays';
import { meApi } from '../../services/teachingService';

/**
 * ═════════════════════════════════════════════════════════════════
 * Timetable in your own calendar, and (for students) class reminders.
 *
 * The private link is an iCalendar feed: Google, Apple and Outlook
 * calendars subscribe to it and pick up timetable changes, holidays
 * and exam periods by themselves. Anyone with the link can read the
 * timetable, so it can be replaced (the old one stops working) or
 * turned off. A one-off .ics download is there for calendars that
 * don't subscribe.
 * ═════════════════════════════════════════════════════════════════
 */

const REMINDER_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '10', label: '10 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
];

export default function CalendarFeed({ who = 'student' }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(null);   // 'rotate' | 'off'
  const { data } = useQuery({ queryKey: ['me-preferences'], queryFn: meApi.preferences });
  const url = data?.calendarUrl ?? null;
  const webcal = url?.replace(/^https?:/, 'webcal:');

  const set = (patch) => qc.setQueryData(['me-preferences'], old => ({ ...old, ...patch }));
  const reminders = useMutation({
    mutationFn: (m) => meApi.savePreferences(m),
    onSuccess: (r) => { set({ reminderMinutes: r.reminderMinutes }); toast.success(r.message); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not save'),
  });
  const make = useMutation({
    mutationFn: meApi.makeFeed,
    onSuccess: (r) => { set({ calendarUrl: r.calendarUrl }); toast.success(r.message); setConfirm(null); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not make a link'),
  });
  const off = useMutation({
    mutationFn: meApi.removeFeed,
    onSuccess: (r) => { set({ calendarUrl: null }); toast.success(r.message); setConfirm(null); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not turn it off'),
  });

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast.error('Copy the link from the box instead'); }
  };

  return (
    <div className={who === 'student' ? 'split' : undefined}>
      <Panel label="In your own calendar" title="Subscribe to this timetable">
        <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)', lineHeight: 1.55, maxWidth: '62ch' }}>
          A private link your calendar app follows. Classes, holidays and exam periods stay up to date on their own,
          usually within a few hours of a change.
        </p>
        {url ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="c-input" readOnly value={url} aria-label="Private calendar link" onFocus={e => e.target.select()}
                     style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }} />
              <button type="button" className="icon-btn" onClick={copy} aria-label={copied ? 'Copied' : 'Copy link'} style={{ width: 40, height: 40, flexShrink: 0 }}>
                {copied ? <Check size={15} style={{ color: 'var(--green)' }} /> : <Copy size={15} />}
              </button>
            </div>
            <div className="c-actions">
              <a className="btn-accent btn-sm" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer">
                <CalendarPlus size={14} /> Google Calendar
              </a>
              <a className="btn-ghost btn-sm" href={webcal}><CalendarPlus size={14} /> Apple or Outlook</a>
              <button type="button" className="btn-ghost btn-sm" onClick={() => meApi.downloadIcs().catch(() => toast.error('Download failed'))}><Download size={14} /> .ics file</button>
            </div>
            <div className="c-actions" style={{ fontSize: 12.5 }}>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm('rotate')}><RefreshCw size={13} /> New link</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm('off')}><Link2Off size={13} /> Turn off</button>
            </div>
          </div>
        ) : (
          <div className="c-actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn-accent btn-sm" onClick={() => make.mutate()} disabled={make.isPending}>
              {make.isPending ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />} Make my calendar link
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => meApi.downloadIcs().catch(() => toast.error('Download failed'))}><Download size={14} /> Download .ics</button>
          </div>
        )}
      </Panel>

      {who === 'student' && (
        <Panel label="Before each class" title="Reminders">
          <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)', lineHeight: 1.55 }}>
            An in-app notice and an email before each timetabled class. None on holidays or exam days.
          </p>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <BellRing size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <Segmented label="Remind me" value={String(data?.reminderMinutes ?? 10)} onChange={v => reminders.mutate(Number(v))} options={REMINDER_OPTIONS} />
          </div>
        </Panel>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        busy={make.isPending || off.isPending}
        danger={confirm === 'off'}
        title={confirm === 'off' ? 'Turn off the calendar link?' : 'Make a new link?'}
        confirmLabel={confirm === 'off' ? 'Turn off' : 'Make new link'}
        onConfirm={() => (confirm === 'off' ? off.mutate() : make.mutate())}
      >
        {confirm === 'off'
          ? 'Calendars subscribed to it stop updating and the timetable disappears from them at their next refresh.'
          : 'The current link stops working. Use this if you shared it by mistake, then subscribe again with the new one.'}
      </ConfirmDialog>
    </div>
  );
}
