// client/src/components/teaching/GradeExport.jsx
import { useMemo, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { Panel } from '../console/Panel';
import DataTable from '../console/DataTable';
import { Segmented, Field } from '../console/controls';
import { gradeFor, gradeCsv } from './grades';

/**
 * ═════════════════════════════════════════════════════════════════
 * Attendance to grade.
 *
 * Turns each student's register into marks the lecturer can paste
 * into a gradebook. The lecturer chooses:
 *   out of     the marks attendance is worth (e.g. 10)
 *   method     proportional (the rate times the marks), or full marks
 *              at or above the class minimum and proportional below it
 *   late       counts as a full session or as half of one
 *   excused    counts as attended, or is left out of the total
 *   rounding   whole marks, or one or two decimal places
 * The table previews the result live; the CSV has one row per student.
 * The choices are remembered per class on this device.
 * ═════════════════════════════════════════════════════════════════
 */

const DEFAULTS = { max: 10, method: 'proportional', late: 'full', excused: 'attended', decimals: 1 };
const storeKey = (classId) => `attendx-grades-${classId}`;
function loadScheme(classId) {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(storeKey(classId)) ?? '{}') }; } catch { return DEFAULTS; }
}

export default function GradeExport({ classId, className, code, threshold, students = [], loading }) {
  const [scheme, setSchemeState] = useState(() => loadScheme(classId));
  const setScheme = (patch) => setSchemeState(prev => {
    const next = { ...prev, ...patch };
    try { localStorage.setItem(storeKey(classId), JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });

  const rows = useMemo(() => students.map(s => ({ ...s, grade: gradeFor(s, scheme, threshold) })), [students, scheme, threshold]);
  const avg = rows.length ? rows.reduce((t, r) => t + (r.grade.mark ?? 0), 0) / rows.length : 0;

  const download = () => {
    const csv = gradeCsv(rows, scheme);
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href, download: `${code || 'class'}-attendance-marks-out-of-${scheme.max}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const columns = [
    { key: 'name', header: 'Student', sort: r => r.name, render: r => (
      <span><span className="cell-main">{r.name}</span><span className="cell-sub">{r.studentNumber ?? r.email}</span></span>
    ) },
    { key: 'sessions', header: 'Counted', num: true, render: r => <span className="tabular">{r.grade.counted}<span className="c-muted"> / {r.grade.total}</span></span> },
    { key: 'rate', header: 'Rate used', num: true, sort: r => r.grade.rate ?? -1, render: r => (r.grade.rate == null ? '–' : `${r.grade.rate}%`) },
    { key: 'mark', header: `Mark / ${scheme.max}`, num: true, sort: r => r.grade.mark ?? -1, render: r => (
      <span className="tabular" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.grade.mark == null ? '–' : r.grade.mark.toFixed(scheme.decimals)}</span>
    ) },
  ];

  return (
    <div className="split">
      <Panel flush label={`${className} / attendance marks`} title={`${rows.length} students, average ${avg.toFixed(scheme.decimals)} of ${scheme.max}`}
             actions={<button type="button" className="btn-accent btn-sm" onClick={download} disabled={!rows.length}><Download size={14} /> Download CSV</button>}>
        <DataTable caption="Attendance marks" columns={columns} rows={rows} loading={loading} />
      </Panel>

      <Panel label="How marks are worked out" title="Marking scheme">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Attendance is worth" hint="Marks out of this number">
            <input className="c-input" type="number" min={1} max={100} step={1} value={scheme.max}
                   onChange={e => setScheme({ max: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} />
          </Field>
          <div className="c-field">
            <span className="c-label">Method</span>
            <Segmented label="Method" value={scheme.method} onChange={v => setScheme({ method: v })}
              options={[{ value: 'proportional', label: 'Proportional' }, { value: 'minimum', label: `Full at ${threshold}%` }]} />
            <span className="hint">
              {scheme.method === 'proportional'
                ? 'An 80% rate earns 80% of the marks.'
                : `At or above the ${threshold}% minimum earns full marks; below it, marks shrink in proportion.`}
            </span>
          </div>
          <div className="c-field">
            <span className="c-label">A late arrival counts as</span>
            <Segmented label="Late" value={scheme.late} onChange={v => setScheme({ late: v })}
              options={[{ value: 'full', label: 'A full session' }, { value: 'half', label: 'Half a session' }]} />
          </div>
          <div className="c-field">
            <span className="c-label">An excused absence</span>
            <Segmented label="Excused" value={scheme.excused} onChange={v => setScheme({ excused: v })}
              options={[{ value: 'attended', label: 'Counts as attended' }, { value: 'omit', label: 'Is left out' }]} />
          </div>
          <div className="c-field">
            <span className="c-label">Rounding</span>
            <Segmented label="Rounding" value={String(scheme.decimals)} onChange={v => setScheme({ decimals: Number(v) })}
              options={[{ value: '0', label: 'Whole' }, { value: '1', label: '0.1' }, { value: '2', label: '0.01' }]} />
          </div>
          <p style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            Closed sessions only, from the day each student enrolled. The CSV opens in Excel and Google Sheets.
          </p>
        </div>
      </Panel>
    </div>
  );
}
