import { useState, useEffect, useCallback }        from 'react';
import { View, Text }                              from 'react-native';
import { router, useFocusEffect }                  from 'expo-router';
import Animated, { FadeInUp }                      from 'react-native-reanimated';
import {
  QrCode, BookOpen, Clock, TrendingUp,
  Calendar, CheckCircle, Radio, ArrowRight,
  Hand, Sparkles,
}                                                  from 'lucide-react-native';

import { useAuthStore }                            from '../../store/authStore';
import api                                         from '../../services/api';

import { useTheme }                                from '../../src/theme/ThemeProvider';
import Screen                                      from '../../src/components/ui/Screen';
import Card                                        from '../../src/components/ui/Card';
import Button                                      from '../../src/components/ui/Button';
import IconTile                                    from '../../src/components/ui/IconTile';
import StatusPill                                  from '../../src/components/ui/StatusPill';
import EmptyState                                  from '../../src/components/ui/EmptyState';
import NotificationBell                            from '../../src/components/notifications/NotificationBell';
import { DURATION }                                from '../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * StudentDashboard — the first thing a student sees after login.
 *
 * Hierarchy of importance (top to bottom):
 *   1. Personal greeting + notification bell + active-session callout
 *   2. Empty state (only if student isn't enrolled in any classes)
 *   3. Four stat cards — attendance performance at a glance
 *   4. Quick actions — Scan / Classes / History
 *
 * Three parallel data fetches:
 *   GET /sessions/active         — live sessions the student can join,
 *                                  each carrying markedStatus (server-
 *                                  computed — see sessionController.
 *                                  getActiveSessions) so a session the
 *                                  student already scanned renders as
 *                                  "Marked" instead of a "Mark" button,
 *                                  correctly even after an app restart.
 *   GET /reports/student-stats   — attendance metrics for the cards
 *   GET /classes/enrolled        — used only to detect "zero classes"
 *                                  state for the empty state card
 *
 * Refetches on focus (useFocusEffect), not just on mount. Without
 * this, returning from Scan after a successful mark would still show
 * the stale "Mark" button until a manual pull-to-refresh — the whole
 * point of markedStatus is defeated if the screen never re-asks for
 * it. On mount and on focus both call the same fetchData, so there's
 * no double-fetch flicker on first load.
 *
 * NotificationBell is self-contained (fetches and polls its own
 * data), so it's dropped in as a sibling in the header row — no
 * state or props needed here.
 * ═════════════════════════════════════════════════════════════════
 */
export default function StudentDashboard() {
  const t    = useTheme();
  const user = useAuthStore(s => s.user);

  const [sessions,     setSessions]     = useState([]);
  const [stats,        setStats]        = useState({});
  const [enrolledCount, setEnrolledCount] = useState(null); // null = unknown
  const [refreshing,   setRefreshing]   = useState(false);
  const [loading,      setLoading]      = useState(true);

  /* ── Data fetch ─────────────────────────────────────────
   * Promise.allSettled instead of Promise.all so one slow or
   * failing endpoint doesn't blank the whole dashboard. We treat
   * each response independently and fall back to safe defaults
   * for any that didn't resolve. */
  const fetchData = useCallback(async () => {
    try {
      const [sessRes, statsRes, classesRes] = await Promise.allSettled([
        api.get('/sessions/active'),
        api.get('/reports/student-stats'),
        api.get('/classes/enrolled'),
      ]);

      if (sessRes.status === 'fulfilled') {
        setSessions(sessRes.value.data?.sessions ?? []);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data ?? {});
      }
      if (classesRes.status === 'fulfilled') {
        setEnrolledCount(classesRes.value.data?.classes?.length ?? 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch every time this screen regains focus — the natural way a
  // student returns here is Scan → success card → auto-navigate back,
  // and that trip needs to show "Marked" without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const firstName     = user?.name?.split(' ')[0] || 'there';
  // True only after we've confirmed enrolledCount is 0 (not just unknown)
  const noClasses     = !loading && enrolledCount === 0;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={onRefresh}
      gap={t.spacing.md}
    >
      {/* ── Greeting header ─────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(DURATION.slow)}>
        <GreetingHeader
          t={t}
          firstName={firstName}
          sessions={sessions}
          loading={loading}
        />
      </Animated.View>

      {/* ── Active-session callout ──────────────────────── */}
      {sessions.length > 0 && (
        <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
          <ActiveSessionsCard t={t} sessions={sessions} />
        </Animated.View>
      )}

      {/* ── Empty state for unenrolled students ──────────
          Shown only when we've confirmed the student has zero
          enrolled classes. The CTA pushes them to the Classes
          tab where the existing inline join form lives. */}
      {noClasses && (
        <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
          <EmptyState
            icon={BookOpen}
            iconTone="brand"
            title="Welcome to AttendX!"
            message="You're not enrolled in any classes yet. Tap below to enter a class code from your lecturer."
            actionLabel="Join a class"
            actionIcon={ArrowRight}
            onAction={() => router.push('/student/classes')}
          />
        </Animated.View>
      )}

      {/* ── Stats grid ──────────────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(160).duration(DURATION.slow)}>
        <StatsGrid t={t} stats={stats} loading={loading} />
      </Animated.View>

      {/* ── Quick actions ───────────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(240).duration(DURATION.slow)}>
        <QuickActions t={t} />
      </Animated.View>
    </Screen>
  );
}

// ─── Greeting header ───────────────────────────────────────────
function GreetingHeader({ t, firstName, sessions, loading }) {
  return (
    <View style={{
      flexDirection:  'row',
      alignItems:     'flex-start',
      justifyContent: 'space-between',
      gap:            t.spacing.sm,
    }}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{
          flexDirection: 'row',
          alignItems:    'center',
          gap:           t.spacing.xs + 2,
        }}>
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

        <SubGreeting t={t} sessions={sessions} loading={loading} />
      </View>

      {/* Self-contained — fetches and polls its own notification
          data, so no props are needed here beyond its own defaults. */}
      <NotificationBell />
    </View>
  );
}

// ─── Sub-greeting: "No active sessions" / live pill ────────────
function SubGreeting({ t, sessions, loading }) {
  if (loading) {
    return (
      <Text style={{
        fontFamily: t.fontFamily.body,
        fontSize:   t.fontSize.sm,
        color:      t.colors.textMuted,
      }}>
        Loading…
      </Text>
    );
  }

  if (sessions.length === 0) {
    return (
      <Text style={{
        fontFamily: t.fontFamily.body,
        fontSize:   t.fontSize.sm,
        color:      t.colors.textMuted,
      }}>
        No active sessions
      </Text>
    );
  }

  return (
    <View style={{
      flexDirection: 'row',
      alignItems:    'center',
      gap:           6,
    }}>
      <StatusPill status="live" size="sm" />
      <Text style={{
        fontFamily: t.fontFamily.body,
        fontSize:   t.fontSize.sm,
        color:      t.colors.textSecondary,
      }}>
        {sessions.length} active session{sessions.length > 1 ? 's' : ''}
      </Text>
    </View>
  );
}

// ─── Active sessions card ──────────────────────────────────────
function ActiveSessionsCard({ t, sessions }) {
  return (
    <Card accent="green" accentIntensity="bold">
      <View style={{
        flexDirection: 'row',
        alignItems:    'center',
        gap:           t.spacing.sm,
        marginBottom:  t.spacing.sm,
      }}>
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
            Mark your attendance
          </Text>
        </View>
      </View>

      <View style={{ gap: t.spacing.xs + 2 }}>
        {sessions.map(session => (
          <SessionRow key={session.id} t={t} session={session} />
        ))}
      </View>
    </Card>
  );
}

// ─── Single row inside ActiveSessionsCard ─────────────────────
// Reads session.markedStatus (set by the server — see
// sessionController.getActiveSessions) rather than tracking marked
// state client-side, so it's correct even after an app restart or
// if the student marked from a different device.
function SessionRow({ t, session }) {
  const alreadyMarked = Boolean(session.markedStatus);

  const goToScan = () => {
    router.push({
      pathname: '/student/scan',
      params:   { sessionId: session.id },
    });
  };

  return (
    <View style={{
      flexDirection:   'row',
      alignItems:      'center',
      gap:             t.spacing.sm,
      padding:         t.spacing.sm,
      backgroundColor: t.colors.bgRaised,
      borderRadius:    t.radius.atomic,
      borderWidth:     1,
      borderColor:     alreadyMarked ? t.colors.greenBorder : t.colors.border,
    }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: t.fontFamily.bodySemibold,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textPrimary,
          }}
        >
          {session.className}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.xs,
            color:      t.colors.textMuted,
          }}
        >
          {session.title || 'Attendance session'}
        </Text>
      </View>

      {alreadyMarked ? (
        <View style={{
          flexDirection:     'row',
          alignItems:        'center',
          gap:               6,
          paddingVertical:   6,
          paddingHorizontal: 12,
          borderRadius:      t.radius.atomic,
          backgroundColor:   t.colors.greenBg,
          borderWidth:       1,
          borderColor:       t.colors.greenBorder,
        }}>
          <CheckCircle size={14} color={t.colors.green} strokeWidth={2.4} />
          <Text style={{
            fontFamily: t.fontFamily.bodySemibold,
            fontSize:   t.fontSize.xs,
            color:      t.colors.green,
          }}>
            {session.markedStatus === 'late' ? 'Marked (late)' : 'Marked'}
          </Text>
        </View>
      ) : (
        <Button
          label="Mark"
          size="sm"
          iconRight={ArrowRight}
          onPress={goToScan}
        />
      )}
    </View>
  );
}

// ─── Stats grid ────────────────────────────────────────────────
function StatsGrid({ t, stats, loading }) {
  const cards = [
    {
      label: 'On-time rate',
      value: `${stats.onTimeRate ?? 0}%`,
      tone:  'green',
      icon:  CheckCircle,
    },
    {
      label: 'Total sessions',
      value: stats.totalSessions ?? 0,
      tone:  'brand',
      icon:  Calendar,
    },
    {
      label: 'This month',
      value: `${stats.thisMonth ?? 0}%`,
      tone:  'amber',
      icon:  TrendingUp,
    },
    {
      label: 'Present',
      value: stats.present ?? 0,
      tone:  'violet',
      icon:  Sparkles,
    },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      flexWrap:      'wrap',
      gap:           t.spacing.sm,
    }}>
      {cards.map(c => (
        <StatCard key={c.label} t={t} {...c} loading={loading} />
      ))}
    </View>
  );
}

