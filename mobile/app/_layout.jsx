import { useFonts }                           from 'expo-font';
import { Slot, SplashScreen }                 from 'expo-router';
import { StatusBar }                          from 'expo-status-bar';
import { useEffect }                          from 'react';
import { View }                               from 'react-native';
import { GestureHandlerRootView }             from 'react-native-gesture-handler';
// Per-weight subpath imports: the package roots require every weight
// (60+ font files), which would all ship inside the app.
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold }     from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { Figtree_400Regular }             from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium }              from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold }            from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold }                from '@expo-google-fonts/figtree/700Bold';
import { IBMPlexMono_400Regular }         from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_600SemiBold }        from '@expo-google-fonts/ibm-plex-mono/600SemiBold';

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
  // Roll Call type: Bricolage Grotesque (display), Figtree (body),
  // IBM Plex Mono (labels). Keys match fontFamily in theme/tokens.js.
  const [fontsLoaded, fontError] = useFonts({
    'Bricolage-SemiBold':  BricolageGrotesque_600SemiBold,
    'Bricolage-Bold':      BricolageGrotesque_700Bold,
    'Figtree':             Figtree_400Regular,
    'Figtree-Medium':      Figtree_500Medium,
    'Figtree-SemiBold':    Figtree_600SemiBold,
    'Figtree-Bold':        Figtree_700Bold,
    'PlexMono':            IBMPlexMono_400Regular,
    'PlexMono-SemiBold':   IBMPlexMono_600SemiBold,
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