import { useState, useMemo, useEffect }         from 'react';
import { useQuery }                             from '@tanstack/react-query';
import { useNavigate }                          from 'react-router-dom';
import { motion, AnimatePresence }              from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
}                                               from 'recharts';
import {
  AlertTriangle, Radio, ArrowRight, X,
  BookOpen, CheckCircle, Sparkles, TrendingUp,
  LineChart as LineChartIcon,
}                                               from 'lucide-react';

import { classService }                         from '../../services/classService';
import { sessionService }                       from '../../services/sessionService';
import { useAuthStore }                         from '../../store/authStore';
import api                                      from '../../services/api';

import PageShell, { PageHeader }                from '../../components/layout/PageShell';
import StatTile, { SectionTitle }               from '../../components/ui/StatTile';
import { AnimatedList, AnimatedItem }           from '../../components/ui/AnimatedList';
import { SPRING, TAP, EASE }                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * StudentDashboard — the first surface every student sees.
 *
 * Designed around the three things a student needs fastest:
 *   1. Am I at risk? (threshold banner at the top, red if so)
 *   2. Is anything live right now? (active session banner)
 *   3. Where do I stand? (stats + per-class progress)
 *
 * The at-risk banner is dismissable but smart-persistent: dismissing
 * it is recorded with a fingerprint of the current at-risk state.
 * If your attendance gets worse later (lower rate, or new at-risk
 * class), the fingerprint changes and the warning re-fires.
 *
 * The cleanup-on-recovery effect is gated on the rates query being
 * settled — without that gate, it would fire during the brief
 * loading window where atRisk is empty just because data hasn't
 * arrived yet, wiping the dismissal on every page refresh.
 * ═════════════════════════════════════════════════════════════════
 */
