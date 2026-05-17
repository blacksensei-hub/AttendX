import { useEffect }                           from 'react';
import {
  Modal, View, Text, Pressable, Alert, StyleSheet,
}                                              from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming,
  runOnJS, FadeIn, FadeOut,
}                                              from 'react-native-reanimated';
import { router }                              from 'expo-router';
import {
  Monitor, Sun, Moon, LogOut, Check,
}                                              from 'lucide-react-native';

import { useTheme, useThemeMode }              from '../../theme/ThemeProvider';
import { useAuthStore }                        from '../../../store/authStore';
import {
  SPRING, TAP, DURATION, EASE,
}                                              from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * SettingsPopover — small floating card anchored above the Settings
 * tab in the bottom-right corner.
 *
 * Contains:
 *   • Theme picker (System / Light / Dark) as segmented pills
 *   • Sign out button
 *
 * Why Modal + custom backdrop instead of an inline View:
 *   A plain View renders inside its parent's stacking context —
 *   which is the tab layout — so it can't extend over the tab bar
 *   or the status bar. A Modal breaks out to the root window, which
 *   is exactly what a "tap anywhere else to dismiss" popover needs.
 *
 * Props:
 *   open      — boolean
 *   onClose   — called when the user taps outside, taps Sign Out, or
 *               taps anywhere that should dismiss the popover
 * ═════════════════════════════════════════════════════════════════
 */
export default function SettingsPopover({ open, onClose }) {
  const t                          = useTheme();
  const { mode, setMode }          = useThemeMode();
  const logout                     = useAuthStore(s => s.logout);
  const user                       = useAuthStore(s => s.user);

  const scale     = useSharedValue(0.9);
  const translateY = useSharedValue(12);

  // Spring in when open, spring out on close
  useEffect(() => {
    if (open) {
      scale.value      = withSpring(1, SPRING.snappy);
      translateY.value = withSpring(0, SPRING.snappy);
    } else {
      scale.value      = withTiming(0.9, { duration: DURATION.fast, easing: EASE.exit });
      translateY.value = withTiming(12, { duration: DURATION.fast, easing: EASE.exit });
    }
  }, [open, scale, translateY]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const handleSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You\'ll need to log back in next time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  return (
    <Modal
      transparent
      visible={open}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* ── Backdrop — tap to dismiss ────────────────────── */}
      <Animated.View
        entering={FadeIn.duration(DURATION.base)}
        exiting={FadeOut.duration(DURATION.fast)}
        style={[StyleSheet.absoluteFill, styles.backdrop]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>

      {/* ── Popover card — anchored to bottom-right ──────── */}
      <View
        pointerEvents="box-none"
        style={{
          flex:           1,
          justifyContent: 'flex-end',
          alignItems:     'flex-end',
          paddingBottom:  74,   // clears the tab bar (60 + safe area fudge)
          paddingRight:   t.spacing.sm,
        }}
      >
        <Animated.View
          style={[
            cardStyle,
            {
              width:           260,
              backgroundColor: t.colors.bgCard,
              borderRadius:    t.radius.molecular,
              borderWidth:     1,
              borderColor:     t.colors.border,
              overflow:        'hidden',
              ...t.shadow.lg,
            },
          ]}
        >
          {/* User identity header */}
          {user && (
            <View style={{
              paddingHorizontal: t.spacing.md,
              paddingVertical:   t.spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: t.colors.border,
              gap: 2,
            }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: t.fontFamily.bodySemibold,
                  fontSize:   t.fontSize.sm,
                  color:      t.colors.textPrimary,
                }}
              >
                {user.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: t.fontFamily.mono,
                  fontSize:   10,
                  color:      t.colors.textMuted,
                }}
              >
                {user.email}
              </Text>
            </View>
          )}

          {/* Theme picker */}
          <View style={{ padding: t.spacing.sm }}>
            <Text style={{
              fontFamily:    t.fontFamily.mono,
              fontSize:      10,
              fontWeight:    '700',
              color:         t.colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom:  6,
              paddingHorizontal: 4,
            }}>
              Appearance
            </Text>

            <View style={{
              flexDirection:   'row',
              backgroundColor: t.colors.bgRaised,
              borderRadius:    t.radius.atomic,
              padding:         3,
              gap:             2,
            }}>
              <ThemePill t={t} label="System" icon={Monitor} active={mode === 'system'} onPress={() => setMode('system')} />
              <ThemePill t={t} label="Light"  icon={Sun}     active={mode === 'light'}  onPress={() => setMode('light')}  />
              <ThemePill t={t} label="Dark"   icon={Moon}    active={mode === 'dark'}   onPress={() => setMode('dark')}   />
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: t.colors.border }} />

          {/* Sign out */}
          <SignOutRow t={t} onPress={handleSignOut} />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Theme pill ────────────────────────────────────────────────
function ThemePill({ t, label, icon: Icon, active, onPress }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <Pressable
        onPressIn={()  => { scale.value = withSpring(TAP.button, SPRING.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING.snappy); }}
        onPress={onPress}
        style={{
          flexDirection:     'column',
          alignItems:        'center',
          justifyContent:    'center',
          gap:               2,
          paddingVertical:   8,
          paddingHorizontal: 4,
          borderRadius:      t.radius.atomic - 3,
          backgroundColor:   active ? t.colors.bgCard : 'transparent',
          borderWidth:       1,
          borderColor:       active ? t.colors.brandBorder : 'transparent',
          ...(active ? t.shadow.sm : {}),
        }}
      >
        <Icon
          size={15}
          color={active ? t.colors.brandText : t.colors.textMuted}
          strokeWidth={2.4}
        />
        <Text style={{
          fontFamily: active ? t.fontFamily.bodySemibold : t.fontFamily.body,
          fontSize:   10,
          color:      active ? t.colors.brandText : t.colors.textMuted,
        }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Sign out row ──────────────────────────────────────────────
function SignOutRow({ t, onPress }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={()  => { scale.value = withSpring(0.98, SPRING.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING.snappy); }}
        onPress={onPress}
        style={{
          flexDirection:  'row',
          alignItems:     'center',
          gap:            t.spacing.sm,
          paddingVertical:   t.spacing.sm,
          paddingHorizontal: t.spacing.md,
        }}
      >
        <View style={{
          width:           30,
          height:          30,
          borderRadius:    t.radius.atomic,
          backgroundColor: t.colors.redBg,
          borderWidth:     1,
          borderColor:     t.colors.redBorder,
          alignItems:      'center',
          justifyContent:  'center',
        }}>
          <LogOut size={14} color={t.colors.red} strokeWidth={2.4} />
        </View>
        <Text style={{
          fontFamily: t.fontFamily.bodySemibold,
          fontSize:   t.fontSize.sm,
          color:      t.colors.red,
        }}>
          Sign out
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});