function StatCard({ t, label, value, tone, icon, loading }) {
  // tone-to-colour lookup for the value text
  const valueColor = tone === 'green'  ? t.colors.green
                   : tone === 'amber'  ? t.colors.amber
                   : tone === 'violet' ? t.colors.violet
                   :                     t.colors.brandText;

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

// ─── Quick actions ─────────────────────────────────────────────
function QuickActions({ t }) {
  const actions = [
    { label: 'Scan QR', icon: QrCode,   tone: 'brand',  route: '/student/scan'    },
    { label: 'Classes', icon: BookOpen, tone: 'green',  route: '/student/classes' },
    { label: 'History', icon: Clock,    tone: 'amber',  route: '/student/history' },
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

      <View style={{
        flexDirection: 'row',
        gap:           t.spacing.sm,
      }}>
        {actions.map(a => (
          <ActionCard key={a.label} t={t} {...a} />
        ))}
      </View>
    </View>
  );
}

function ActionCard({ t, label, icon, tone, route }) {
  return (
    <View style={{ flex: 1 }}>
      <Card
        onPress={() => router.push(route)}
        elevation="sm"
        padded={false}
      >
        <View style={{
          padding:        t.spacing.md,
          alignItems:     'center',
          gap:            t.spacing.xs + 2,
        }}>
          <IconTile icon={icon} tone={tone} size="md" />
          <Text style={{
            fontFamily: t.fontFamily.bodySemibold,
            fontSize:   t.fontSize.xs,
            color:      t.colors.textPrimary,
          }}>
            {label}
          </Text>
        </View>
      </Card>
    </View>
  );
}