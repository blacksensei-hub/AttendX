import { useFonts }                           from 'expo-font';
import { Slot, SplashScreen }                 from 'expo-router';
import { StatusBar }                          from 'expo-status-bar';
import { useEffect }                          from 'react';
import { View }                               from 'react-native';
import { GestureHandlerRootView }             from 'react-native-gesture-handler';
// Per-weight subpath imports: the package roots require every weight
// (18+ font files each), which would all ship inside the app.
import { Montserrat_600SemiBold }         from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold }             from '@expo-google-fonts/montserrat/700Bold';
import { Inter_400Regular }               from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium }                from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold }              from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold }                  from '@expo-google-fonts/inter/700Bold';
import { JetBrainsMono_400Regular }       from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_600SemiBold }      from '@expo-google-fonts/jetbrains-mono/600SemiBold';

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
  // Montserrat (headlines, matches the logo), Inter (body),
  // JetBrains Mono (labels). Keys match fontFamily in theme/tokens.js.
  const [fontsLoaded, fontError] = useFonts({
    'Montserrat-SemiBold':  Montserrat_600SemiBold,
    'Montserrat-Bold':      Montserrat_700Bold,
    'Inter':                Inter_400Regular,
    'Inter-Medium':         Inter_500Medium,
    'Inter-SemiBold':       Inter_600SemiBold,
    'Inter-Bold':           Inter_700Bold,
    'JetBrainsMono':        JetBrainsMono_400Regular,
    'JetBrainsMono-SemiBold': JetBrainsMono_600SemiBold,
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