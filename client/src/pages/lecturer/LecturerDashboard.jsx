import { useMemo }                       from 'react';
import { Link, useNavigate }             from 'react-router-dom';
import { useQuery }                      from '@tanstack/react-query';
import { motion }                        from 'framer-motion';
import {
  ArrowUpRight, CalendarClock, Inbox, TriangleAlert, Presentation, ChevronRight,
}                                        from 'lucide-react';

import { classService }                  from '../../services/classService';
import { teachingApi }                   from '../../services/teachingService';
import { useAuthStore }                  from '../../store/authStore';
import api                               from '../../services/api';

import PageShell, { PageHeader }         from '../../components/layout/PageShell';
import StatTile                          from '../../components/ui/StatTile';
import StatusPill                        from '../../components/ui/StatusPill';
import Ticker                            from '../../components/ui/Ticker';
import { Panel, Empty }                  from '../../components/console/Panel';
import { TrendLine }                     from '../../components/console/charts';
import { AnimatedList, AnimatedItem }    from '../../components/ui/AnimatedList';
import { shortName, withStop, classLabel } from '../../lib/names';
import { fmtDay, isoDay, plural }        from '../../components/teaching/format';
import { SPRING, TAP }                   from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * LecturerDashboard — the first surface every lecturer sees.
 *
 *   live now     any session taking attendance, one tap back in
 *   numbers      attendance across their classes, what's live,
 *                students and classes (counted up with anime.js)
 *   today        today's timetabled slots and what happened at each
 *   needs you    requests waiting and students below a minimum
 *   trend        the last 14 days with sessions, drawn in once
 *   classes      the classes they teach, straight to each class page
 *
 * Numbers are real or absent: no invented trend on an empty account.
 * ═════════════════════════════════════════════════════════════════
 */
