import { useState, useEffect, useCallback }   from 'react';
import { View, Text }                         from 'react-native';
import { router }                             from 'expo-router';
import Animated, { FadeInUp }                 from 'react-native-reanimated';
import {
  BookOpen, Users, BarChart3, TrendingUp,
  Radio, ArrowRight, Hand,
}                                             from 'lucide-react-native';

import { useAuthStore }                       from '../../store/authStore';
import api                                    from '../../services/api';

import { useTheme }                           from '../../src/theme/ThemeProvider';
import Screen                                 from '../../src/components/ui/Screen';
import Card                                   from '../../src/components/ui/Card';
import Button                                 from '../../src/components/ui/Button';
import IconTile                               from '../../src/components/ui/IconTile';
import StatusPill                             from '../../src/components/ui/StatusPill';
import EmptyState                             from '../../src/components/ui/EmptyState';
import { DURATION }                           from '../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * LecturerDashboard
 *
 * Two parallel API calls:
 *   GET /classes           — list + active sessions + enrollment counts
 *   GET /reports/dashboard — { avgAttendance, totalSessions }
 *
 * If /reports/dashboard fails (e.g. no closed sessions yet) we
 * silently fall back to 0% rather than blocking the whole screen.
 *
 * When the lecturer has zero classes, an EmptyState card invites
 * them to head to the web app to create one (class CRUD is web-only
 * by design — see roadmap notes).
 * ═════════════════════════════════════════════════════════════════
 */
export default function LecturerDashboard() {
  const t    = useTheme();
  const user = useAuthStore(s => s.user);

  const [classes,       setClasses]       = useState([]);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  /* ── Data fetch ─────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      const [classesRes, statsRes] = await Promise.allSettled([
        api.get('/classes'),
        api.get('/reports/dashboard'),
      ]);

      // Classes — required
      if (classesRes.status === 'fulfilled') {
        const payload = classesRes.value.data?.data ?? classesRes.value.data ?? {};
        setClasses(payload.classes ?? []);
      } else {
        console.error('Classes fetch error:',
          classesRes.reason?.response?.data ?? classesRes.reason?.message);
      }

      // Stats — optional, fall back to 0 if it fails
      if (statsRes.status === 'fulfilled') {
        const payload = statsRes.value.data?.data ?? statsRes.value.data ?? {};
        setAvgAttendance(payload.avgAttendance ?? 0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  /* ── Derived values ─────────────────────────────────────── */
  const activeSessions = classes
    .filter(c => c.activeSession)
    .map(c => ({
      id:        c.activeSession.id,
      className: c.name,
      title:     c.activeSession.title,
    }));

  const totalStudents = classes.reduce(
    (sum, c) => sum + (c.enrollmentCount ?? 0), 0
  );

  const firstName = user?.name?.split(' ')[0] || 'there';

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} gap={t.spacing.md}>

      <Animated.View entering={FadeInUp.duration(DURATION.slow)}>
        <Greeting
          t={t}
          firstName={firstName}
          activeCount={activeSessions.length}
          loading={loading}
        />
      </Animated.View>

      {activeSessions.length > 0 && (
        <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
          <ActiveSessionsCard t={t} sessions={activeSessions} />
        </Animated.View>
      )}

      {/* Empty state when the lecturer has no classes yet.
          Shown only after loading completes — flashing an empty
          state during the initial fetch would be misleading. */}
      {!loading && classes.length === 0 && (
        <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
          <EmptyState
            icon={BookOpen}
            iconTone="brand"
            title="No classes yet"
            message="Create your first class on the web app to start running attendance sessions on mobile."
          />
        </Animated.View>
      )}

      {/* Stats grid is shown even when classes is empty — all zeros
          is genuinely informative (and looks better than a blank
          dashboard). Hide it only if you'd rather lead with the
          empty state alone. */}
      {(loading || classes.length > 0) && (
        <Animated.View entering={FadeInUp.delay(160).duration(DURATION.slow)}>
          <StatsGrid
            t={t}
            totalClasses={classes.length}
            totalStudents={totalStudents}
            activeCount={activeSessions.length}
            avgAttendance={avgAttendance}
            loading={loading}
          />
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(240).duration(DURATION.slow)}>
        <QuickActions t={t} />
      </Animated.View>

    </Screen>
  );
}

/* ─── Greeting ─────────────────────────────────────────────── */
function Greeting({ t, firstName, activeCount, loading }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs + 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.xxl,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.tight,
            lineHeight:    t.fontSize.xxl * 1.1,
          }}
        >
          Hi, {firstName}
        </Text>
        <Hand size={22} color={t.colors.amber} strokeWidth={2.2} />
      </View>

      {loading ? (
        <Text style={{ fontFamily: t.fontFamily.body, fontSize: t.fontSize.sm, color: t.colors.textMuted }}>
          Loading…
        </Text>
      ) : activeCount > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <StatusPill status="live" size="sm" />
          <Text style={{ fontFamily: t.fontFamily.body, fontSize: t.fontSize.sm, color: t.colors.textSecondary }}>
            {activeCount} active session{activeCount > 1 ? 's' : ''}
          </Text>
        </View>
      ) : (
        <Text style={{ fontFamily: t.fontFamily.body, fontSize: t.fontSize.sm, color: t.colors.textMuted }}>
          No active sessions
        </Text>
      )}
    </View>
  );
}

