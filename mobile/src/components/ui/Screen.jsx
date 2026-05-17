import { ScrollView, View, RefreshControl } from 'react-native';
import { SafeAreaView }                     from 'react-native-safe-area-context';

import { useTheme }                         from '../../theme/ThemeProvider';

/**
 * ═════════════════════════════════════════════════════════════════
 * Screen — wraps every route.
 *
 * Mobile equivalent of the web's <PageShell>. Handles:
 *   • Safe-area insets (notch / home indicator)
 *   • Theme background
 *   • Optional scrolling
 *   • Consistent horizontal padding
 *   • Pull-to-refresh
 *
 * Props:
 *   scroll      — wrap content in a ScrollView (default: true)
 *   padded      — apply default horizontal padding (default: true)
 *   gap         — vertical gap between children (default: theme.spacing.md)
 *   refreshing  — show pull-to-refresh spinner
 *   onRefresh   — pull-to-refresh handler
 *   edges       — which safe-area edges to respect (default: ['top'])
 * ═════════════════════════════════════════════════════════════════
 */
export default function Screen({
  children,
  scroll     = true,
  padded     = true,
  gap,
  refreshing = false,
  onRefresh,
  edges      = ['top'],
  style,
  contentStyle,
}) {
  const t = useTheme();

  const containerStyle = {
    flex:            1,
    backgroundColor: t.colors.bg,
    ...style,
  };

  const innerStyle = {
    paddingHorizontal: padded ? t.spacing.md : 0,
    paddingVertical:   padded ? t.spacing.md : 0,
    gap:               gap ?? t.spacing.md,
    ...contentStyle,
  };

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={innerStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.colors.brand}
            colors={[t.colors.brand]}       // Android
            progressBackgroundColor={t.colors.bgCard}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, innerStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={containerStyle}
    >
      {content}
    </SafeAreaView>
  );
}