export default function LecturerDashboard() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const { data: classData } = useQuery({ queryKey: ['classes'], queryFn: classService.getMyClasses });
  const classes = useMemo(() => classData?.classes ?? [], [classData]);
  const { data: stats, isPending: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  () => api.get('/reports/dashboard').then(r => r.data),
  });
  const { data: week } = useQuery({ queryKey: ['timetable', 'lecturer', 'this-week'], queryFn: () => teachingApi.timetable() });
  const { data: appeals } = useQuery({ queryKey: ['lecturer-appeals-count'], queryFn: () => api.get('/appeals/lecturer').then(r => r.data) });
  const { data: excuses } = useQuery({ queryKey: ['lecturer-excuse-count'], queryFn: () => api.get('/teaching/excuses', { params: { status: 'pending' } }).then(r => r.data) });
  const { data: risk } = useQuery({ queryKey: ['lecturer-at-risk-count'], queryFn: () => api.get('/thresholds/at-risk').then(r => r.data) });

  const totals = useMemo(() => ({
    students: classes.reduce((a, c) => a + (c.enrollmentCount ?? 0), 0),
    live:     classes.filter(c => c.activeSession).length,
  }), [classes]);
  const liveClasses = useMemo(() => classes.filter(c => c.activeSession), [classes]);
  const today = isoDay();
  const todaySlots = useMemo(() => (week?.slots ?? []).filter(s => s.day === today), [week, today]);
  const byId = useMemo(() => new Map((week?.classes ?? []).map(c => [c.id, c])), [week]);
  const trend = useMemo(() => (stats?.trend ?? []).map(t => ({ label: fmtDay(t.date), value: t.rate })), [stats]);
  const pendingRequests = (appeals?.pendingCount ?? 0) + (excuses?.counts?.pending ?? 0);
  const atRisk = riskCount(risk);
  const dateLine = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const CARDS = [
    { label: 'Avg attendance', value: <Ticker value={stats?.avgAttendance ?? 0} format={v => `${Math.round(v)}%`} />, tone: 'green', featured: true, framed: totals.live === 0, hint: 'Every closed session, all your classes' },
    { label: 'Live now',       value: <Ticker value={totals.live} />,        tone: 'brand',  hint: totals.live ? 'Sessions taking attendance' : 'No sessions open' },
    { label: 'Students',       value: <Ticker value={totals.students} />,    tone: 'violet', hint: 'Enrolled across your classes' },
    { label: 'Classes',        value: <Ticker value={classes.length} />,     tone: 'amber',  hint: 'Including ones shared with you' },
  ];

  return (
    <PageShell gap="var(--space-4)">
      <PageHeader
        kicker={`Lecturer / ${dateLine}`}
        title={`Good ${getGreeting()},`}
        accent={withStop(shortName(user?.name))}
        subtitle={liveClasses.length
          ? `${liveClasses.length} session${liveClasses.length !== 1 ? 's are' : ' is'} taking attendance right now.`
          : todaySlots.length ? `${plural(todaySlots.length, 'class', 'classes')} on your timetable today.` : "Here's how your classes are doing."}
        action={
          <motion.button whileTap={TAP.button} onClick={() => navigate('/lecturer/classes')} className="btn-primary">
            Open a session <ArrowUpRight size={15} />
          </motion.button>
        }
      />

      {/* ── Live now: one tap back in ─────────────────────────── */}
      {liveClasses.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.snappy}
                    className="scanframe is-teal is-live" style={{ '--radius-molecular': '20px' }}>
          <div style={{
            padding: 'var(--space-4)', background: 'var(--bg-inverse)', color: 'var(--text-inverse)',
            borderRadius: 20, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <p className="kicker" style={{ color: 'color-mix(in srgb, var(--text-inverse) 65%, transparent)' }}>
              <span className="live-dot" /> Live now
            </p>
            {liveClasses.map(cls => (
              <div key={cls.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 650, fontSize: 'var(--text-lg)', letterSpacing: '-0.02em' }}>{cls.name}</p>
                  <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginTop: 2 }}>{cls.enrollmentCount ?? 0} enrolled</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link to={`/lecturer/session/${cls.activeSession.id}/projector`} className="btn-ghost"
                        style={{ color: 'var(--text-inverse)', borderColor: 'color-mix(in srgb, var(--text-inverse) 25%, transparent)', background: 'transparent' }}>
                    <Presentation size={15} /> Projector
                  </Link>
                  <motion.button whileTap={TAP.button} onClick={() => navigate(`/lecturer/session/${cls.activeSession.id}`)} className="btn-accent">
                    Open live view <ArrowUpRight size={15} />
                  </motion.button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Numbers ───────────────────────────────────────────── */}
      <AnimatedList className="grid-4">
        {CARDS.map((card, i) => (
          <AnimatedItem key={card.label} whileHover={{ y: -3 }} transition={SPRING.snappy}>
            <StatTile {...card} index={i + 1} />
          </AnimatedItem>
        ))}
      </AnimatedList>

      {/* ── Today + needs you ─────────────────────────────────── */}
      <div className="split">
        <Panel flush label={`Today / ${dateLine}`} title={todaySlots.length ? plural(todaySlots.length, 'timetabled class', 'timetabled classes') : 'Nothing timetabled today'}
               actions={<Link to="/lecturer/timetable" className="btn-ghost btn-sm"><CalendarClock size={14} /> Week</Link>}>
          {todaySlots.length ? (
            <ul style={{ listStyle: 'none' }}>
              {todaySlots.map(s => {
                const c = byId.get(s.classId);
                const go = s.session ? (s.session.status === 'open' ? `/lecturer/session/${s.session.id}` : `/lecturer/session/${s.session.id}/roster`) : `/lecturer/classes/${s.classId}`;
                return (
                  <li key={s.id}>
                    <Link to={go} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) auto auto', gap: 12, alignItems: 'center', padding: '12px 18px', borderTop: '1px solid var(--border)', color: 'inherit', textDecoration: 'none' }}>
                      <span className="tabular" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.start}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{classLabel(c?.code, c?.name)}</span>
                        <span className="c-muted" style={{ fontSize: 12.5 }}>{s.session ? `${s.session.scanned}/${c?.enrolled ?? 0} scanned` : c?.location ?? `${s.duration} min`}</span>
                      </span>
                      <StatusPill showSweep={false}
                        status={{ held: 'closed', live: 'live', missed: 'absent', blocked: 'pending', upcoming: 'scheduled' }[s.state]}
                        label={{ held: 'Held', live: 'Live', missed: 'Not held', blocked: 'No classes', upcoming: 'Later' }[s.state]} />
                      <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty icon={CalendarClock} title="A clear day">Add weekly times to a class and sessions open on their own.</Empty>
          )}
        </Panel>

        <Panel label="Needs you" title={pendingRequests || atRisk ? 'Waiting on a decision' : 'Nothing waiting'}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <NeedRow to="/lecturer/requests" icon={Inbox} n={pendingRequests} one="request to review" many="requests to review" none="No appeals or excuse requests waiting" />
            <NeedRow to="/lecturer/alerts" icon={TriangleAlert} n={atRisk} one="student below a minimum" many="students below a minimum" none="Every student is above their minimum" tone="red" />
          </ul>
        </Panel>
      </div>

      {/* ── Trend ─────────────────────────────────────────────── */}
      <Panel label="Last 14 days / days with sessions" title="Attendance trend"
             actions={trend.length >= 2 && <StatusPill status="approved" label={`${stats?.avgAttendance ?? 0}% average`} showSweep={false} />}>
        {trend.length >= 2
          ? <TrendLine data={trend} height={230} label="Attendance rate by day" />
          : <div className="dt-empty" style={{ height: 180, display: 'grid', placeItems: 'center' }}>
              {statsLoading ? 'Loading attendance…' : classes.length === 0
                ? 'Create a class and hold a session; attendance starts charting here.'
                : 'Hold a couple of sessions and the 14-day trend appears here.'}
            </div>}
      </Panel>

      {/* ── Classes ───────────────────────────────────────────── */}
      {classes.length > 0 && (
        <Panel flush label="Your classes" title={plural(classes.length, 'class', 'classes')}
               actions={<Link to="/lecturer/classes" className="btn-ghost btn-sm">All classes <ArrowUpRight size={14} /></Link>}>
          <ul style={{ listStyle: 'none' }}>
            {classes.slice(0, 6).map(cls => (
              <li key={cls.id}>
                <Link to={`/lecturer/classes/${cls.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: '1px solid var(--border)', color: 'inherit', textDecoration: 'none' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brand-text)', fontSize: 13, width: 84, flexShrink: 0 }}>{cls.code}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.name}</span>
                    <span className="c-muted" style={{ fontSize: 12.5 }}>{plural(cls.enrollmentCount ?? 0, 'student')}{cls.myRole && cls.myRole !== 'owner' ? ` · shared by ${cls.lecturer?.name ?? 'a colleague'}` : ''}</span>
                  </span>
                  {cls.activeSession && <StatusPill status="live" label="Live" showSweep={false} />}
                  <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </PageShell>
  );
}

function NeedRow({ to, icon: Icon, n, one, many, none, tone = 'amber' }) {
  return (
    <li>
      <Link to={to} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'inherit', textDecoration: 'none', padding: '6px 0' }}>
        <span aria-hidden="true" style={{
          width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0,
          background: n ? `var(--${tone}-bg)` : 'var(--bg-raised)', color: n ? `var(--${tone})` : 'var(--text-muted)',
        }}><Icon size={16} /></span>
        <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: n ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: n ? 600 : 400 }}>
          {n ? `${n} ${n === 1 ? one : many}` : none}
        </span>
        <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
      </Link>
    </li>
  );
}

// The lecturer at-risk endpoint groups students by class; count people once.
function riskCount(data) {
  return new Set((data?.classes ?? []).flatMap(c => c.students.map(s => s.studentId))).size;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
