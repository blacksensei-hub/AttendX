// mobile/src/components/SplashScreen.jsx
import { useEffect }              from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withDelay,
  FadeIn,
}                                 from 'react-native-reanimated';

/**
 * ═════════════════════════════════════════════════════════════════
 * SplashScreen — branded launch moment (in-app, not native).
 *
 * Why in-app rather than the expo-splash-screen config plugin:
 * from SDK 52 onward, Expo Go shows its OWN icon instead of your
 * configured splash, and development builds don't reflect every
 * plugin property. Since this app is demoed through Expo Go, a
 * native splash would simply never be seen. This component renders
 * inside the app, so it shows regardless of how the app is run.
 *
 * Unlike the web splash, this one is covering real work — the token
 * read from SecureStore and the /auth/me round-trip both happen
 * while it's on screen, so the time isn't invented.
 *
 * Dark background is hardcoded rather than read from the theme:
 * this renders before the theme provider has necessarily settled,
 * and a flash of the wrong palette on launch is exactly what a
 * splash is supposed to prevent.
 * ═════════════════════════════════════════════════════════════════
 */
export default function SplashScreen({ tagline = 'Smart attendance. Simple experience.' }) {
  // Sweeping hairline — a quiet "something is happening" signal that
  // doesn't compete with the logo the way a spinner would.
  const sweep = useSharedValue(-1);

  useEffect(() => {
    sweep.value = withDelay(
      250,
      withRepeat(
        withSequence(
          withTiming(1,  { duration: 1100 }),
          withTiming(-1, { duration: 0 })
        ),
        -1,
        false
      )
    );
  }, [sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * 140 }],
  }));

  return (
    <View style={s.container}>
      {/* Ambient glow behind the mark */}
      <View style={s.glow} pointerEvents="none" />

      {/* Logo plate — the asset carries a white background, so it sits
          on a white card rather than as a bare rectangle on the dark. */}
      <Animated.View entering={FadeIn.duration(550)} style={s.plate}>
        <Image
          source={require('../../assets/logo-full.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.Text entering={FadeIn.delay(250).duration(500)} style={s.tagline}>
        {tagline}
      </Animated.Text>

      {/* Progress hairline */}
      <Animated.View entering={FadeIn.delay(350).duration(400)} style={s.track}>
        <Animated.View style={[s.sweep, sweepStyle]} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#0a0a14',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             24,
    padding:         24,
  },
  glow: {
    position:        'absolute',
    width:           340,
    height:          340,
    borderRadius:    170,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    // RN has no blur filter on plain Views — a low-opacity circle
    // reads similarly enough at this size without pulling in
    // expo-blur just for a launch screen.
    opacity:         0.9,
  },
  plate: {
    backgroundColor: '#ffffff',
    borderRadius:    20,
    paddingVertical:   18,
    paddingHorizontal: 26,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.5,
    shadowRadius:    24,
    shadowOffset:    { width: 0, height: 12 },
    elevation:       12,
  },
  logo: {
    width:  220,
    height: 84,
  },
  tagline: {
    color:         'rgba(255,255,255,0.5)',
    fontSize:      13,
    letterSpacing: 0.2,
    textAlign:     'center',
  },
  track: {
    width:           140,
    height:          2,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow:        'hidden',
  },
  sweep: {
    width:           84,
    height:          '100%',
    borderRadius:    2,
    backgroundColor: '#3b82f6',
  },
});