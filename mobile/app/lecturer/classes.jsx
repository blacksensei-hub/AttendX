import { useState, useEffect, useCallback }   from 'react';
import { View, Text }                         from 'react-native';
import { router }                             from 'expo-router';
import Animated, { FadeInUp }                 from 'react-native-reanimated';
import {
  BookOpen, Users, ChevronRight,
}                                             from 'lucide-react-native';

import api                                    from '../../services/api';

import { useTheme }                           from '../../src/theme/ThemeProvider';
import Screen                                 from '../../src/components/ui/Screen';
import Card                                   from '../../src/components/ui/Card';
import IconTile                               from '../../src/components/ui/IconTile';
import StatusPill                             from '../../src/components/ui/StatusPill';
import EmptyState                             from '../../src/components/ui/EmptyState';
import { DURATION }                           from '../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Classes — list of the lecturer's classes.
 *
 * Read-only on mobile. Class CRUD lives on web; this is for tapping
 * into a class to manage today's session.
 *
 * Empty state uses the shared EmptyState component, which mirrors the
 * web app's dashed-border card pattern. We use the brand-tinted icon
 * because creating a class IS an action — even though the action lives
 * on web, the card's job is to invite, not to look like nothing-here.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ClassesScreen() {
  const t = useTheme();

  const [classes,    setClasses]    = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);

  const fetchClasses = useCallback(async () => {
    try {
      const res     = await api.get('/classes');
      const payload = res.data?.data ?? res.data ?? {};
      setClasses(payload.classes ?? []);
    } catch (err) {
      console.error('Classes fetch error:', err?.response?.data ?? err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClasses();
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
            Your classes
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
          }}>
            {loading
              ? 'Loading…'
              : `${classes.length} class${classes.length !== 1 ? 'es' : ''} · tap a class to manage sessions`}
          </Text>
        </View>
      </Animated.View>

      {/* Empty state — only shown after the fetch completes,
          to avoid flashing "No classes yet" during initial load. */}
      {!loading && classes.length === 0 && (
        <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
          <EmptyState
            icon={BookOpen}
            iconTone="brand"
            title="No classes yet"
            message="Create your first class on the web app, then tap into it here to start running attendance sessions."
          />
        </Animated.View>
      )}

      {classes.map((cls, i) => (
        <Animated.View
          key={cls.id}
          entering={FadeInUp.delay(80 + i * 40).duration(DURATION.slow)}
        >
          <ClassCard t={t} cls={cls} />
        </Animated.View>
      ))}
    </Screen>
  );
}

function ClassCard({ t, cls }) {
  const isLive = !!cls.activeSession;

  return (
    <Card
      onPress={() => router.push(`/lecturer/class/${cls.id}`)}
      elevation={isLive ? 'md' : 'sm'}
      accent={isLive ? 'green' : undefined}
      accentIntensity={isLive ? 'subtle' : undefined}
    >
      <View style={{
        flexDirection: 'row',
        alignItems:    'center',
        gap:           t.spacing.sm,
      }}>
        <IconTile icon={BookOpen} tone="brand" size="md" />

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{
            flexDirection: 'row',
            alignItems:    'center',
            gap:           t.spacing.xs,
            flexWrap:      'wrap',
          }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: t.fontFamily.displayBold,
                fontSize:   t.fontSize.md,
                color:      t.colors.textPrimary,
                flexShrink: 1,
              }}
            >
              {cls.name}
            </Text>
            {isLive && <StatusPill status="live" size="sm" />}
          </View>

          <View style={{
            flexDirection: 'row',
            alignItems:    'center',
            gap:           t.spacing.xs,
          }}>
            <Users size={12} color={t.colors.textMuted} />
            <Text style={{
              fontFamily: t.fontFamily.body,
              fontSize:   t.fontSize.xs,
              color:      t.colors.textMuted,
            }}>
              {cls.enrollmentCount ?? 0} student{cls.enrollmentCount !== 1 ? 's' : ''}
            </Text>
            {cls.code && (
              <>
                <Text style={{ color: t.colors.textMuted }}>·</Text>
                <Text style={{
                  fontFamily: t.fontFamily.mono,
                  fontSize:   t.fontSize.xs,
                  color:      t.colors.brandText,
                  fontWeight: '600',
                }}>
                  {cls.code}
                </Text>
              </>
            )}
          </View>
        </View>

        <ChevronRight size={18} color={t.colors.textMuted} />
      </View>
    </Card>
  );
}