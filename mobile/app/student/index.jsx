import { useState, useEffect, useCallback }        from 'react';
import { View, Text }                              from 'react-native';
import { router, useFocusEffect }                  from 'expo-router';
import Animated, { FadeInUp }                      from 'react-native-reanimated';
import {
  QrCode, BookOpen, Clock, CheckCircle, ArrowRight,
}                                                  from 'lucide-react-native';

import { useAuthStore }                            from '../../store/authStore';
import api                                         from '../../services/api';

import { useTheme }                                from '../../src/theme/ThemeProvider';
import Screen                                      from '../../src/components/ui/Screen';
import Card                                        from '../../src/components/ui/Card';
import Button                                      from '../../src/components/ui/Button';
import IconTile                                    from '../../src/components/ui/IconTile';
import EmptyState                                  from '../../src/components/ui/EmptyState';
import NotificationBell                            from '../../src/components/notifications/NotificationBell';
import { Kicker }                                  from '../../src/components/ui/BrandMark';
import ScanFrame                                   from '../../src/components/ui/ScanFrame';
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
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <View style={{
      flexDirection:  'row',
      alignItems:     'flex-start',
      justifyContent: 'space-between',
      gap:            t.spacing.sm,
    }}>
      <View style={{ flex: 1, gap: 10 }}>
        <Kicker dot>{`Student / ${today}`}</Kicker>
        <Text
          numberOfLines={2}
          style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      40,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.display,
            lineHeight:    42,
          }}
        >
          Hi, <Text style={{ color: t.colors.brandText }}>{firstName}.</Text>
        </Text>
        <SubGreeting t={t} sessions={sessions} loading={loading} />
      </View>

      {/* Self-contained — fetches and polls its own notification
          data, so no props are needed here beyond its own defaults. */}
      <NotificationBell />
    </View>
  );
}

function SubGreeting({ t, sessions, loading }) {
  const text = loading
    ? 'Checking for open sessions…'
    : sessions.length === 0
      ? 'Nothing open right now. It shows up here the moment a session starts.'
      : `${sessions.length} session${sessions.length > 1 ? 's are' : ' is'} open. Mark your seat before it closes.`;
  return (
    <Text style={{
      fontFamily: t.fontFamily.body,
      fontSize:   t.fontSize.md,
      lineHeight: t.fontSize.md * 1.45,
      color:      t.colors.textSecondary,
    }}>
      {text}
    </Text>
  );
}

function ActiveSessionsCard({ t, sessions }) {
  // The one thing to do right now: an ink panel in the scan frame.
  return (
    <ScanFrame color={t.colors.greenFill} style={{ margin: 7 }}>
      <View style={{
        backgroundColor: t.colors.bgInverse,
        borderRadius:    t.radius.organism,
        padding:         t.spacing.lg,
        gap:             t.spacing.md,
        ...t.shadow.lg,
      }}>
        <Kicker dot={t.colors.greenFill} color={t.mode === 'dark' ? 'rgba(11,27,63,0.65)' : 'rgba(238,241,245,0.65)'}>
          Live now / mark your seat
        </Kicker>
        <View style={{ gap: t.spacing.md }}>
          {sessions.map(session => (
            <SessionRow key={session.id} t={t} session={session} />
          ))}
        </View>
      </View>
    </ScanFrame>
  );
}

function SessionRow({ t, session }) {
  const alreadyMarked = Boolean(session.markedStatus);
  const onInk   = t.colors.textInverse;
  const onInk2  = t.mode === 'dark' ? 'rgba(11,27,63,0.7)' : 'rgba(238,241,245,0.7)';

  const goToScan = () => {
    router.push({
      pathname: '/student/scan',
      params:   { sessionId: session.id },
    });
  };

  return (
    <View style={{
      flexDirection:  'row',
      alignItems:     'center',
      gap:            t.spacing.sm,
      paddingTop:     t.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: t.mode === 'dark' ? 'rgba(11,27,63,0.14)' : 'rgba(238,241,245,0.14)',
    }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.lg,
            letterSpacing: t.letterSpacing.tight,
            color:         onInk,
          }}
        >
          {session.className}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      onInk2,
          }}
        >
          {session.title || 'Attendance session'}
        </Text>
      </View>

      {alreadyMarked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={15} color={t.colors.greenFill} strokeWidth={2.4} />
          <Text style={{
            fontFamily:    t.fontFamily.mono,
            fontSize:      11,
            letterSpacing: t.letterSpacing.wider,
            textTransform: 'uppercase',
            color:         t.colors.greenFill,
          }}>
            {session.markedStatus === 'late' ? 'Marked (late)' : 'Marked'}
          </Text>
        </View>
      ) : (
        <Button
          label="Mark"
          iconRight={ArrowRight}
          onPress={goToScan}
        />
      )}
    </View>
  );
}

function StatsGrid({ t, stats, loading }) {
  const cards = [
    { label: 'This month', value: `${stats.thisMonth ?? 0}%`,  dot: t.colors.greenFill, featured: true },
    { label: 'On time',    value: `${stats.onTimeRate ?? 0}%`, dot: t.colors.amberFill },
    { label: 'Sessions',   value: stats.totalSessions ?? 0,    dot: t.colors.brand },
    { label: 'Present',    value: stats.present ?? 0,          dot: t.colors.violet },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      flexWrap:      'wrap',
      gap:           t.spacing.sm,
    }}>
      {cards.map((c, i) => (
        <StatCard key={c.label} t={t} {...c} index={i + 1} loading={loading} />
      ))}
    </View>
  );
}

function StatCard({ t, label, value, dot, featured, index, loading }) {
  // The number is the design: ink numerals, colour only in the dot.
  const bg    = featured ? t.colors.bgInverse : t.colors.bgCard;
  const ink   = featured ? t.colors.textInverse : t.colors.textPrimary;
  const muted = featured
    ? (t.mode === 'dark' ? 'rgba(11,27,63,0.65)' : 'rgba(238,241,245,0.65)')
    : t.colors.textMuted;
  return (
    <View style={{
      flexBasis:       '47%',
      flexGrow:        1,
      minHeight:       120,
      padding:         t.spacing.md,
      borderRadius:    t.radius.molecular,
      backgroundColor: bg,
      borderWidth:     featured ? 0 : 1,
      borderColor:     t.colors.border,
      justifyContent:  'space-between',
      ...(featured ? t.shadow.md : t.shadow.sm),
    }}>
      <Kicker dot={dot} color={muted}>{`${String(index).padStart(2, '0')} / ${label}`}</Kicker>
      <Text style={{
        fontFamily:    t.fontFamily.displayBold,
        fontSize:      40,
        letterSpacing: -1.6,
        color:         ink,
        lineHeight:    42,
        marginTop:     t.spacing.md,
      }}>
        {loading ? '–' : value}
      </Text>
    </View>
  );
}

// ─── Quick actions ─────────────────────────────────────────────
function QuickActions({ t }) {
  const actions = [
    { label: 'Scan',    icon: QrCode,   tone: 'brand', route: '/student/scan'    },
    { label: 'Classes', icon: BookOpen, tone: 'brand', route: '/student/classes' },
    { label: 'History', icon: Clock,    tone: 'brand', route: '/student/history' },
  ];

  return (
    <View style={{ gap: t.spacing.sm }}>
      <Kicker>Quick actions</Kicker>

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