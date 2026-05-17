import { useState, useEffect, useCallback }   from 'react';
import { View, Text }                         from 'react-native';
import { router }                             from 'expo-router';
import Animated, { FadeInUp }                 from 'react-native-reanimated';
import {
  FileText, ChevronRight, BarChart3,
}                                             from 'lucide-react-native';
import { format }                             from 'date-fns';

import api                                    from '../../services/api';

import { useTheme }                           from '../../src/theme/ThemeProvider';
import Screen                                 from '../../src/components/ui/Screen';
import Card                                   from '../../src/components/ui/Card';
import IconTile                               from '../../src/components/ui/IconTile';
import EmptyState                             from '../../src/components/ui/EmptyState';
import { DURATION }                           from '../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Reports — read-only on mobile.
 *
 * Mobile shows a flat list of past sessions. Adjustment, export,
 * and detailed audit trail viewing live on web — those are
 * sit-down activities, not in-class ones.
 *
 * Empty state uses muted icon tone (not brand) because the lecturer
 * doesn't take action from here — the action is "go run a session".
 * ═════════════════════════════════════════════════════════════════
 */
export default function ReportsScreen() {
  const t = useTheme();

  const [sessions,   setSessions]   = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res     = await api.get('/reports/all-sessions');
      const payload = res.data?.data ?? res.data ?? {};
      setSessions(payload.sessions ?? []);
    } catch (err) {
      console.error('Reports fetch error:', err?.response?.data ?? err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessions();
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={onRefresh}
      gap={t.spacing.md}
    >
      <Animated.View entering={FadeInUp.duration(DURATION.slow)}>
        <View style={{ gap: 4 }}>
          <Text style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.xxl,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.tight,
          }}>
            Reports
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
          }}>
            {loading ? 'Loading…' : `${sessions.length} past session${sessions.length !== 1 ? 's' : ''} · use the web app to adjust or export`}
          </Text>
        </View>
      </Animated.View>

      {/* Empty state — uses muted tone because there's no CTA here.
          The lecturer's "action" if they see this is to run a
          session, which they do from the Classes tab. */}
      {!loading && sessions.length === 0 && (
        <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
          <EmptyState
            icon={FileText}
            iconTone="muted"
            title="No sessions yet"
            message="When you open and close attendance sessions, they'll appear here as reports."
          />
        </Animated.View>
      )}

      {sessions.slice(0, 50).map((session, i) => (
        <Animated.View
          key={session.id}
          entering={FadeInUp.delay(80 + i * 30).duration(DURATION.slow)}
        >
          <SessionCard t={t} session={session} />
        </Animated.View>
      ))}
    </Screen>
  );
}

function SessionCard({ t, session }) {
  return (
    <Card onPress={() => router.push(`/lecturer/session/${session.id}`)}>
      <View style={{
        flexDirection: 'row',
        alignItems:    'center',
        gap:           t.spacing.sm,
      }}>
        <IconTile icon={BarChart3} tone="brand" size="md" />

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: t.fontFamily.bodySemibold,
              fontSize:   t.fontSize.sm,
              color:      t.colors.textPrimary,
            }}
          >
            {session.className ?? 'Unknown class'}
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
            {' · '}
            <Text style={{ fontFamily: t.fontFamily.mono }}>
              {session.openAt ? format(new Date(session.openAt), 'dd MMM, HH:mm') : '—'}
            </Text>
          </Text>
          {session.total !== undefined && (
            <Text style={{
              fontFamily: t.fontFamily.mono,
              fontSize:   t.fontSize.xs,
              color:      t.colors.brandText,
              fontWeight: '600',
              marginTop:  2,
            }}>
              {session.present ?? 0}P · {session.late ?? 0}L · {session.total ?? 0}T
            </Text>
          )}
        </View>

        <ChevronRight size={16} color={t.colors.textMuted} />
      </View>
    </Card>
  );
}