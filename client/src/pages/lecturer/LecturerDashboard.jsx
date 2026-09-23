import { useMemo, memo }                from 'react';
import { useQuery }                    from '@tanstack/react-query';
import { motion }                      from 'framer-motion';
import {
  TrendingUp, ArrowUpRight, LineChart as LineChartIcon,
}                                      from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
}                                      from 'recharts';
import { format }                      from 'date-fns';
import { useNavigate }                 from 'react-router-dom';

import { classService }                from '../../services/classService';
import { useAuthStore }                from '../../store/authStore';
import api                             from '../../services/api';

import PageShell, { PageHeader }       from '../../components/layout/PageShell';
import StatTile, { SectionTitle }      from '../../components/ui/StatTile';
import StatusPill                      from '../../components/ui/StatusPill';
import {
  AnimatedList, AnimatedItem,
}                                      from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
}                                      from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * LecturerDashboard — the first surface every lecturer sees.
 *
 * Memoization notes:
 *   • Stat cards array memoized so AnimatedList children don't
 *     get fresh object references on unrelated renders
 *   • RecentClassRow wrapped in memo with custom comparator
 *
 * The trend chart previously fell back to generateMockTrend() —
 * randomly generated 65-95% values — whenever the API returned no
 * trend data. That produced a confident-looking attendance curve on
 * accounts with zero classes and zero sessions, which is worse than
 * showing nothing: it invites the reader to trust numbers that were
 * invented client-side. It now renders an explicit empty state
 * instead, matching the pattern already used on StudentDashboard.
 * ═════════════════════════════════════════════════════════════════
 */