/* ─── Active sessions card ──────────────────────────────── */
function ActiveSessionsCard({ t, sessions }) {
  return (
    <Card accent="green" accentIntensity="bold">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
        <IconTile icon={Radio} tone="green" size="md" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily:    t.fontFamily.mono,
            fontSize:      10,
            fontWeight:    '700',
            color:         t.colors.green,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            Live right now
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.displayBold,
            fontSize:   t.fontSize.md,
            color:      t.colors.textPrimary,
            marginTop:  2,
          }}>
            View live attendance
          </Text>
        </View>
      </View>

      <View style={{ gap: t.spacing.xs + 2 }}>
        {sessions.map(s => (
          <SessionRow key={s.id} t={t} session={s} />
        ))}
      </View>
    </Card>
  );
}

function SessionRow({ t, session }) {
  return (
    <View style={{
      flexDirection:   'row',
      alignItems:      'center',
      gap:             t.spacing.sm,
      padding:         t.spacing.sm,
      backgroundColor: t.colors.bgRaised,
      borderRadius:    t.radius.atomic,
      borderWidth:     1,
      borderColor:     t.colors.border,
    }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{
          fontFamily: t.fontFamily.bodySemibold,
          fontSize:   t.fontSize.sm,
          color:      t.colors.textPrimary,
        }}>
          {session.className}
        </Text>
        <Text numberOfLines={1} style={{
          fontFamily: t.fontFamily.body,
          fontSize:   t.fontSize.xs,
          color:      t.colors.textMuted,
        }}>
          {session.title || 'Attendance session'}
        </Text>
      </View>
      <Button
        label="View"
        size="sm"
        iconRight={ArrowRight}
        onPress={() => router.push(`/lecturer/session/${session.id}`)}
      />
    </View>
  );
}

/* ─── Stats grid ───────────────────────────────────────── */
function StatsGrid({ t, totalClasses, totalStudents, activeCount, avgAttendance, loading }) {
  const cards = [
    { label: 'Classes',    value: totalClasses,        tone: 'brand',  icon: BookOpen   },
    { label: 'Students',   value: totalStudents,       tone: 'violet', icon: Users      },
    { label: 'Active now', value: activeCount,         tone: 'green',  icon: Radio      },
    { label: 'Attendance', value: `${avgAttendance}%`, tone: 'amber',  icon: TrendingUp },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
      {cards.map(c => (
        <StatCard key={c.label} t={t} {...c} loading={loading} />
      ))}
    </View>
  );
}

function StatCard({ t, label, value, tone, icon, loading }) {
  const valueColor =
    tone === 'green'  ? t.colors.green  :
    tone === 'amber'  ? t.colors.amber  :
    tone === 'violet' ? t.colors.violet :
    t.colors.brandText;

  return (
    <View style={{ flexBasis: '48%', flexGrow: 1 }}>
      <Card accent={tone} accentIntensity="subtle" elevation="sm">
        <IconTile icon={icon} tone={tone} size="sm" />
        <Text style={{
          fontFamily: t.fontFamily.displayBold,
          fontSize:   t.fontSize.xxl,
          color:      valueColor,
          marginTop:  t.spacing.xs + 2,
          lineHeight: t.fontSize.xxl * 1.05,
        }}>
          {loading ? '—' : value}
        </Text>
        <Text style={{
          fontFamily: t.fontFamily.body,
          fontSize:   t.fontSize.xs,
          color:      t.colors.textMuted,
          marginTop:  2,
        }}>
          {label}
        </Text>
      </Card>
    </View>
  );
}

/* ─── Quick actions ────────────────────────────────────── */
function QuickActions({ t }) {
  const actions = [
    { label: 'Classes', icon: BookOpen,  tone: 'brand', route: '/lecturer/classes' },
    { label: 'Reports', icon: BarChart3, tone: 'amber', route: '/lecturer/reports' },
  ];

  return (
    <View style={{ gap: t.spacing.sm }}>
      <Text style={{
        fontFamily:    t.fontFamily.mono,
        fontSize:      10,
        fontWeight:    '700',
        color:         t.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        Quick actions
      </Text>

      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        {actions.map(a => (
          <View key={a.label} style={{ flex: 1 }}>
            <Card onPress={() => router.push(a.route)} elevation="sm" padded={false}>
              <View style={{ padding: t.spacing.md, alignItems: 'center', gap: t.spacing.xs + 2 }}>
                <IconTile icon={a.icon} tone={a.tone} size="md" />
                <Text style={{
                  fontFamily: t.fontFamily.bodySemibold,
                  fontSize:   t.fontSize.xs,
                  color:      t.colors.textPrimary,
                }}>
                  {a.label}
                </Text>
              </View>
            </Card>
          </View>
        ))}
      </View>
    </View>
  );
}