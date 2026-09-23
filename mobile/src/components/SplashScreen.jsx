// mobile/src/components/SplashScreen.jsx
import { useEffect }              from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withDelay, withRepeat, withSequence, Easing, FadeIn,
}                                 from 'react-native-reanimated';
import Svg, { Path, G }           from 'react-native-svg';

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
 * Roll Call edition: the mark assembles itself. The four scan
 * brackets close in from outside, then the teal check draws. The
 * mark is vector (react-native-svg), not the old logo-full.png, so
 * there is no image asset for a Release build to fail to resolve.
 *
 * Colours are hardcoded on purpose: this can render before the theme
 * has settled, and a flash of the wrong palette at launch is exactly
 * what a splash exists to prevent.
 * ═════════════════════════════════════════════════════════════════
 */
const AnimatedPath = Animated.createAnimatedComponent(Path);
const EASE_OUT     = Easing.bezier(0.16, 1, 0.3, 1);
const CHECK_LEN    = 34;

const CORNERS = [
  { d: 'M14 25v-5a6 6 0 0 1 6-6h5', dx: -1, dy: -1 },
  { d: 'M39 14h5a6 6 0 0 1 6 6v5',  dx:  1, dy: -1 },
  { d: 'M50 39v5a6 6 0 0 1-6 6h-5', dx:  1, dy:  1 },
  { d: 'M25 50h-5a6 6 0 0 1-6-6v-5', dx: -1, dy:  1 },
];

function Corner({ d, dx, dy, delay }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 600, easing: EASE_OUT }));
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity:   p.value,
    transform: [
      { translateX: (1 - p.value) * dx * 10 },
      { translateY: (1 - p.value) * dy * 10 },
    ],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        <G fill="none" stroke="#6F8BFF" strokeWidth={4} strokeLinecap="round">
          <Path d={d} />
        </G>
      </Svg>
    </Animated.View>
  );
}

export default function SplashScreen({ tagline = 'Every seat, counted' }) {
  const check = useSharedValue(CHECK_LEN);
  const pulse = useSharedValue(0);

  useEffect(() => {
    check.value = withDelay(450, withTiming(0, { duration: 450, easing: EASE_OUT }));
    // A slow breath on the glow while real work happens underneath
    pulse.value = withDelay(900, withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    ));
  }, [check, pulse]);

  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: check.value }));
  const glowStyle  = useAnimatedStyle(() => ({
    opacity:   0.55 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  return (
    <View style={s.container}>
      <Animated.View style={[s.glow, glowStyle]} pointerEvents="none" />

      <View style={s.mark} accessibilityRole="image" accessibilityLabel="AttendX">
        {CORNERS.map((c, i) => <Corner key={i} {...c} delay={50 * i} />)}
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 64 64">
          <AnimatedPath
            d="M22.5 32.5l6.5 6.5 13-13.5"
            fill="none"
            stroke="#14C9A6"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
            animatedProps={checkProps}
          />
        </Svg>
      </View>

      <Animated.Text entering={FadeIn.delay(300).duration(600)} style={s.word}>
        Attend<Text style={{ color: '#8FA3FF' }}>X</Text>
      </Animated.Text>

      <Animated.Text entering={FadeIn.delay(550).duration(500)} style={s.tagline}>
        {tagline.toUpperCase()}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#070D1F',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             18,
    padding:         24,
  },
  glow: {
    position:        'absolute',
    width:           320,
    height:          320,
    borderRadius:    160,
    backgroundColor: 'rgba(61, 92, 255, 0.16)',
  },
  mark: {
    width:  96,
    height: 96,
  },
  word: {
    color:         '#EEF1F7',
    fontFamily:    'Bricolage-Bold',
    fontSize:      34,
    letterSpacing: -1.3,
  },
  tagline: {
    color:         'rgba(238, 241, 247, 0.5)',
    fontFamily:    'PlexMono',
    fontSize:      11,
    letterSpacing: 1.6,
  },
});
