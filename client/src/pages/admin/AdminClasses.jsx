// client/src/pages/admin/AdminClasses.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { BookOpen, Megaphone, MapPin } from 'lucide-react';

import { adminService } from '../../services/adminService';
import { ConsoleHead, Panel, Sig, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Drawer } from '../../components/console/overlays';
import { SearchInput } from '../../components/console/controls';
import { fmtDateTime } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Every class on the platform: who teaches it, how many are enrolled,
 * its attendance minimum and classroom location. Opening one shows its
 * details, with a shortcut to message the class. ?focus=<id> opens a
 * class directly (the command palette links here).
 * ═════════════════════════════════════════════════════════════════
 */
export default function AdminClasses() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const focusId = params.get('focus');

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isPending } = useQuery({
    queryKey: ['admin-classes', debounced, page],
    queryFn: () => adminService.getClasses({ search: debounced, page, limit: 25 }),
    placeholderData: keepPreviousData,
  });
  const { data: focused } = useQuery({
    queryKey: ['admin-class', focusId],
    queryFn: () => adminService.getClasses({ id: focusId, limit: 1 }).then(r => r.classes?.[0] ?? null),
    enabled: Boolean(focusId),
  });
  const classes = data?.classes ?? [];
  const current = classes.find(c => c.id === focusId) ?? focused ?? null;

  const columns = [
    { key: 'name', header: 'Class', sort: c => c.name, render: c => <span><span className="cell-main">{c.name}</span><span className="cell-sub">{c.code}</span></span> },
    { key: 'dept', header: 'Department', sort: c => c.department ?? '', render: c => c.department ?? <span className="c-muted">—</span> },
    { key: 'lecturer', header: 'Lecturer', sort: c => c.lecturer?.name ?? '', render: c => <span className="c-subtle">{c.lecturer?.name ?? 'Unassigned'}</span> },
    { key: 'students', header: 'Students', num: true, sort: c => c.enrollmentCount },
    { key: 'min', header: 'Minimum', num: true, sort: c => c.attendance_threshold, render: c => `${c.attendance_threshold}%` },
    { key: 'where', header: 'Classroom', render: c => (c.geo_lat
      ? <span className="c-subtle"><MapPin size={12} style={{ verticalAlign: -1 }} /> {c.location_name ?? 'Set'} · {c.geo_radius} m</span>
      : <span className="c-muted">No location check</span>) },
    { key: 'status', header: 'Status', render: c => <Sig tone={c.is_active ? 'live' : 'idle'}>{c.is_active ? 'Active' : 'Inactive'}</Sig> },
  ];

  return (
    <div className="c-page">
      <ConsoleHead kicker="Teaching / Classes" title="Classes" lede="Every class, its lecturer and how attendance is checked." />
      <Panel flush>
        <div className="c-toolbar" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Class name, code or department" label="Search classes" />
        </div>
        <DataTable caption="Classes" columns={columns} rows={classes} loading={isPending}
          onRowClick={c => setParams({ focus: c.id }, { replace: true })}
          page={data?.page ?? page} totalPages={data?.totalPages ?? 1} total={data?.total} onPage={setPage}
          empty={<Empty icon={BookOpen} title="No classes match">Lecturers create classes from their own dashboard.</Empty>} />
      </Panel>

      <Drawer open={Boolean(focusId && current)} onClose={() => setParams({}, { replace: true })}
              label={current?.code} title={current?.name}
              footer={current && (
                <Link to={`/admin/announcements?new=1&class=${current.id}`} className="btn-accent btn-sm"><Megaphone size={14} /> Message this class</Link>
              )}>
        {current && (
          <dl className="dl">
            <dt>Lecturer</dt><dd>{current.lecturer?.name ?? 'Unassigned'}{current.lecturer?.email ? <span className="c-muted"> · {current.lecturer.email}</span> : null}</dd>
            <dt>Department</dt><dd>{current.department ?? '—'}</dd>
            <dt>Students</dt><dd className="tabular">{current.enrollmentCount}</dd>
            <dt>Join code</dt><dd className="tabular" style={{ fontFamily: 'var(--font-mono)' }}>{current.code}</dd>
            <dt>Minimum attendance</dt><dd>{current.attendance_threshold}%</dd>
            <dt>Classroom</dt><dd>{current.geo_lat ? `${current.location_name ?? 'Location set'}, ${current.geo_radius} m radius` : 'No location check'}</dd>
            <dt>Status</dt><dd>{current.is_active ? 'Active' : 'Inactive'}</dd>
            <dt>Created</dt><dd>{fmtDateTime(current.createdAt)}</dd>
            {current.description && (<><dt>About</dt><dd>{current.description}</dd></>)}
          </dl>
        )}
      </Drawer>
    </div>
  );
}