export default function LecturerDashboard() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();

  // ── Data ─────────────────────────────────────────────────────
  const { data: classData } = useQuery({
    queryKey: ['classes'],
    queryFn:  classService.getMyClasses,
  });
  const classes = classData?.classes ?? [];

  const { data: stats, isPending: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  () => api.get('/reports/dashboard').then(r => r.data),
  });

  // ── Derived metrics ──────────────────────────────────────────
  // O(N) scans are cheap with reasonable class counts, but we still
  // memoize so derived values are stable references for downstream
  // memoized components.
  const { totalStudents, activeSessions, avgAttendance } = useMemo(() => ({
    totalStudents:  classes.reduce((a, c) => a + (c.enrollmentCount ?? 0), 0),
    activeSessions: classes.filter(c => c.activeSession).length,
    avgAttendance:  stats?.avgAttendance ?? 0,
  }), [classes, stats?.avgAttendance]);

  // Stat cards — memoized so AnimatedItem children don't get
  // fresh object refs on every parent render.
  const CARDS = useMemo(() => [
    { label: 'Avg attendance',  value: `${avgAttendance}%`, tone: 'green',  featured: true, framed: activeSessions === 0, hint: 'Across all your classes, last 14 days' },
    { label: 'Live now',        value: activeSessions,       tone: 'brand',  hint: activeSessions ? 'Sessions taking attendance' : 'No sessions open' },
    { label: 'Students',        value: totalStudents,        tone: 'violet', hint: 'Enrolled across your classes' },
    { label: 'Classes',         value: classes.length,       tone: 'amber',  hint: 'You teach this semester' },
  ], [classes.length, totalStudents, activeSessions, avgAttendance]);

  const liveClasses = useMemo(() => classes.filter(c => c.activeSession), [classes]);
  const today       = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // Real data only — no synthetic fallback. A single point can't form
  // a trend line, so we need at least two before the chart says
  // anything meaningful.
  const trendData = useMemo(
    () => (Array.isArray(stats?.trend) ? stats.trend : []),
    [stats?.trend]
  );
  const hasTrend = trendData.length >= 2;

  // Recent classes slice — memoized so RecentClassRow children
  // see stable refs for the iteration.
  const recentClasses = useMemo(() => classes.slice(0, 4), [classes]);

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Welcome header ──────────────────────────────────── */}
      <PageHeader
        kicker={`Lecturer / ${today}`}
        title={`Good ${getGreeting()},`}
        accent={`${user?.name?.split(' ')[0] ?? ''}.`}
        subtitle={liveClasses.length
          ? `${liveClasses.length} session${liveClasses.length !== 1 ? 's are' : ' is'} taking attendance right now.`
          : "Here's how your classes are doing."}
        action={
          <motion.button
            whileTap={TAP.button}
            onClick={() => navigate('/lecturer/classes')}
            className="btn-primary"
          >
            Open a session <ArrowUpRight size={15} />
          </motion.button>
        }
      />

      {/* ── Live sessions: jump straight back in ──────────────── */}
      {liveClasses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.snappy}
          className="scanframe is-teal is-live"
          style={{ '--radius-molecular': '20px' }}
        >
          <div style={{
            padding:      'var(--space-4)',
            background:   'var(--bg-inverse)',
            color:        'var(--text-inverse)',
            borderRadius: 20,
            boxShadow:    'var(--shadow-lg)',
            display:      'flex',
            flexDirection:'column',
            gap:          12,
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
                <motion.button
                  whileTap={TAP.button}
                  onClick={() => navigate(`/lecturer/session/${cls.activeSession.id}`)}
                  className="btn-accent"
                >
                  Open live view <ArrowUpRight size={15} />
                </motion.button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Metric cards ────────────────────────────────────── */}
      <AnimatedList className="grid-4">
        {CARDS.map((card, i) => (
          <AnimatedItem
            key={card.label}
            whileHover={{ y: -3 }}
            transition={SPRING.snappy}
          >
            <StatTile {...card} index={i + 1} />
          </AnimatedItem>
        ))}
      </AnimatedList>

      {/* ── Attendance trend chart ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING.gentle, delay: 0.15 }}
        style={{
          background:   'var(--bg-card)',
          borderRadius: 'var(--radius-molecular)',
          padding:      'var(--space-4)',
          boxShadow:    'var(--shadow-md)',
        }}
      >
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   'var(--space-3)',
          flexWrap:       'wrap',
          gap:            'var(--space-2)',
        }}>
          <SectionTitle kicker="Last 14 days / all classes" title="Attendance trend" />
          {/* Only claim an average once there's real data behind it */}
          {hasTrend && (
            <StatusPill
              status="approved"
              label={`${avgAttendance}% avg`}
              showSweep={false}
              icon={TrendingUp}
              size="md"
            />
          )}
        </div>

        {hasTrend ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={trendData}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="dashboardTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--brand)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--brand)" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--border)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickFormatter={d => format(new Date(d), 'dd MMM')}
              />
              <YAxis
                stroke="var(--border)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                cursor={{ stroke: 'var(--brand)', strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={{
                  background:    'var(--bg-card)',
                  border:        '1px solid var(--border)',
                  borderRadius:  'var(--radius-atomic)',
                  color:         'var(--text-primary)',
                  fontSize:      'var(--text-sm)',
                  boxShadow:     'var(--shadow-lg)',
                  padding:       '8px 12px',
                }}
                formatter={(v) => [`${v}%`, 'Attendance']}
                labelFormatter={d => format(new Date(d), 'dd MMM yyyy')}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="var(--brand)"
                strokeWidth={2.5}
                fill="url(#dashboardTrendGradient)"
                dot={false}
                activeDot={{
                  r:           5,
                  fill:        'var(--brand)',
                  stroke:      'var(--bg-card)',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmptyState
            icon={LineChartIcon}
            title={statsLoading ? 'Loading attendance data…' : 'No attendance data yet'}
            subtitle={
              statsLoading
                ? null
                : classes.length === 0
                  ? 'Create a class and hold a session — attendance will start charting here.'
                  : 'Hold a couple of sessions and the 14-day trend will appear here.'
            }
          />
        )}
      </motion.div>

      {/* ── Recent classes ──────────────────────────────────── */}
      {recentClasses.length > 0 && (
        <div>
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   'var(--space-3)',
          }}>
            <SectionTitle kicker="Your classes" title="Recent classes" />
            <motion.button
              whileTap={TAP.button}
              whileHover={{ x: 2 }}
              transition={SPRING.snappy}
              onClick={() => navigate('/lecturer/classes')}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '4px',
                background:   'none',
                border:       'none',
                color:        'var(--brand-text)',
                cursor:       'pointer',
                fontSize:     'var(--text-sm)',
                fontWeight:   500,
                fontFamily:   'var(--font-body)',
              }}
            >
              View all
              <ArrowUpRight size={14} />
            </motion.button>
          </div>

          <AnimatedList
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           '8px',
            }}
          >
            {recentClasses.map(cls => (
              <AnimatedItem
                key={cls.id}
                whileHover={{ x: 3 }}
                transition={SPRING.snappy}
              >
                <RecentClassRow cls={cls} navigate={navigate} />
              </AnimatedItem>
            ))}
          </AnimatedList>
        </div>
      )}
    </PageShell>
  );
}

