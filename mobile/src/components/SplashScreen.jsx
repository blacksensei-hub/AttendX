// mobile/src/components/SplashScreen.jsx
import { useEffect }         from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withRepeat, withSequence, Easing,
}                            from 'react-native-reanimated';

/**
 * ═════════════════════════════════════════════════════════════════
 * SplashScreen — branded launch moment (in-app, not native).
 *
 * Why in-app rather than the expo-splash-screen config plugin:
 * Expo Go shows its own icon instead of a configured splash, so a
 * native splash would never be seen in demos. This renders inside
 * the app, so it shows however the app is run. It also covers real
 * work: the SecureStore token read and the /auth/me round-trip both
 * happen while it's on screen.
 *
 * The dark-surface AttendX logo on its own navy. The logo renders at
 * full opacity from the very first frame: the old splash faded its
 * logo in with a Reanimated `entering` animation, and in Release
 * builds the splash is often gone before that fade gets anywhere,
 * which is why only the glow behind it ever showed.
 *
 * Colours are hardcoded on purpose: this can render before the theme
 * has settled.
 * ═════════════════════════════════════════════════════════════════
 */
export default function SplashScreen() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    // A slow breath on the glow while real work happens underneath
    pulse.value = withDelay(300, withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    ));
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity:   0.55 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  return (
    <View style={s.container}>
      <Animated.View style={[s.glow, glowStyle]} pointerEvents="none" />
      <Image
        source={require('../../assets/brand/logo-dark.png')}
        accessibilityRole="image"
        accessibilityLabel="AttendX, Class Attendance Management System"
        resizeMode="contain"
        fadeDuration={0}
        style={s.logo}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#080C17',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  glow: {
    position:        'absolute',
    width:           340,
    height:          340,
    borderRadius:    170,
    backgroundColor: 'rgba(61, 92, 255, 0.14)',
  },
  logo: {
    width:  288,
    height: 180,
  },
});
