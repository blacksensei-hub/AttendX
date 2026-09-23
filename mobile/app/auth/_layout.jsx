import {
  View, KeyboardAvoidingView, Platform, ScrollView,
}                          from 'react-native';
import { Slot }            from 'expo-router';
import { StatusBar }       from 'expo-status-bar';

import { useTheme, useThemeMode } from '../../src/theme/ThemeProvider';

/**
 * ═════════════════════════════════════════════════════════════════
 * Auth layout — wraps login/register/use-web.
 *
 * Responsibilities:
 *   • Keyboard avoiding — so inputs don't hide under the keyboard
 *   • Scrollable container — small phones can't fit the full form
 *   • Ambient brand glow in the corner (matches web AuthLayout)
 *   • Theme-aware background
 *
 * No tab bar, no nav header — it's an intentionally bare canvas so
 * the forms dominate attention.
 * ═════════════════════════════════════════════════════════════════
 */
export default function AuthLayout() {
  const t                = useTheme();
  const { resolvedMode } = useThemeMode();

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />

      {/* One quiet wash of cobalt, top right. The page is paper,
          not a light show. */}
      <View
        pointerEvents="none"
        style={{
          position:        'absolute',
          top:             -140,
          right:           -140,
          width:           320,
          height:          320,
          backgroundColor: t.colors.brandSubtle,
          borderRadius:    t.radius.pill,
          opacity:         0.7,
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow:        1,
            justifyContent:  'center',
            padding:         t.spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Slot />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}