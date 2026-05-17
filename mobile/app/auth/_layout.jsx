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

      {/* Ambient brand glow — top-right corner */}
      <View
        pointerEvents="none"
        style={{
          position:        'absolute',
          top:             -100,
          right:           -100,
          width:           280,
          height:          280,
          backgroundColor: t.colors.brandSubtle,
          borderRadius:    t.radius.pill,
          opacity:         0.8,
        }}
      />
      {/* Secondary glow — bottom-left, subtle */}
      <View
        pointerEvents="none"
        style={{
          position:        'absolute',
          bottom:          -120,
          left:            -120,
          width:           240,
          height:          240,
          backgroundColor: t.colors.brandSubtle,
          borderRadius:    t.radius.pill,
          opacity:         0.4,
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