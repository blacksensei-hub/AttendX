import { useMemo, memo }                from 'react';
import { useQuery }                    from '@tanstack/react-query';
import { motion }                      from 'framer-motion';
import {
  BookOpen, Users, BarChart3, TrendingUp,
  ArrowUpRight,
}                                      from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
}                                      from 'recharts';
import { format, subDays }             from 'date-fns';
import { useNavigate }                 from 'react-router-dom';

import { classService }                from '../../services/classService';
import { useAuthStore }                from '../../store/authStore';
import api                             from '../../services/api';

import PageShell                       from '../../components/layout/PageShell';
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
 * Memoization changes:
 *   • Trend fallback data generated ONCE via useMemo (was being
 *     regenerated with new random values on every render — caused
 *     chart flicker)
 *   • Stat cards array memoized so AnimatedList children don't
 *     get fresh object references on unrelated renders
 *   • RecentClassRow wrapped in memo with custom comparator
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

  const { data: stats } = useQuery({
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
    {
      label:  'Total Classes',
      value:  classes.length,
      icon:   BookOpen,
      color:  'var(--brand)',
      bg:     'var(--brand-subtle)',
      border: 'var(--brand-border)',
    },
    {
      label:  'Total Students',
      value:  totalStudents,
      icon:   Users,
      color:  'var(--violet)',
      bg:     'var(--violet-bg)',
      border: 'var(--violet-border)',
    },
    {
      label:  'Active Sessions',
      value:  activeSessions,
      icon:   BarChart3,
      color:  'var(--green)',
      bg:     'var(--green-bg)',
      border: 'var(--green-border)',
    },
    {
      label:  'Avg Attendance',
      value:  `${avgAttendance}%`,
      icon:   TrendingUp,
      color:  'var(--amber)',
      bg:     'var(--amber-bg)',
      border: 'var(--amber-border)',
    },
  ], [classes.length, totalStudents, activeSessions, avgAttendance]);

  // Trend data — bug fix: was calling generateMockTrend() on every
  // render, which uses Math.random() so the chart flickered with
  // new values constantly. Now stable until real stats arrive.
  const trendData = useMemo(
    () => stats?.trend ?? generateMockTrend(14),
    [stats?.trend]
  );

  // Recent classes slice — memoized so RecentClassRow children
  // see stable refs for the iteration.
  const recentClasses = useMemo(() => classes.slice(0, 4), [classes]);

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Welcome header ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.gentle}
      >
        <h1 style={{
          fontFamily:    'var(--font-display)',
          fontSize:      'var(--text-2xl)',
          fontWeight:    700,
          color:         'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight:    1.15,
        }}>
          Good {getGreeting()},{' '}
          <span className="gradient-text">
            {user?.name?.split(' ')[0]}
          </span>
        </h1>
        <p style={{
          color:     'var(--text-muted)',
          fontSize:  'var(--text-md)',
          marginTop: '6px',
        }}>
          Here's what's happening in your classes today.
        </p>
      </motion.div>

      {/* ── Metric cards ────────────────────────────────────── */}
      <AnimatedList
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap:                 'var(--space-3)',
        }}
      >
        {CARDS.map(card => (
          <AnimatedItem
            key={card.label}
            whileHover={{ y: -3 }}
            transition={SPRING.snappy}
          >
            <StatCard {...card} />
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
          <div>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
              color:      'var(--text-primary)',
            }}>
              Attendance Trend
            </h3>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-xs)',
              marginTop: '2px',
            }}>
              Last 14 days across all classes
            </p>
          </div>
          <StatusPill
            status="approved"
            label={`${avgAttendance}% avg`}
            showSweep={false}
            icon={TrendingUp}
            size="md"
          />
        </div>

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
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
              color:      'var(--text-primary)',
            }}>
              Recent classes
            </h3>
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

// ─── Stat card — memoized leaf component ───────────────────────
// Splitting this out and memoizing means hover state on one card
// doesn't trigger re-renders on the other three.
const StatCard = memo(function StatCard({ label, value, icon: Icon, color, bg, border }) {
  return (
    <div style={{
      position:     'relative',
      background:   'var(--bg-card)',
      borderRadius: 'var(--radius-molecular)',
      padding:      'var(--space-3)',
      boxShadow:    'var(--shadow-md)',
      overflow:     'hidden',
      height:       '100%',
    }}>
      <div style={{
        position:   'absolute',
        top:        '-40px',
        right:      '-40px',
        width:      '120px',
        height:     '120px',
        background: bg,
        filter:     'blur(40px)',
        opacity:    0.7,
        pointerEvents: 'none',
      }} />

      <div style={{
        position:       'relative',
        width:          '40px',
        height:         '40px',
        borderRadius:   'var(--radius-atomic)',
        background:     bg,
        border:         `1px solid ${border}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        marginBottom:   'var(--space-2)',
      }}>
        <Icon size={18} style={{ color }} />
      </div>

      <p style={{
        position:   'relative',
        fontFamily: 'var(--font-display)',
        fontSize:   'var(--text-2xl)',
        fontWeight: 700,
        color,
        lineHeight: 1.1,
      }}>
        {value}
      </p>
      <p style={{
        position:  'relative',
        color:     'var(--text-muted)',
        fontSize:  'var(--text-sm)',
        marginTop: '4px',
      }}>
        {label}
      </p>
    </div>
  );
});

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

function generateMockTrend(days) {
  return Array.from({ length: days }, (_, i) => ({
    date: subDays(new Date(), days - i - 1).toISOString(),
    rate: Math.floor(65 + Math.random() * 30),
  }));
}