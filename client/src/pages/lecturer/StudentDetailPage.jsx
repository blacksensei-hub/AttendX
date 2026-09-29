// client/src/pages/lecturer/StudentDetailPage.jsx
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mail, PencilLine, UserX, MessageSquareText, CalendarX2 } from 'lucide-react';

import PageShell, { PageHeader } from '../../components/layout/PageShell';
import StatTile from '../../components/ui/StatTile';
import StatusPill from '../../components/ui/StatusPill';
import { Panel, Empty, PanelSkeleton } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { TrendLine } from '../../components/console/charts';
import RegisterStrip, { RegisterLegend } from '../../components/teaching/RegisterStrip';
import AdjustmentModal from '../../components/sessions/AdjustmentModal';
import { teachingApi } from '../../services/teachingService';
import { fmtDay, fmtTime, planFor, plural } from '../../components/teaching/format';
import { timeAgo } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * One student in one class: the lecturer's drill-down.
 *
 * The whole register as a strip (oldest left), their running rate
 * against the minimum over time, every session with how long after
 * opening they scanned and any hand-made change with its reason, and
 * their appeals and excuse requests for the class. The owner and
 * co-lecturers can adjust a record from here; TAs see it read-only.
 * ═════════════════════════════════════════════════════════════════
 */
