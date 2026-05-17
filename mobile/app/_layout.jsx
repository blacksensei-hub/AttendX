import { useFonts }                           from 'expo-font';
import { Slot, SplashScreen }                 from 'expo-router';
import { StatusBar }                          from 'expo-status-bar';
import { useEffect }                          from 'react';
import { View }                               from 'react-native';
import { GestureHandlerRootView }             from 'react-native-gesture-handler';

import {
  ThemeProvider, useTheme, useThemeMode,
}                                             from '../src/theme/ThemeProvider';
import ErrorBoundary                          from '../src/components/ErrorBoundary';

/**
 * ═════════════════════════════════════════════════════════════════
 * Root layout — AttendX mobile.
 *
 * Responsibilities:
 *   1. Keep the native splash screen visible until fonts load
 *      (prevents the "flash of system font" on cold start).
 *   2. Wrap the app in ThemeProvider so every screen can call useTheme().
 *   3. Wrap in GestureHandlerRootView — required by react-native-screens
 *      and gesture-based navigation. Has to be the outermost wrapper
 *      on the native side.
 *   4. Wrap the entire app in ErrorBoundary so uncaught render errors
 *      anywhere in the tree show a friendly fallback rather than
 *      crashing to the red screen of death.
 *   5. Sync the StatusBar colour to the resolved theme.
 *
 * Order matters: ErrorBoundary sits OUTSIDE ThemeProvider deliberately.
 * If a render error originates inside ThemeProvider (e.g. a token lookup
 * goes wrong), an ErrorBoundary inside the provider would never catch
 * it because the error happens during the boundary's parent render.
 * Putting the boundary outside means it always catches.
 * ═════════════════════════════════════════════════════════════════
 */

// Keep the splash screen visible while we load fonts
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore — splash may have auto-hidden already if layout reloads
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Outfit':              require('../assets/fonts/Outfit-Regular.ttf'),
    'Outfit-Bold':         require('../assets/fonts/Outfit-Bold.ttf'),
    'Inter':               require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium':        require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold':      require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold':          require('../assets/fonts/Inter-Bold.ttf'),
    'JetBrainsMono':       require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Bold':  require('../assets/fonts/JetBrainsMono-Bold.ttf'),
  });

  // Hide the splash once fonts are ready (or failed) — don't hang forever
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <ThemedRoot />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

// Inner component so it can call useTheme() — must be inside the provider
function ThemedRoot() {
  const t                 = useTheme();
  const { resolvedMode }  = useThemeMode();

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </View>
  );
}