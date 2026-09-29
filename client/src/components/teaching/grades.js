// client/src/components/teaching/grades.js

/**
 * Attendance marks for one student under a marking scheme (see
 * GradeExport). `s` is a row from /teaching/classes/:id/roster.
 */
export function gradeFor(s, scheme, threshold) {
  const lateWeight = scheme.late === 'half' ? 0.5 : 1;
  const omitExcused = scheme.excused === 'omit';
  const total = s.held - (omitExcused ? s.excused : 0);
  const counted = s.present + s.late * lateWeight + (omitExcused ? 0 : s.excused);
  if (total <= 0) return { total: 0, counted: 0, rate: null, mark: null };
  const rate = (counted / total) * 100;
  const share = scheme.method === 'minimum'
    ? (rate >= threshold ? 1 : rate / threshold)
    : rate / 100;
  const factor = 10 ** scheme.decimals;
  return {
    total,
    counted: Math.round(counted * 10) / 10,
    rate: Math.round(rate * 10) / 10,
    mark: Math.round(share * scheme.max * factor) / factor,
  };
}

const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function gradeCsv(rows, scheme) {
  const head = ['Student ID', 'Name', 'Email', 'Sessions held', 'Present', 'Late', 'Excused', 'Absent', 'Rate used (%)', `Mark (out of ${scheme.max})`];
  const lines = rows.map(r => [
    r.studentNumber ?? '', r.name, r.email, r.held, r.present, r.late, r.excused, r.absent,
    r.grade.rate ?? '', r.grade.mark == null ? '' : r.grade.mark.toFixed(scheme.decimals),
  ].map(cell).join(','));
  return [head.map(cell).join(','), ...lines].join('\r\n');
}
