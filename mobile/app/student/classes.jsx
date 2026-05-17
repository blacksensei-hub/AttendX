import { useState, useEffect, useCallback }   from 'react';
import { View, Text, Alert }                  from 'react-native';
import Animated, {
  FadeInUp, FadeIn, FadeOut,
  Layout,
}                                             from 'react-native-reanimated';
import {
  BookOpen, Plus, MapPin, Users,
  ArrowRight, X,
}                                             from 'lucide-react-native';

import api                                    from '../../services/api';

import { useTheme }                           from '../../src/theme/ThemeProvider';
import Screen                                 from '../../src/components/ui/Screen';
import Card                                   from '../../src/components/ui/Card';
import Button                                 from '../../src/components/ui/Button';
import Input                                  from '../../src/components/ui/Input';
import IconTile                               from '../../src/components/ui/IconTile';
import { DURATION }                           from '../../src/lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * ClassesScreen — student's enrolled classes view.
 *
 * Two main states:
 *   • Empty — branded BookOpen tile + clear CTA to join first class
 *   • Populated — list of class cards with branded initial avatars
 *
 * Join flow:
 *   • Tap "Join" in header → form expands inline
 *   • Type 8-char code (auto-uppercased, monospace input)
 *   • Submit → POST /classes/join → refresh enrolment list
 *
 * Preserved from original: full data-fetching logic, pull-to-refresh,
 * uppercase code transformation, max-length limit.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ClassesScreen() {
  const t = useTheme();

  const [classes,    setClasses]    = useState([]);
  const [code,       setCode]       = useState('');
  const [showJoin,   setShowJoin]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [joining,    setJoining]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const { data } = await api.get('/classes/enrolled');
      setClasses(data.classes ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClasses();
  };

  const joinClass = async () => {
    if (!code.trim()) return;
    setJoining(true);
    try {
      await api.post('/classes/join', { code: code.trim() });
      Alert.alert('Joined', 'You\'re now enrolled in this class.');
      setCode('');
      setShowJoin(false);
      fetchClasses();
    } catch (err) {
      Alert.alert(
        'Could not join',
        err.response?.data?.message || 'Check the code and try again'
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={onRefresh}
      gap={t.spacing.md}
    >
      {/* ── Header ────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(DURATION.slow)}>
        <Header
          t={t}
          count={classes.length}
          loading={loading}
          showJoin={showJoin}
          onToggleJoin={() => setShowJoin(v => !v)}
        />
      </Animated.View>

      {/* ── Join form (inline, animates in/out) ──────── */}
      {showJoin && (
        <Animated.View
          entering={FadeIn.duration(DURATION.base)}
          exiting={FadeOut.duration(DURATION.fast)}
          layout={Layout.springify()}
        >
          <JoinForm
            t={t}
            code={code}
            onCodeChange={setCode}
            onSubmit={joinClass}
            onCancel={() => { setShowJoin(false); setCode(''); }}
            joining={joining}
          />
        </Animated.View>
      )}

      {/* ── Body: empty / shimmer / list ────────────── */}
      {loading ? (
        <LoadingSkeleton t={t} />
      ) : classes.length === 0 ? (
        <Animated.View entering={FadeInUp.delay(120).duration(DURATION.slow)}>
          <EmptyState t={t} onJoinPress={() => setShowJoin(true)} />
        </Animated.View>
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {classes.map((cls, i) => (
            <Animated.View
              key={cls.id}
              entering={FadeInUp.delay(i * 60).duration(DURATION.medium)}
              layout={Layout.springify()}
            >
              <ClassCard t={t} cls={cls} />
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}

// ─── Header ────────────────────────────────────────────────────
function Header({ t, count, loading, showJoin, onToggleJoin }) {
  return (
    <View style={{
      flexDirection:   'row',
      alignItems:      'flex-start',
      justifyContent:  'space-between',
      gap:             t.spacing.sm,
    }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{
          fontFamily:    t.fontFamily.displayBold,
          fontSize:      t.fontSize.xxl,
          color:         t.colors.textPrimary,
          letterSpacing: t.letterSpacing.tight,
          lineHeight:    t.fontSize.xxl * 1.1,
        }}>
          My classes
        </Text>
        <Text style={{
          fontFamily: t.fontFamily.body,
          fontSize:   t.fontSize.sm,
          color:      t.colors.textMuted,
        }}>
          {loading
            ? 'Loading…'
            : count === 0
              ? 'Enter a class code to enrol'
              : `${count} class${count === 1 ? '' : 'es'} enrolled`}
        </Text>
      </View>

      <Button
        label={showJoin ? 'Close' : 'Join'}
        icon={showJoin ? X : Plus}
        size="sm"
        variant={showJoin ? 'secondary' : 'primary'}
        onPress={onToggleJoin}
      />
    </View>
  );
}

// ─── Inline join form ──────────────────────────────────────────
function JoinForm({ t, code, onCodeChange, onSubmit, onCancel, joining }) {
  return (
    <Card accent="brand" accentIntensity="subtle">
      <View style={{
        flexDirection: 'row',
        alignItems:    'center',
        gap:           t.spacing.sm,
        marginBottom:  t.spacing.sm,
      }}>
        <IconTile icon={Plus} tone="brand" size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: t.fontFamily.bodySemibold,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textPrimary,
          }}>
            Join a class
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.xs,
            color:      t.colors.textMuted,
            marginTop:  2,
          }}>
            Your lecturer shares an 8-character code like{' '}
            <Text style={{
              fontFamily: t.fontFamily.mono,
              color:      t.colors.brandText,
              fontWeight: '700',
            }}>
              ABCD1234
            </Text>
          </Text>
        </View>
      </View>

      <Input
        label="Class code"
        value={code}
        onChangeText={(v) => onCodeChange(v.toUpperCase())}
        placeholder="ABCD1234"
        autoCapitalize="characters"
        autoComplete="off"
        autoFocus
        maxLength={8}
        mono
      />

      <View style={{
        flexDirection: 'row',
        gap:           t.spacing.sm,
        marginTop:     t.spacing.sm,
      }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Cancel"
            variant="ghost"
            onPress={onCancel}
            fullWidth
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button
            label="Join class"
            iconRight={ArrowRight}
            onPress={onSubmit}
            loading={joining}
            disabled={!code.trim() || joining}
            fullWidth
          />
        </View>
      </View>
    </Card>
  );
}

// ─── Class card ────────────────────────────────────────────────
function ClassCard({ t, cls }) {
  // Two-letter brand initial. Strips spaces so "Computer Science 301"
  // → "CO" not "C ", "AI" → "AI" exactly, "x" → "X" only.
  const initial = (cls.name || '?')
    .replace(/\s+/g, '')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card elevation="md">
      <View style={{
        flexDirection: 'row',
        alignItems:    'center',
        gap:           t.spacing.md,
      }}>
        {/* Class initial avatar */}
        <View style={{
          width:           48,
          height:          48,
          borderRadius:    t.radius.atomic,
          backgroundColor: t.colors.brandSubtle,
          borderWidth:     1,
          borderColor:     t.colors.brandBorder,
          alignItems:      'center',
          justifyContent:  'center',
        }}>
          <Text style={{
            fontFamily: t.fontFamily.displayBold,
            fontSize:   t.fontSize.md,
            color:      t.colors.brandText,
            letterSpacing: 0.4,
          }}>
            {initial}
          </Text>
        </View>

        {/* Body */}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: t.fontFamily.bodySemibold,
              fontSize:   t.fontSize.md,
              color:      t.colors.textPrimary,
            }}
          >
            {cls.name}
          </Text>

          {cls.description ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: t.fontFamily.body,
                fontSize:   t.fontSize.xs,
                color:      t.colors.textMuted,
              }}
            >
              {cls.description}
            </Text>
          ) : null}

          <View style={{
            flexDirection: 'row',
            alignItems:    'center',
            gap:           10,
            marginTop:     6,
            flexWrap:      'wrap',
          }}>
            {/* Code pill */}
            <View style={{
              flexDirection:     'row',
              alignItems:        'center',
              gap:               4,
              paddingVertical:   3,
              paddingHorizontal: 8,
              borderRadius:      t.radius.pill,
              backgroundColor:   t.colors.brandSubtle,
              borderWidth:       1,
              borderColor:       t.colors.brandBorder,
            }}>
              <Text style={{
                fontFamily:    t.fontFamily.mono,
                fontWeight:    '700',
                fontSize:      10,
                color:         t.colors.brandText,
                letterSpacing: 0.6,
              }}>
                {cls.code}
              </Text>
            </View>

            {/* Optional metadata — only renders if backend returns it */}
            {cls.location_name && (
              <Meta t={t} icon={MapPin} label={cls.location_name} />
            )}
            {typeof cls.enrolledCount === 'number' && (
              <Meta t={t} icon={Users} label={`${cls.enrolledCount}`} />
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

// ─── Meta tag (icon + label, used in class card footer) ───────
function Meta({ t, icon: Icon, label }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems:    'center',
      gap:           4,
    }}>
      <Icon size={11} color={t.colors.textMuted} strokeWidth={2.4} />
      <Text style={{
        fontFamily: t.fontFamily.body,
        fontSize:   11,
        color:      t.colors.textMuted,
      }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────
function LoadingSkeleton({ t }) {
  return (
    <View style={{ gap: t.spacing.sm }}>
      {[0, 1, 2].map(i => (
        <View
          key={i}
          style={{
            height:          82,
            borderRadius:    t.radius.molecular,
            backgroundColor: t.colors.bgRaised,
            borderWidth:     1,
            borderColor:     t.colors.border,
            opacity:         0.6 - i * 0.15,
          }}
        />
      ))}
    </View>
  );
}

// ─── Empty state ───────────────────────────────────────────────
function EmptyState({ t, onJoinPress }) {
  return (
    <Card padded={false}>
      <View style={{
        alignItems: 'center',
        padding:    t.spacing.xl,
        gap:        t.spacing.md,
      }}>
        <IconTile icon={BookOpen} tone="brand" size="xl" shadow />

        <View style={{ alignItems: 'center', gap: 6, maxWidth: 280 }}>
          <Text style={{
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.lg,
            color:         t.colors.textPrimary,
            letterSpacing: t.letterSpacing.tight,
          }}>
            No classes yet
          </Text>
          <Text style={{
            fontFamily: t.fontFamily.body,
            fontSize:   t.fontSize.sm,
            color:      t.colors.textMuted,
            textAlign:  'center',
            lineHeight: t.fontSize.sm * 1.5,
          }}>
            Ask your lecturer for the class code, then enter it here to enrol.
          </Text>
        </View>

        <Button
          label="Enter a class code"
          icon={Plus}
          onPress={onJoinPress}
          size="lg"
        />
      </View>
    </Card>
  );
}