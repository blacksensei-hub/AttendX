// client/src/pages/admin/Analytics.jsx
import { useRef, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { FileDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { consoleApi } from '../../services/consoleService';
import { ConsoleHead, Panel, Kpi, Delta, Empty, PanelSkeleton } from '../../components/console/Panel';
import { TrendLine, BarList, HeatGrid } from '../../components/console/charts';
import DataTable from '../../components/console/DataTable';
import { Select } from '../../components/console/controls';
import { pctFormat, toneFor, usePanelReveal } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Institution analytics.
 *
 * One semester at a time (current by default), compared with the one
 * before when it exists: attendance by week, by department, by day and
 * hour (when attendance is weakest), the classes that need attention,
 * and lecturers against their own timetables. Same numbers as the PDF.
 * ═════════════════════════════════════════════════════════════════
 */

const fmtWeek = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function Analytics() {
  const grid = useRef(null);
  const [semesterId, setSemesterId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const params = semesterId ? { semesterId } : {};

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['admin-analytics', semesterId],
    queryFn: () => consoleApi.analytics(params),
    placeholderData: keepPreviousData,
  });
  usePanelReveal(grid, Boolean(data));

  const pdf = async () => {
    setDownloading(true);
    try { await consoleApi.analyticsPdf(params); }
    catch { toast.error('Could not build the report'); }
    finally { setDownloading(false); }
  };

  const o = data?.overall;
  const cmp = data?.comparison;
  // With a comparison both series are labelled by week number, since
  // week 3 of this semester is set against week 3 of the last one.
  const trend = (data?.trend ?? []).map(w => ({ label: cmp ? `Week ${w.index}` : fmtWeek(w.week), value: w.rate }));
  const compare = cmp?.trend?.map(w => ({ label: `Week ${w.index}`, value: w.rate }));

  const semesterOptions = [
    { value: '', label: 'Current semester' },
    ...(data?.semesters ?? []).map(s => ({ value: s.id, label: `${s.name}${s.is_archived ? ' (archived)' : ''}` })),
    { value: 'all', label: 'All time' },
  ];

  const classCols = [
    { key: 'name', header: 'Class', render: c => <span><span className="cell-main">{c.name}</span><span className="cell-sub">{c.lecturerName ?? '—'}</span></span> },
    { key: 'sessions', header: 'Sessions', num: true, sort: c => c.sessions },
    { key: 'rate', header: 'Attendance', num: true, sort: c => c.rate, render: c => <span className={`chip ${{ good: 'green', warn: 'amber', bad: 'red' }[toneFor(c.rate)]}`}>{c.rate}%</span> },
  ];
  const lecturerCols = [
    { key: 'name', header: 'Lecturer', sort: l => l.name, render: l => <span><span className="cell-main">{l.name}</span><span className="cell-sub">{l.classes.join(', ')}</span></span> },
    { key: 'slots', header: 'Timetabled', num: true, sort: l => l.slots },
    { key: 'held', header: 'Held', num: true, sort: l => l.heldRate, render: l => <span className="tabular">{l.held} <span className="c-muted">({l.heldRate}%)</span></span> },
    { key: 'missed', header: 'Missed', num: true, sort: l => l.missed, render: l => <span className="tabular" style={l.missed ? { color: 'var(--red)' } : undefined}>{l.missed}</span> },
    { key: 'late', header: 'Late starts', num: true, sort: l => l.lateStarts, render: l => <span className="tabular" style={l.lateStarts ? { color: 'var(--amber)' } : undefined}>{l.lateStarts}</span> },
    { key: 'short', header: 'Cut short', num: true, sort: l => l.shortRuns },
    { key: 'rate', header: 'Attendance', num: true, sort: l => l.attendanceRate ?? -1, render: l => (l.attendanceRate == null ? '—' : `${l.attendanceRate}%`) },
  ];

  return (
    <div className="c-page">
      <ConsoleHead
        kicker={`Insight / ${data?.range?.label ?? 'Analytics'}`}
        title="Analytics"
        lede="Closed sessions only. A student is expected at every session held after they enrolled; present and late both count."
        actions={(
          <>
            {isFetching && !isPending && <Loader2 size={15} className="animate-spin c-muted" aria-label="Updating" />}
            <Select label="Semester" value={semesterId} onChange={setSemesterId} options={semesterOptions} />
            <button type="button" className="btn-ghost btn-sm" onClick={pdf} disabled={downloading}>
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={15} />} PDF report
            </button>
          </>
        )}
      />

      {isPending ? (
        <div className="c-grid">
          {[0, 1, 2, 3].map(i => <PanelSkeleton key={i} className="span-3" />)}
          <PanelSkeleton className="span-8" lines={6} />
          <PanelSkeleton className="span-4" lines={6} />
        </div>
      ) : data && (
        <div className="c-grid" ref={grid}>
          <Kpi className="span-3" label="Attendance rate" value={o.rate} format={pctFormat}
               delta={cmp ? <Delta value={o.rate - cmp.overall.rate} /> : null}
               foot={cmp ? `vs ${cmp.label}` : 'No earlier semester to compare'} />
          <Kpi className="span-3" label="Sessions held" value={o.sessions} foot={`${o.expected.toLocaleString()} expected seats`} />
          <Kpi className="span-3" label="Arrived late" value={o.attended ? Math.round((o.late / o.attended) * 1000) / 10 : 0} format={pctFormat}
               foot={`${o.late.toLocaleString()} of ${o.attended.toLocaleString()} attendances`} />
          <Kpi className="span-3" label="Students at risk" value={o.atRisk} foot={`${o.atRiskEnrolments ?? o.atRisk} class enrolments below minimum`} />

          <Panel className="span-8" label="By week" title={cmp ? `${data.range.label} against ${cmp.label}` : data.range.label}
                 actions={cmp && <span className="c-muted" style={{ fontSize: 12 }}>Dashed: {cmp.label}, same week</span>}>
            <TrendLine data={trend} compare={compare} height={220} />
          </Panel>

          <Panel className="span-4" label="By department" title="Attendance rate">
            <BarList rows={data.departments.map(d => ({ label: d.department, value: d.rate, meta: `${d.classes} class${d.classes === 1 ? '' : 'es'}` }))} />
          </Panel>

          <Panel className="span-7" label="By day and hour" title="When attendance is weakest"
                 actions={<span className="c-muted" style={{ fontSize: 12 }}>Darker is higher attendance</span>}>
            {data.grid.length ? <HeatGrid cells={data.grid} /> : <Empty title="No sessions in this range" />}
          </Panel>

          <Panel className="span-5" label="Needs attention" title="Lowest attendance by class" flush>
            <DataTable caption="Classes by attendance" columns={classCols} rows={data.classes.slice(0, 8)}
                       empty={<Empty title="No classes with closed sessions" />} />
          </Panel>

          <Panel className="span-12" label="Against the timetable" title="Lecturers" flush>
            <p className="c-muted" style={{ fontSize: 12.5, padding: '0 18px 12px' }}>
              Each weekly timetable slot in the range (holidays and exam periods excluded) is matched to a session opened within 30 minutes before to 90 minutes after it. Late start: opened 10+ minutes after the slot. Cut short: closed before half the slot.
            </p>
            <DataTable caption="Lecturer reliability" columns={lecturerCols} rows={data.lecturers} rowKey={l => l.lecturerId}
                       empty={<Empty title="No timetabled classes">Lecturers who set weekly schedules appear here.</Empty>} />
          </Panel>
        </div>
      )}
    </div>
  );
}