export default function StudentDashboard() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();

  // ── Data ─────────────────────────────────────────────────────
  const { data: classData } = useQuery({
    queryKey: ['enrolled-classes'],
    queryFn:  classService.getEnrolledClasses,
  });
  const classes = classData?.classes ?? [];

  const { data: sessionData } = useQuery({
    queryKey:        ['active-sessions'],
    queryFn:         sessionService.getActiveSessions,
    refetchInterval: 30_000,
  });
  const activeSessions = sessionData?.sessions ?? [];

  const { data: statsData } = useQuery({
    queryKey: ['student-stats'],
    queryFn:  () => api.get('/reports/student-stats').then(r => r.data),
  });
  const myStats = statsData ?? {};
  // attended/attendanceRate are newer fields; derive them if the API
  // is an older build that doesn't send them yet.
  const attended    = myStats.attended ?? (myStats.present ?? 0) + (myStats.late ?? 0);
  const allTimeRate = myStats.attendanceRate
    ?? (myStats.totalSessions ? Math.round((attended / myStats.totalSessions) * 100) : 0);

  // isPending exposed so the warning-cleanup effect knows whether
  // to trust an empty atRisk array or wait for data to arrive
  const { data: ratesData, isPending: ratesLoading } = useQuery({
    queryKey:        ['my-attendance-rates'],
    queryFn:         () => api.get('/thresholds/my-rates').then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
  });
  const rates  = ratesData?.rates ?? [];
  const atRisk = rates.filter(r => r.atRisk);

  // ── At-risk dismissal state ──────────────────────────────────
  // Smart-persistent: store a fingerprint of which classes are at
  // risk and at what %. If any class drops further, or a new class
  // enters at-risk status, the fingerprint changes and the warning
  // automatically re-fires.
  const fingerprint = useMemo(
    () =>
      atRisk
        .map(r => `${r.classId}:${r.attendanceRate}`)
        .sort()
        .join('|'),
    [atRisk]
  );

  const [dismissedFingerprint, setDismissedFingerprint] = useState(() => {
    try {
      return localStorage.getItem('attendx:dismissed-warning') ?? null;
    } catch { return null; }
  });

  const showWarning = atRisk.length > 0 && fingerprint !== dismissedFingerprint;

  const dismissWarning = () => {
    try {
      localStorage.setItem('attendx:dismissed-warning', fingerprint);
    } catch { /* ignore quota errors */ }
    setDismissedFingerprint(fingerprint);
  };

  // Clean up the stored dismissal once the user is out of the
  // at-risk woods, so a future at-risk situation starts fresh.
  //
  // Gated on `!ratesLoading` to avoid firing during the loading
  // window — that bug caused the warning to re-pop on every page
  // refresh because the cleanup ran before queries returned data.
  // Only storage is touched here; the in-memory copy can stay, since
  // a future at-risk state has a different fingerprint and shows anyway.
  useEffect(() => {
    if (!ratesLoading && atRisk.length === 0) {
      try { localStorage.removeItem('attendx:dismissed-warning'); } catch { /* storage blocked */ }
    }
  }, [ratesLoading, atRisk.length]);

  // ── Charts data ──────────────────────────────────────────────
  const pieData = [
    { name: 'Present', value: myStats?.present ?? 0, color: 'var(--green-fill)' },
    { name: 'Late',    value: myStats?.late    ?? 0, color: 'var(--amber-fill)' },
    { name: 'Absent',  value: myStats?.absent  ?? 0, color: 'var(--red-fill)'   },
  ];

  // The trend chart needs at least 2 points to be meaningful. If
  // the backend hasn't shipped one or the student has no history
  // yet, render a clean empty state instead of a blank grid.
  const trendData = Array.isArray(myStats?.trend) ? myStats.trend : [];
  const hasTrend  = trendData.length >= 2;

  const STAT_CARDS = [
    { label: 'This month',        value: `${myStats?.thisMonth ?? 0}%`,  tone: 'green',  featured: true, hint: `Across every class this month · ${allTimeRate}% all time` },
    { label: 'Sessions attended', value: attended,                        tone: 'brand',  hint: `Present or late, of ${myStats?.totalSessions ?? 0} held` },
    { label: 'On time',           value: `${myStats?.onTimeRate ?? 0}%`, tone: 'amber',  hint: 'Of the sessions you attended' },
    { label: 'Classes',           value: classes.length,                 tone: 'violet', hint: 'Enrolled this semester' },
  ];

  const firstName = user?.name?.split(' ')[0] ?? '';
  const today     = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Welcome header ──────────────────────────────────── */}
      <PageHeader
        kicker={`Student / ${today}`}
        title="Hi,"
        accent={`${firstName}.`}
        subtitle={activeSessions.length > 0
          ? `${activeSessions.length} session${activeSessions.length !== 1 ? 's are' : ' is'} open right now. Mark your seat before it closes.`
          : 'Nothing is open right now. The moment a lecturer starts a session, it shows up here.'}
        action={
          <motion.button
            whileTap={TAP.button}
            onClick={() => navigate('/student/scan')}
            className="btn-primary"
          >
            <Radio size={15} /> Open scanner
          </motion.button>
        }
      />

      {/* ── At-risk threshold warning (dismissable) ──────────── */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98, height: 'auto' }}
            animate={{ opacity: 1, y: 0, scale: 1, height: 'auto' }}
            exit={{ opacity: 0, y: -8, scale: 0.98, height: 0, marginBottom: -16 }}
            transition={SPRING.snappy}
            style={{
              padding:      'var(--space-3)',
              background:   'var(--red-bg)',
              border:       '1px solid var(--red-border)',
              borderRadius: 'var(--radius-molecular)',
              boxShadow:    'var(--shadow-sm)',
              position:     'relative',
              overflow:     'hidden',
            }}
          >
            {/* Dismiss button — top right */}
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={TAP.button}
              onClick={dismissWarning}
              aria-label="Dismiss warning"
              style={{
                position:        'absolute',
                top:             '10px',
                right:           '10px',
                width:           '28px',
                height:          '28px',
                borderRadius:    'var(--radius-atomic)',
                background:      'var(--bg-card)',
                border:          '1px solid var(--red-border)',
                color:           'var(--red)',
                cursor:          'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                padding:         0,
                zIndex:          1,
              }}
            >
              <X size={14} strokeWidth={2.4} />
            </motion.button>

            <div style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          'var(--space-2)',
              marginBottom: 'var(--space-3)',
              paddingRight: '36px',  // clear the dismiss button
            }}>
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{
                  duration: 2,
                  ease:     EASE.state,
                  repeat:   Infinity,
                  repeatDelay: 1,
                }}
                style={{
                  width:          '36px',
                  height:         '36px',
                  borderRadius:   'var(--radius-atomic)',
                  background:     'var(--red-bg)',
                  border:         '1px solid var(--red-border)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}
              >
                <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
              </motion.div>
              <div>
                <p style={{
                  color:      'var(--red)',
                  fontWeight: 700,
                  fontSize:   'var(--text-sm)',
                  fontFamily: 'var(--font-display)',
                }}>
                  Attendance warning
                </p>
                <p style={{
                  color:      'var(--text-secondary)',
                  fontSize:   'var(--text-xs)',
                  marginTop:  '2px',
                  lineHeight: 1.5,
                }}>
                  Your attendance in the following{' '}
                  {atRisk.length === 1 ? 'class is' : 'classes are'} below the required minimum
                </p>
              </div>
            </div>

            <AnimatedList
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {atRisk.map(r => {
                const sessionsNeeded = r.totalSessions > 0
                  ? Math.max(0, Math.ceil(
                      (r.threshold / 100 * r.totalSessions) - r.attended
                    ))
                  : 0;

                return (
                  <AnimatedItem key={r.classId}>
                    <div style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      flexWrap:       'wrap',
                      gap:            'var(--space-2)',
                      background:     'var(--bg-card)',
                      border:         '1px solid var(--red-border)',
                      borderRadius:   'var(--radius-atomic)',
                      padding:        '10px 14px',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{
                          color:      'var(--text-primary)',
                          fontWeight: 600,
                          fontSize:   'var(--text-sm)',
                        }}>
                          {r.className}
                        </p>
                        <p style={{
                          color:     'var(--text-muted)',
                          fontSize:  'var(--text-xs)',
                          marginTop: '2px',
                        }}>
                          {r.attended} of {r.totalSessions} sessions attended
                          {sessionsNeeded > 0 && (
                            <span style={{
                              color:     'var(--red)',
                              marginLeft: '6px',
                              fontWeight: 500,
                            }}>
                              · attend {sessionsNeeded} more to reach {r.threshold}%
                            </span>
                          )}
                        </p>
                      </div>

                      <div style={{
                        display:    'flex',
                        alignItems: 'center',
                        gap:        '6px',
                        flexShrink: 0,
                      }}>
                        <span style={{
                          background:    'var(--red-bg)',
                          color:         'var(--red)',
                          borderRadius:  'var(--radius-pill)',
                          fontSize:      'var(--text-sm)',
                          fontWeight:    700,
                          padding:       '4px 12px',
                          fontFamily:    'var(--font-mono)',
                          border:        '1px solid var(--red-border)',
                        }}>
                          {r.attendanceRate}%
                        </span>
                        <span style={{
                          color:    'var(--text-muted)',
                          fontSize: 'var(--text-xs)',
                        }}>
                          / {r.threshold}% min
                        </span>
                      </div>
                    </div>
                  </AnimatedItem>
                );
              })}
            </AnimatedList>

            <p style={{
              color:      'var(--text-muted)',
              fontSize:   'var(--text-xs)',
              marginTop:  'var(--space-2)',
              lineHeight: 1.5,
            }}>
              Contact your lecturer if you believe there is an error. You can also submit an attendance appeal from your{' '}
              <motion.button
                whileTap={TAP.button}
                onClick={() => navigate('/student/history')}
                style={{
                  background:     'none',
                  border:         'none',
                  padding:        0,
                  color:          'var(--brand-text)',
                  cursor:         'pointer',
                  fontWeight:     600,
                  fontSize:       'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                attendance history
              </motion.button>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active sessions: the one thing to do right now ──── */}
      {activeSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
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
          }}>
            <p className="kicker" style={{ color: 'color-mix(in srgb, var(--text-inverse) 65%, transparent)', marginBottom: 'var(--space-3)' }}>
              <span className="live-dot" /> Live now / mark your seat
            </p>
            <AnimatedList style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeSessions.map(session => {
                const marked = session.markedStatus;
                return (
                  <AnimatedItem key={session.id}>
                    <div style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      gap:            'var(--space-3)',
                      flexWrap:       'wrap',
                      paddingTop:     10,
                      borderTop:      '1px solid color-mix(in srgb, var(--text-inverse) 14%, transparent)',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{
                          fontFamily:    'var(--font-display)',
                          fontWeight:    650,
                          fontSize:      'var(--text-lg)',
                          letterSpacing: '-0.02em',
                        }}>
                          {session.className}
                        </p>
                        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginTop: 2 }}>
                          {session.title || 'Attendance session'}
                        </p>
                      </div>
                      {marked ? (
                        <span className="kicker" style={{ color: 'var(--green-fill)' }}>
                          <CheckCircle size={14} /> Marked{marked === 'late' ? ' (late)' : ''}
                        </span>
                      ) : (
                        <motion.button
                          whileTap={TAP.button}
                          whileHover={{ x: 2 }}
                          transition={SPRING.snappy}
                          onClick={() => navigate(`/student/scan?sessionId=${session.id}`)}
                          className="btn-accent"
                          style={{ flexShrink: 0 }}
                        >
                          Mark attendance <ArrowRight size={15} />
                        </motion.button>
                      )}
                    </div>
                  </AnimatedItem>
                );
              })}
            </AnimatedList>
          </div>
        </motion.div>
      )}

      {/* ── Stats ──────────────────────────────────────────── */}
      <AnimatedList className="grid-4">
        {STAT_CARDS.map((card, i) => (
          <AnimatedItem key={card.label} whileHover={{ y: -3 }} transition={SPRING.snappy}>
            <StatTile {...card} index={i + 1} />
          </AnimatedItem>
        ))}
      </AnimatedList>

      {/* ── Per-class attendance summary ────────────────────── */}
      {rates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.gentle, delay: 0.1 }}
          style={{
            background:   'var(--bg-card)',
            borderRadius: 'var(--radius-molecular)',
            padding:      'var(--space-4)',
            boxShadow:    'var(--shadow-md)',
          }}
        >
          <SectionTitle kicker="By class" title="Where you stand" style={{ marginBottom: 'var(--space-4)' }} />

          <AnimatedList
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {rates.map(r => (
              <AnimatedItem key={r.classId}>
                <ClassRateRow r={r} />
              </AnimatedItem>
            ))}
          </AnimatedList>

          <p style={{
            color:     'var(--text-muted)',
            fontSize:  'var(--text-xs)',
            marginTop: 'var(--space-3)',
          }}>
            The marker line on each bar shows the minimum threshold for that class.
          </p>
        </motion.div>
      )}

      {/* ── Charts row ──────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gap:                 'var(--space-3)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      }}>

        {/* Area chart — empty state when there's no trend data */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.gentle, delay: 0.2 }}
          style={{
            background:   'var(--bg-card)',
            borderRadius: 'var(--radius-molecular)',
            padding:      'var(--space-4)',
            boxShadow:    'var(--shadow-md)',
          }}
        >
          <SectionTitle kicker="Trend" title="Your attendance over time" style={{ marginBottom: 'var(--space-3)' }} />

          {hasTrend ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="studentTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--green)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date"
                       tickFormatter={d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                       tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                       domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip
                  formatter={v => [`${v}%`, 'Attendance']}
                  labelFormatter={d => `Week of ${new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  cursor={{ stroke: 'var(--green)', strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={{
                    background:    'var(--bg-card)',
                    border:        '1px solid var(--border)',
                    borderRadius:  'var(--radius-atomic)',
                    color:         'var(--text-primary)',
                    boxShadow:     'var(--shadow-lg)',
                    fontSize:      'var(--text-sm)',
                  }}
                />
                <Area
                  type="monotone" dataKey="rate"
                  stroke="var(--green)" strokeWidth={2.5}
                  fill="url(#studentTrend)" dot={false}
                  activeDot={{ r: 5, fill: 'var(--green)',
                               stroke: 'var(--bg-card)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmptyState
              icon={LineChartIcon}
              title="Not enough data yet"
              subtitle="Mark attendance in a few sessions to see your trend over time."
            />
          )}
        </motion.div>

        {/* Pie chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.gentle, delay: 0.25 }}
          style={{
            background:     'var(--bg-card)',
            borderRadius:   'var(--radius-molecular)',
            padding:        'var(--space-4)',
            boxShadow:      'var(--shadow-md)',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            minWidth:       '200px',
          }}
        >
          <SectionTitle kicker="All time" title="Breakdown" style={{ marginBottom: 'var(--space-2)', alignSelf: 'stretch' }} />

          <PieChart width={160} height={160}>
            <Pie
              data={pieData} cx={80} cy={80}
              innerRadius={48} outerRadius={68}
              paddingAngle={3} dataKey="value"
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>

          <div style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           '6px',
            marginTop:     'var(--space-2)',
            alignSelf:     'stretch',
          }}>
            {pieData.map(({ name, value, color }) => (
              <div key={name} style={{
                display:     'flex',
                alignItems:  'center',
                gap:         'var(--space-2)',
                fontSize:    'var(--text-sm)',
              }}>
                <div style={{
                  width:        '10px',
                  height:       '10px',
                  borderRadius: 'var(--radius-pill)',
                  background:   color,
                  flexShrink:   0,
                }} />
                <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                  {name}
                </span>
                <span style={{
                  color:      'var(--text-primary)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </PageShell>
  );
}

// ─── Empty state for charts ────────────────────────────────────
// Used when there isn't enough data to render the chart meaningfully.
// Same height as a real chart so the layout doesn't jump.
function ChartEmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div style={{
      height:         '200px',
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
        width:           '40px',
        height:          '40px',
        borderRadius:    'var(--radius-atomic)',
        background:      'var(--brand-subtle)',
        border:          '1px solid var(--brand-border)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
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
          maxWidth:   '280px',
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Per-class rate row ────────────────────────────────────────
function ClassRateRow({ r }) {
  const rate = r.attendanceRate;

  // Three-tier colour logic based on threshold proximity:
  // - below threshold          → red (action needed)
  // - within 10% of threshold  → amber (warning)
  // - comfortably above        → green (safe)
  const color = rate === null
    ? 'var(--text-muted)'
    : rate < r.threshold
      ? 'var(--red)'
      : rate < r.threshold + 10
        ? 'var(--amber)'
        : 'var(--green)';

  const bgColor = rate === null
    ? 'var(--bg-raised)'
    : rate < r.threshold
      ? 'var(--red-bg)'
      : rate < r.threshold + 10
        ? 'var(--amber-bg)'
        : 'var(--green-bg)';

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap:        'var(--space-3)',
      flexWrap:   'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          color:        'var(--text-primary)',
          fontWeight:   600,
          fontSize:     'var(--text-sm)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {r.className}
        </p>
        <p style={{
          color:     'var(--text-muted)',
          fontSize:  'var(--text-xs)',
          marginTop: '2px',
        }}>
          {r.totalSessions === 0
            ? 'No sessions held yet'
            : `${r.attended} of ${r.totalSessions} sessions`}
        </p>
      </div>

      {/* Progress bar with threshold marker */}
      <div style={{ flex: 2, minWidth: '140px', maxWidth: '220px', position: 'relative' }}>
        <div style={{
          height:       '8px',
          background:   'var(--bg-raised)',
          borderRadius: 'var(--radius-pill)',
          overflow:     'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(rate ?? 0, 100)}%` }}
            transition={{ duration: 0.8, ease: EASE.entry }}
            style={{
              height:       '100%',
              background:   color,
              borderRadius: 'var(--radius-pill)',
            }}
          />
        </div>

        {/* Threshold marker line */}
        <div style={{
          position:     'absolute',
          left:         `${r.threshold}%`,
          top:          '-2px',
          width:        '2px',
          height:       '10px',
          background:   'var(--text-secondary)',
          borderRadius: '1px',
        }} />
      </div>

      {/* Rate badge */}
      <span style={{
        background:   bgColor,
        color,
        borderRadius: 'var(--radius-pill)',
        fontSize:     'var(--text-sm)',
        fontWeight:   700,
        padding:      '4px 12px',
        fontFamily:   'var(--font-mono)',
        flexShrink:   0,
        minWidth:     '56px',
        textAlign:    'center',
        border:       '1px solid',
        borderColor:  color,
      }}>
        {rate !== null ? `${rate}%` : '—'}
      </span>
    </div>
  );
}