export default function StudentDetailPage() {
  const { classId, studentId } = useParams();
  const qc = useQueryClient();
  const [adjusting, setAdjusting] = useState(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ['class-student', classId, studentId],
    queryFn: () => teachingApi.student(classId, studentId),
    retry: false,
  });

  const oldestFirst = useMemo(() => [...(data?.sessions ?? [])].reverse(), [data]);
  const trend = useMemo(() => oldestFirst.map(s => ({ label: fmtDay(s.openAt), value: s.runningRate ?? 0 })), [oldestFirst]);

  const back = (
    <Link to={`/lecturer/classes/${classId}`} className="link-row" style={{ alignSelf: 'flex-start' }}>
      <ArrowLeft size={15} /> {data?.class ? `${data.class.code} register` : 'Class register'}
    </Link>
  );
  if (isError) {
    return <PageShell>{back}<Panel><Empty icon={UserX} title="Student not found">They may have left the class.</Empty></Panel></PageShell>;
  }
  if (isPending) {
    return <PageShell>{back}<PageHeader kicker="Student" title="Loading…" /><div className="hub-kpis">{[0, 1, 2, 3].map(i => <PanelSkeleton key={i} lines={2} />)}</div></PageShell>;
  }

  const { class: cls, student, stats, appeals, excuses, canEdit } = data;
  const threshold = cls.threshold;
  // What they need from here if the class ran another 10 sessions.
  const need = stats.rate != null && stats.rate < threshold
    ? planFor({ counted: stats.counted, held: stats.held, threshold, remaining: 10 })
    : null;

  const columns = [
    { key: 'date', header: 'Date', sort: s => Date.parse(s.openAt), render: s => (
      <span><span className="cell-main">{fmtDay(s.openAt, { weekday: 'short' })}</span><span className="cell-sub">{fmtTime(s.openAt)}</span></span>
    ) },
    { key: 'title', header: 'Session', render: s => <span className="c-subtle">{s.title || 'Attendance session'}</span> },
    { key: 'status', header: 'Status', sort: s => s.status, render: s => <StatusPill status={s.status} showSweep={false} /> },
    { key: 'scan', header: 'Scanned', render: s => (s.minutesAfterOpen == null
      ? <span className="c-muted">–</span>
      : <span className="tabular">{fmtTime(s.markedAt)}<span className="c-muted"> · {s.minutesAfterOpen} min in</span></span>) },
    { key: 'change', header: 'Changed by hand', render: s => (s.adjusted
      ? <span title={s.adjusted.reason} style={{ fontSize: 12.5 }}><span className="c-muted">{s.adjusted.from} → {s.adjusted.to}:</span> {s.adjusted.reason}</span>
      : <span className="c-muted">–</span>) },
    ...(canEdit ? [{ key: 'act', header: '', num: true, render: s => (
      <button type="button" className="btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setAdjusting(s); }}>
        <PencilLine size={13} /> Adjust
      </button>
    ) }] : []),
  ];

  return (
    <PageShell>
      {back}
      <PageHeader
        kicker={`${cls.code} / Student`}
        title={student.name}
        subtitle={[student.studentNumber && `ID ${student.studentNumber}`, student.email, student.department,
          student.enrolledAt && `joined ${fmtDay(student.enrolledAt, { year: 'numeric' })}`].filter(Boolean).join(' · ')}
        action={<a className="btn-ghost" href={`mailto:${student.email}?subject=${encodeURIComponent(cls.name)}`}><Mail size={15} /> Email</a>}
      />

      <div className="hub-kpis">
        <StatTile label="Attendance" value={stats.rate == null ? '–' : `${stats.rate}%`} featured framed tone={stats.rate != null && stats.rate < threshold ? 'red' : 'green'} index={1}
                  hint={stats.rate == null ? 'No closed sessions yet'
                    : stats.rate >= threshold ? `At or above the ${threshold}% minimum`
                      : need?.reachable ? `Below ${threshold}%; needs ${need.mustAttend} of the next 10` : `Below the ${threshold}% minimum`} />
        <StatTile label="Counted" value={`${stats.counted}/${stats.held}`} tone="brand" index={2}
                  hint={`${stats.present} present, ${stats.late} late, ${stats.excused} excused`} />
        <StatTile label="Absent" value={stats.absent} tone={stats.absent ? 'red' : 'muted'} index={3}
                  hint={stats.missedInARow >= 2 ? `The last ${stats.missedInARow} in a row` : 'Sessions missed without an excuse'} />
        <StatTile label="Last scan" value={stats.lastSeen ? timeAgo(stats.lastSeen).replace(' ago', '') : '–'} tone="violet" index={4}
                  hint={student.lastLoginAt ? `Last signed in ${timeAgo(student.lastLoginAt)}` : 'Hasn\'t signed in yet'} />
      </div>

      <Panel label={`${plural(stats.held, 'session')}, oldest first`} title="Register"
             actions={<RegisterLegend />}>
        {oldestFirst.length
          ? <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
              <RegisterStrip large statuses={oldestFirst.map(s => s.status)} sessions={oldestFirst} label={`${student.name}'s register`} />
            </div>
          : <Empty title="No closed sessions yet">The register fills in as sessions close.</Empty>}
      </Panel>

      <div className="split">
        <Panel label="Running rate after each session" title="Attendance over time">
          <TrendLine data={trend} threshold={threshold} label={`${student.name}'s running attendance rate`} height={210} />
        </Panel>
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <Panel label="Appeals" title={appeals.length ? plural(appeals.length, 'appeal') : 'No appeals'}>
            {appeals.length ? (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {appeals.map(a => (
                  <li key={a.id} style={{ display: 'grid', gap: 4 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusPill status={a.status} showSweep={false} />
                      <span className="c-muted" style={{ fontSize: 12.5 }}>{fmtDay(a.openAt)} · {a.title || 'session'}</span>
                    </span>
                    <span style={{ fontSize: 13.5, color: 'var(--text-subtle)' }}><MessageSquareText size={12} /> {a.reason}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="c-muted" style={{ fontSize: 13 }}>They haven't disputed any record in this class.</p>}
          </Panel>
          <Panel label="Excused absences" title={excuses.length ? plural(excuses.length, 'request') : 'No requests'}>
            {excuses.length ? (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {excuses.map(x => (
                  <li key={x.id} style={{ display: 'grid', gap: 4 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusPill status={x.status} showSweep={false} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}><CalendarX2 size={12} /> {x.range}</span>
                      <span className="c-muted" style={{ fontSize: 12.5 }}>{x.reasonLabel}</span>
                    </span>
                    <span style={{ fontSize: 13.5, color: 'var(--text-subtle)' }}>{x.note}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="c-muted" style={{ fontSize: 13 }}>None for this class.</p>}
          </Panel>
        </div>
      </div>

      <Panel flush label="Every session" title="Session by session">
        <DataTable caption={`${student.name}, every session`} columns={columns} rows={data.sessions} rowKey={s => s.sessionId}
                   empty={<Empty title="No closed sessions yet" />} />
      </Panel>

      <AnimatePresence>
        {adjusting && (
          <AdjustmentModal
            student={{ studentId: student.id, studentName: student.name, attendanceId: adjusting.attendanceId, status: adjusting.status }}
            sessionId={adjusting.sessionId}
            onClose={() => setAdjusting(null)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['class-student', classId, studentId] });
              qc.invalidateQueries({ queryKey: ['class-roster', classId] });
              qc.invalidateQueries({ queryKey: ['class-hub', classId] });
            }}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