// ─── Chart empty state ─────────────────────────────────────────
// Mirrors the pattern used on StudentDashboard so an empty chart
// reads the same way across the app.
function ChartEmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div style={{
      height:         '240px',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            'var(--space-2)',
      padding:        'var(--space-3)',
      borderRadius:   'var(--radius-atomic)',
      border:         '1px dashed var(--border)',
      background:     'var(--bg-raised)',
    }}>
      <div style={{
        width:          '40px',
        height:         '40px',
        borderRadius:   'var(--radius-atomic)',
        background:     'var(--brand-subtle)',
        border:         '1px solid var(--brand-border)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}>
        <Icon size={18} style={{ color: 'var(--brand-text)' }} strokeWidth={2.2} />
      </div>
      <p style={{
        color:      'var(--text-primary)',
        fontWeight: 600,
        fontSize:   'var(--text-sm)',
        fontFamily: 'var(--font-display)',
        textAlign:  'center',
      }}>
        {title}
      </p>
      {subtitle && (
        <p style={{
          color:      'var(--text-muted)',
          fontSize:   'var(--text-xs)',
          textAlign:  'center',
          maxWidth:   '300px',
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Recent class row — memoized ──────────────────────────────
// Custom comparator: re-render only when the cls reference changes.
// `navigate` from useNavigate() is stable across renders, so it's
// safe to compare normally — but we ignore it in the comparator
// for clarity.
const RecentClassRow = memo(function RecentClassRow({ cls, navigate }) {
  const handleClick = () => {
    if (cls.activeSession) {
      navigate(`/lecturer/session/${cls.activeSession.id}`);
    } else {
      navigate('/lecturer/classes');
    }
  };

  return (
    <motion.div
      onClick={handleClick}
      whileTap={TAP.card}
      transition={SPRING.snappy}
      style={{
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-molecular)',
        padding:      'var(--space-3)',
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--space-3)',
        boxShadow:    'var(--shadow-sm)',
        cursor:       'pointer',
        transition:   `box-shadow ${DURATION.base}ms ${EASE.state}`,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
    >
      <div style={{
        width:          '40px',
        height:         '40px',
        background:     'var(--brand-subtle)',
        border:         '1px solid var(--brand-border)',
        borderRadius:   'var(--radius-atomic)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontFamily:     'var(--font-display)',
        fontWeight:     700,
        fontSize:       'var(--text-sm)',
        color:          'var(--brand-text)',
        flexShrink:     0,
      }}>
        {cls.name.slice(0, 2).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          color:        'var(--text-primary)',
          fontWeight:   600,
          fontSize:     'var(--text-sm)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {cls.name}
        </p>
        <p style={{
          color:     'var(--text-muted)',
          fontSize:  'var(--text-xs)',
          marginTop: '2px',
        }}>
          {cls.enrollmentCount ?? 0} student{cls.enrollmentCount !== 1 ? 's' : ''} enrolled
        </p>
      </div>

      {cls.activeSession && (
        <StatusPill status="live" label="Live" showSweep={false} />
      )}

      <span style={{
        fontFamily: 'var(--font-mono)',
        color:      'var(--brand-text)',
        fontSize:   'var(--text-sm)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}>
        {cls.code}
      </span>
    </motion.div>
  );
}, (prev, next) => prev.cls === next.cls);

// ─── Helpers ───────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}