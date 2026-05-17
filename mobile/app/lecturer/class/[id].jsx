import { useState, useEffect, useCallback }   from 'react';
import { View, Text, Alert }                  from 'react-native';
import { router, useLocalSearchParams }       from 'expo-router';
import Animated, { FadeInUp }                 from 'react-native-reanimated';
import {
  ArrowLeft, Plus, Radio, ChevronRight, Clock,
}                                             from 'lucide-react-native';
import { format }                             from 'date-fns';

import api                                    from '../../../services/api';

import { useTheme }                           from '../../../src/theme/ThemeProvider';
import Screen                                 from '../../../src/components/ui/Screen';
import Card                                   from '../../../src/components/ui/Card';
import Button                                 from '../../../src/components/ui/Button';
import IconTile                               from '../../../src/components/ui/IconTile';
import EmptyState                             from '../../../src/components/ui/EmptyState';
import { DURATION }                           from '../../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Class detail.
 *
 * Two parallel API calls (backend has no dedicated /classes/:id/sessions
 * endpoint, so we filter the lecturer's all-sessions list by classId):
 *   GET /classes/:id           — class metadata + students
 *   GET /reports/all-sessions  — filter by classId for past + active
 *
 * The active session is whichever session has status === 'open'.
 * If one exists we show "View live attendance"; otherwise the
 * primary action is "Open session" which POSTs and routes to the
 * live session view.
 *
 * The "no past sessions yet" empty state appears when the class is
 * brand new — there's no active session AND no history. Once the
 * lecturer runs even one session, the empty state is replaced by
 * the past sessions list.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ClassDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams();

  const [classData, setClassData] = useState(null);
  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [opening,   setOpening]   = useState(false);

  const fetchClass = useCallback(async () => {
    try {
      const [classRes, sessionsRes] = await Promise.allSettled([
        api.get(`/classes/${id}`),
        api.get('/reports/all-sessions'),
      ]);

      if (classRes.status === 'fulfilled') {
        const payload = classRes.value.data?.data ?? classRes.value.data ?? {};
        setClassData(payload.class ?? null);
      } else {
        console.error('Class fetch error:',
          classRes.reason?.response?.data ?? classRes.reason?.message);
      }

      if (sessionsRes.status === 'fulfilled') {
        const payload = sessionsRes.value.data?.data ?? sessionsRes.value.data ?? {};
        const all     = payload.sessions ?? [];
        // Filter to only sessions belonging to this class
        setSessions(all.filter(s => s.classId === id));
      } else {
        console.error('Sessions fetch error:',
          sessionsRes.reason?.response?.data ?? sessionsRes.reason?.message);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClass(); }, [fetchClass]);

  const handleOpenSession = async () => {
    setOpening(true);
    try {
      const res = await api.post('/sessions', {
        classId: id,
        title:   `Session ${new Date().toLocaleDateString('en-GB')}`,
      });
      const payload = res.data?.data ?? res.data ?? {};
      const session = payload.session;
      if (session?.id) {
        router.replace(`/lecturer/session/${session.id}`);
      } else {
        Alert.alert('Error', 'Session created but no ID returned');
      }
    } catch (err) {
      Alert.alert(
        'Failed to open session',
        err.response?.data?.message || 'Try again'
      );
    } finally {
      setOpening(false);
    }
  };

  // Active session = whichever has status 'open'
  const activeSession = sessions.find(s => s.status === 'open');
  const pastSessions  = sessions.filter(s => s.status !== 'open');

  return (
    <Screen gap={t.spacing.md}>
      {/* ── Back ─────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
        <Button
          label="Back"
          icon={ArrowLeft}
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
        />
      </View>

      {/* ── Header ───────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(DURATION.slow)}>
        <View style={{ gap: 4 }}>
          <Text style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.xxl,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.tight,
          }}>
            {classData?.name ?? '…'}
          </Text>
          {classData?.description && (
            <Text style={{
              fontFamily: t.fontFamily.body,
              fontSize:   t.fontSize.sm,
              color:      t.colors.textMuted,
            }}>
              {classData.description}
            </Text>
          )}
        </View>
      </Animated.View>

      {/* ── Primary action: open or view live ─────────── */}
      <Animated.View entering={FadeInUp.delay(80).duration(DURATION.slow)}>
        {activeSession ? (
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
                  Session in progress
                </Text>
                <Text style={{
                  fontFamily: t.fontFamily.displayBold,
                  fontSize:   t.fontSize.md,
                  color:      t.colors.textPrimary,
                  marginTop:  2,
                }}>
                  {activeSession.title || 'Attendance session'}
                </Text>
              </View>
            </View>
            <Button
              label="View live attendance"
              size="lg"
              fullWidth
              onPress={() => router.push(`/lecturer/session/${activeSession.id}`)}
            />
          </Card>
        ) : (
          <Card>
            <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
              <IconTile icon={Plus} tone="brand" size="lg" shadow />
              <Text style={{
                fontFamily: t.fontFamily.displayBold,
                fontSize:   t.fontSize.md,
                color:      t.colors.textPrimary,
              }}>
                Ready to take attendance?
              </Text>
              <Text style={{
                fontFamily: t.fontFamily.body,
                fontSize:   t.fontSize.sm,
                color:      t.colors.textMuted,
                textAlign:  'center',
              }}>
                Open a session and students can scan in.
              </Text>
              <Button
                label="Open session"
                icon={Plus}
                size="lg"
                fullWidth
                loading={opening}
                onPress={handleOpenSession}
              />
            </View>
          </Card>
        )}
      </Animated.View>

      {/* ── Past sessions ─────────────────────────────── */}
      {pastSessions.length > 0 && (
        <Animated.View
          entering={FadeInUp.delay(160).duration(DURATION.slow)}
          style={{ gap: t.spacing.sm }}
        >
          <Text style={{
            fontFamily:    t.fontFamily.mono,
            fontSize:      10,
            fontWeight:    '700',
            color:         t.colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            Past sessions
          </Text>

          {pastSessions.slice(0, 20).map(session => (
            <PastSessionRow key={session.id} t={t} session={session} />
          ))}
        </Animated.View>
      )}

      {/* Empty state — only when:
          1. Loading is done
          2. No active session is running
          3. No past sessions exist
          We don't show this when there IS an active session, because
          the "Session in progress" card above covers the same screen
          space and is more important. */}
      {!loading && !activeSession && pastSessions.length === 0 && (
        <Animated.View entering={FadeInUp.delay(160).duration(DURATION.slow)}>
          <EmptyState
            icon={Clock}
            iconTone="muted"
            title="No past sessions for this class"
            message="Once you've run a few attendance sessions, they'll show up here for review."
          />
        </Animated.View>
      )}

      {loading && sessions.length === 0 && (
        <Text style={{
          fontFamily: t.fontFamily.body,
          fontSize:   t.fontSize.sm,
          color:      t.colors.textMuted,
          textAlign:  'center',
        }}>
          Loading sessions…
        </Text>
      )}
    </Screen>
  );
}

function PastSessionRow({ t, session }) {
  return (
    <Card onPress={() => router.push(`/lecturer/session/${session.id}`)}>
      <View style={{
        flexDirection: 'row',
        alignItems:    'center',
        gap:           t.spacing.sm,
      }}>
        <IconTile icon={Clock} tone="muted" size="sm" />

        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: t.fontFamily.bodySemibold,
              fontSize:   t.fontSize.sm,
              color:      t.colors.textPrimary,
            }}
          >
            {session.title || 'Attendance session'}
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.mono,
            fontSize:   t.fontSize.xs,
            color:      t.colors.textMuted,
          }}>
            {session.openAt
              ? format(new Date(session.openAt), 'dd MMM, HH:mm')
              : '—'}
            {session.total ? ` · ${session.total} marked` : ''}
          </Text>
        </View>

        <ChevronRight size={16} color={t.colors.textMuted} />
      </View>
    </Card>
  );
}