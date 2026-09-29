// client/src/pages/lecturer/ClassHubPage.jsx
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Radio, Presentation, Users, CalendarClock, ShieldCheck, Inbox,
} from 'lucide-react';

import PageShell, { PageHeader } from '../../components/layout/PageShell';
import StatTile from '../../components/ui/StatTile';
import { Panel, Empty, PanelSkeleton } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Tabs, SearchInput, Segmented } from '../../components/console/controls';
import RegisterStrip, { RegisterLegend } from '../../components/teaching/RegisterStrip';
import RateMeter from '../../components/teaching/RateMeter';
import GradeExport from '../../components/teaching/GradeExport';
import StaffPanel from '../../components/teaching/StaffPanel';
import ScheduleManager from '../../components/classes/ScheduleManager';
import OpenSessionModal from '../../components/sessions/OpenSessionModal';
import { teachingApi, ROLE_LABEL } from '../../services/teachingService';
import { timeAgo } from '../../components/console/format';
import { dayLabel, plural } from '../../components/teaching/format';
import { TAP } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * One class, everything about it.
 *
 *   Register    every student with their rate against the minimum and
 *               their last 12 sessions as a register strip; a row opens
 *               that student's page
 *   Timetable   the weekly slots (editable by the owner and co-lecturers)
 *   Staff       the owner, co-lecturers and teaching assistants
 *   Grades      attendance turned into marks, previewed and exported
 *
 * The tab lives in the URL (?tab=) so a link can land on any of them.
 * ═════════════════════════════════════════════════════════════════
 */

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ClassHubPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'register';
  const setTab = (t) => setParams(t === 'register' ? {} : { tab: t }, { replace: true });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [opening, setOpening] = useState(false);

  const hub = useQuery({ queryKey: ['class-hub', classId], queryFn: () => teachingApi.classHub(classId), retry: false });
  const roster = useQuery({ queryKey: ['class-roster', classId], queryFn: () => teachingApi.roster(classId), enabled: hub.isSuccess });

  const threshold = hub.data?.class.threshold ?? 75;
  const students = useMemo(() => roster.data?.students ?? [], [roster.data]);
  const counts = useMemo(() => ({
    all: students.length,
    risk: students.filter(s => s.held >= 3 && s.rate != null && s.rate < threshold).length,
    streak: students.filter(s => s.missedInARow >= 2).length,
  }), [students, threshold]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter(s => filter === 'all' || (filter === 'risk' ? s.held >= 3 && s.rate != null && s.rate < threshold : s.missedInARow >= 2))
      .filter(s => !q || [s.name, s.email, s.studentNumber].some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [students, filter, search, threshold]);

  if (hub.isError) {
    return (
      <PageShell>
        <BackLink />
        <Panel><Empty icon={Users} title="This class isn't available">It may have been deleted, or you're no longer on its teaching staff.</Empty></Panel>
      </PageShell>
    );
  }
  if (hub.isPending) {
    return (
      <PageShell>
        <BackLink />
        <PageHeader kicker="Lecturer / Class" title="Loading…" />
        <div className="hub-kpis">{[0, 1, 2, 3].map(i => <PanelSkeleton key={i} lines={2} />)}</div>
      </PageShell>
    );
  }

  const { class: cls, myRole, permissions, stats, staff, schedules, openSession, nextSlot } = hub.data;
  const pending = stats.pendingAppeals + stats.pendingExcuses;

  const columns = [
    { key: 'name', header: 'Student', sort: s => s.name, render: s => (
      <span><span className="cell-main">{s.name}</span><span className="cell-sub">{s.studentNumber ?? s.email}</span></span>
    ) },
    { key: 'rate', header: 'Attendance', width: 210, sort: s => s.rate ?? -1, render: s => <RateMeter rate={s.rate} threshold={threshold} /> },
    { key: 'counted', header: 'Counted', num: true, sort: s => s.counted, render: s => <span className="tabular">{s.counted}<span className="c-muted"> / {s.held}</span></span> },
    { key: 'late', header: 'Late', num: true, sort: s => s.late },
    { key: 'excused', header: 'Excused', num: true, sort: s => s.excused },
    { key: 'row', header: 'In a row', num: true, sort: s => s.missedInARow, render: s => (
      <span className="tabular" style={{ color: s.missedInARow >= 2 ? 'var(--red)' : undefined, fontWeight: s.missedInARow >= 2 ? 700 : undefined }}>{s.missedInARow}</span>
    ) },
    { key: 'strip', header: `Last ${roster.data?.sessions.length ?? 12}`, render: s => <RegisterStrip statuses={s.recent} sessions={roster.data?.sessions} label={`${s.name}, last sessions`} /> },
    { key: 'seen', header: 'Last scan', sort: s => (s.lastSeen ? Date.parse(s.lastSeen) : 0), render: s => <span className="c-muted" style={{ whiteSpace: 'nowrap' }}>{s.lastSeen ? timeAgo(s.lastSeen) : 'Never'}</span> },
  ];

  return (
    <PageShell>
      <BackLink />
      <PageHeader
        kicker={`${cls.code}${cls.department ? ` / ${cls.department}` : ''}`}
        title={cls.name}
        subtitle={[
          myRole !== 'owner' && cls.owner ? `${cls.owner.name}'s class` : null,
          plural(stats.enrolled, 'student'),
          `minimum ${threshold}%`,
          cls.hasGeofence ? `location check ${cls.geoRadius} m` : 'no location check',
        ].filter(Boolean).join(' · ')}
        action={
          <>
            {openSession ? (
              <>
                <Link to={`/lecturer/session/${openSession.id}/projector`} className="btn-ghost"><Presentation size={15} /> Projector</Link>
                <motion.button whileTap={TAP.button} className="btn-accent" onClick={() => navigate(`/lecturer/session/${openSession.id}`)}>
                  <Radio size={15} /> View live session
                </motion.button>
              </>
            ) : permissions.run && (
              <motion.button whileTap={TAP.button} className="btn-primary" onClick={() => setOpening(true)}>
                <Radio size={15} /> Open a session
              </motion.button>
            )}
          </>
        }
      >
        {myRole !== 'owner' && <p style={{ marginTop: 12 }}><span className="role-chip">You are {ROLE_LABEL[myRole].toLowerCase()}</span></p>}
      </PageHeader>

      <div className="hub-kpis">
        <StatTile label="Attendance" value={stats.rate == null ? '–' : `${stats.rate}%`} featured framed={!openSession} tone="green" index={1}
                  hint={`Every closed session, minimum ${threshold}%`} />
        <StatTile label="Sessions held" value={stats.sessionsHeld} tone="brand" index={2}
                  hint={nextSlot ? `Next: ${dayLabel(nextSlot.day, { weekday: 'short', day: 'numeric', month: 'short' })} ${nextSlot.start}` : 'No timetabled session coming up'} />
        <StatTile label="Below minimum" value={stats.atRisk} tone={stats.atRisk ? 'red' : 'muted'} index={3}
                  hint={stats.atRisk ? 'After three or more sessions' : 'Everyone is on track'} />
        <StatTile label="To review" value={pending} tone={pending ? 'amber' : 'muted'} index={4}
                  hint={pending ? `${plural(stats.pendingAppeals, 'appeal')}, ${plural(stats.pendingExcuses, 'excuse request')}` : 'No appeals or excuse requests waiting'} />
      </div>

      {pending > 0 && permissions.edit && (
        <Link to="/lecturer/requests" className="link-row"><Inbox size={15} /> Review {plural(pending, 'request')} for this class</Link>
      )}

      <Tabs label="Class sections" value={tab} onChange={setTab} tabs={[
        { value: 'register', label: 'Register', count: stats.enrolled },
        { value: 'timetable', label: 'Timetable', count: schedules.filter(s => s.isActive).length },
        { value: 'staff', label: 'Staff', count: staff.length + 1 },
        { value: 'grades', label: 'Grades' },
      ]} />

      {tab === 'register' && (
        <Panel flush>
          <div className="c-toolbar" style={{ padding: 14, borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
            <div className="c-toolbar">
              <SearchInput value={search} onChange={setSearch} placeholder="Name, ID or email" label="Search students" />
              <Segmented label="Show" value={filter} onChange={setFilter} options={[
                { value: 'all', label: 'Everyone', count: counts.all },
                { value: 'risk', label: 'Below minimum', count: counts.risk },
                { value: 'streak', label: 'Missed 2+ in a row', count: counts.streak },
              ]} />
            </div>
            <RegisterLegend />
          </div>
          <DataTable
            caption={`${cls.name} register`}
            columns={columns}
            rows={rows}
            loading={roster.isPending}
            onRowClick={s => navigate(`/lecturer/classes/${classId}/students/${s.id}`)}
            empty={<Empty icon={search || filter !== 'all' ? ShieldCheck : Users}
                          title={search ? 'No one matches' : filter !== 'all' ? 'No one in this group' : 'No students yet'}>
              {search || filter !== 'all' ? 'Try another search or group.' : `Students join with the code ${cls.code}.`}
            </Empty>}
          />
        </Panel>
      )}

      {tab === 'timetable' && (
        permissions.edit ? (
          <Panel label="Weekly timetable" title="Sessions open on their own at these times"
                 actions={<Link to="/lecturer/timetable" className="btn-ghost btn-sm"><CalendarClock size={14} /> Your week</Link>}>
            <ScheduleManager classId={classId} className={cls.name} />
          </Panel>
        ) : (
          <Panel flush label="Weekly timetable" title="When this class meets">
            {schedules.length ? (
              <ul style={{ listStyle: 'none' }}>
                {schedules.map(s => (
                  <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600 }}>{DAY[s.dayOfWeek]}</span>
                    <span className="tabular c-subtle">{s.start}, {s.duration} min{s.isActive ? '' : ' (paused)'}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={CalendarClock} title="No weekly timetable">The owner or a co-lecturer can add one.</Empty>}
          </Panel>
        )
      )}

      {tab === 'staff' && <StaffPanel classId={classId} owner={cls.owner} staff={staff} myRole={myRole} />}

      {tab === 'grades' && (
        <GradeExport classId={classId} className={cls.name} code={cls.code} threshold={threshold}
                     students={students} loading={roster.isPending} />
      )}

      <OpenSessionModal
        classData={{ id: classId, name: cls.name }}
        open={opening}
        onClose={() => setOpening(false)}
        onOpened={(session) => {
          setOpening(false);
          qc.invalidateQueries({ queryKey: ['classes'] });
          navigate(`/lecturer/session/${session.id}`);
        }}
      />

      <p className="sr-only" aria-live="polite">{hub.isFetching ? 'Updating' : ''}</p>
    </PageShell>
  );
}

function BackLink() {
  return (
    <Link to="/lecturer/classes" className="link-row" style={{ alignSelf: 'flex-start' }}>
      <ArrowLeft size={15} /> All classes
    </Link>
  );
}
