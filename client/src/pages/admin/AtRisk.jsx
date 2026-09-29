// client/src/pages/admin/AtRisk.jsx
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Mail, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { getAtRisk, notifyAtRiskStudent, notifyAtRiskLecturer } from '../../services/adminService';
import { ConsoleHead, Panel, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Tabs, SearchInput } from '../../components/console/controls';

/**
 * ═════════════════════════════════════════════════════════════════
 * Students who need attention this semester, in three groups:
 *   below minimum   under their class's attendance minimum
 *   approaching     within 5 points of it (the early-warning band)
 *   missed in a row two or more closed sessions missed back to back
 * Only classes with at least three closed sessions are judged. The
 * notify buttons email and message the student or their lecturer.
 * ═════════════════════════════════════════════════════════════════
 */

const GROUPS = [
  { value: 'belowThreshold', label: 'Below minimum' },
  { value: 'approaching', label: 'Approaching' },
  { value: 'recentDropouts', label: 'Missed in a row' },
];

function RateBar({ row }) {
  const pct = Math.max(0, Math.min(100, row.percentage ?? 0));
  const tone = pct < row.threshold ? 'bad' : pct < row.threshold + 5 ? 'warn' : 'good';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, width: '100%' }}>
      <span className="tabular" style={{ width: 44, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{row.percentage}%</span>
      <span className="barlist-track" style={{ position: 'relative', flex: 1, minWidth: 80, overflow: 'visible' }} title={`Minimum ${row.threshold}%`}>
        <span className={`barlist-fill ${tone}`} style={{ display: 'block', width: `${pct}%` }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: `${row.threshold}%`, top: -3, bottom: -3, width: 2, borderRadius: 1, background: 'var(--text-subtle)' }} />
      </span>
    </span>
  );
}

export default function AtRisk() {
  const [group, setGroup] = useState('belowThreshold');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);

  const { data, isPending, isFetching, refetch } = useQuery({ queryKey: ['admin-at-risk'], queryFn: getAtRisk });

  const rows = useMemo(() => {
    const list = data?.[group] ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r => [r.studentName, r.studentEmail, r.studentNumber, r.className]
      .some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, group, search]);

  const notify = async (row, who) => {
    const key = `${row.studentId}:${row.classId}:${who}`;
    if (who === 'lecturer' && !row.lecturerId) { toast.error('This class has no lecturer'); return; }
    setBusy(key);
    try {
      await (who === 'student' ? notifyAtRiskStudent : notifyAtRiskLecturer)(row.studentId, row.classId);
      toast.success(who === 'student' ? `${row.studentName} has been told` : `${row.lecturerName ?? 'The lecturer'} has been told`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send the notice');
    } finally {
      setBusy(null);
    }
  };

  const columns = [
    { key: 'student', header: 'Student', sort: r => r.studentName, render: r => (
      <span><span className="cell-main">{r.studentName}</span><span className="cell-sub">{r.studentNumber ?? r.studentEmail}</span></span>
    ) },
    { key: 'class', header: 'Class', sort: r => r.className, render: r => (
      <span><span style={{ color: 'var(--text-primary)' }}>{r.className}</span><span className="cell-sub">{r.lecturerName ?? 'No lecturer'}</span></span>
    ) },
    { key: 'rate', header: 'Attendance', sort: r => r.percentage, width: 260, render: r => <RateBar row={r} /> },
    { key: 'sessions', header: 'Attended', num: true, render: r => <span className="tabular">{r.attendedCount}<span className="c-muted"> / {r.totalSessions}</span></span> },
    ...(group === 'recentDropouts' ? [{ key: 'missed', header: 'In a row', num: true, sort: r => r.consecutiveMissed, render: r => <span className="tabular" style={{ color: 'var(--red)' }}>{r.consecutiveMissed}</span> }] : []),
    { key: 'act', header: '', num: true, render: r => (
      <span className="c-actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
        <button type="button" className="btn-ghost btn-sm" disabled={busy === `${r.studentId}:${r.classId}:student`} onClick={() => notify(r, 'student')}>
          {busy === `${r.studentId}:${r.classId}:student` ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />} Student
        </button>
        <button type="button" className="btn-ghost btn-sm" disabled={busy === `${r.studentId}:${r.classId}:lecturer`} onClick={() => notify(r, 'lecturer')}>
          {busy === `${r.studentId}:${r.classId}:lecturer` ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Lecturer
        </button>
      </span>
    ) },
  ];

  const s = data?.summary;
  return (
    <div className="c-page">
      <ConsoleHead
        kicker={`Insight / ${data?.range?.label ?? 'At-risk'}`}
        title="At-risk students"
        lede={s ? `${s.belowCount} below their class minimum, ${s.approachingCount} close to it, ${s.dropoutCount} missing sessions back to back.` : 'Checking attendance against each class minimum…'}
        actions={<button type="button" className="btn-ghost btn-sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw size={14} className={isFetching ? 'animate-spin' : undefined} /> Recheck</button>}
      />
      <Panel flush>
        <div style={{ padding: '6px 14px 0' }}>
          <Tabs label="Groups" value={group} onChange={setGroup} tabs={GROUPS.map(g => ({
            ...g, count: s ? { belowThreshold: s.belowCount, approaching: s.approachingCount, recentDropouts: s.dropoutCount }[g.value] : undefined,
          }))} />
        </div>
        <div className="c-toolbar" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Student, ID or class" label="Search at-risk students" />
        </div>
        <DataTable caption="At-risk students" columns={columns} rows={rows} loading={isPending}
          rowKey={r => `${r.studentId}:${r.classId}`}
          empty={<Empty icon={ShieldCheck} title={search ? 'No one matches' : 'No one in this group'}>
            {search ? 'Try another search.' : 'Only classes with three or more closed sessions are judged.'}
          </Empty>} />
      </Panel>
    </div>
  );
}
