import { View, Text, Pressable } from 'react-native';
import { useRouter }             from 'expo-router';
import { ChevronLeft }           from 'lucide-react-native';

import { useTheme }              from '../../theme/ThemeProvider';

/**
 * ═════════════════════════════════════════════════════════════════
 * Header — page header.
 *
 * Sits at the top of a screen below the safe-area. Structure:
 *
 *   [back] Title                                        [action]
 *          Subtitle
 *
 * Props:
 *   title      — display title (required)
 *   subtitle   — muted line below the title
 *   showBack   — render a back chevron on the left (default: auto)
 *                If the router can go back, default is true.
 *   onBack     — override the default back behaviour
 *   action     — arbitrary element rendered on the right
 *   align      — 'left' (default) | 'center' (iOS-style centred title)
 *
 * The component is presentational — it doesn't render the safe-area
 * space itself (that's Screen's job). Put it as the first child of
 * a Screen with `edges={['top']}` and it sits right where a native
 * title bar would be.
 * ═════════════════════════════════════════════════════════════════
 */
export default function Header({
  title,
  subtitle,
  showBack,
  onBack,
  action,
  align = 'left',
  style,
}) {
  const t      = useTheme();
  const router = useRouter();

  const canGoBack  = typeof router.canGoBack === 'function' && router.canGoBack();
  const renderBack = showBack ?? canGoBack;

  const handleBack = onBack ?? (() => {
    if (canGoBack) router.back();
  });

  const centered = align === 'center';

  return (
    <View style={[
      {
        flexDirection:  'row',
        alignItems:     'center',
        gap:            t.spacing.sm,
        marginBottom:   t.spacing.xs,
      },
      style,
    ]}>
      {renderBack && (
        <Pressable
          onPress={handleBack}
          hitSlop={t.hitSlop.medium}
          style={{
            width:          36,
            height:         36,
            borderRadius:   t.radius.atomic,
            backgroundColor: t.colors.bgRaised,
            borderWidth:    1,
            borderColor:    t.colors.border,
            alignItems:     'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={18} color={t.colors.textSecondary} strokeWidth={2.2} />
        </Pressable>
      )}

      <View style={{
        flex:       1,
        alignItems: centered ? 'center' : 'flex-start',
      }}>
        <Text
          numberOfLines={1}
          style={{
            color:         t.colors.textPrimary,
            fontFamily:    t.fontFamily.displayBold,
            fontSize:      t.fontSize.xl,
            letterSpacing: t.letterSpacing.tight,
            lineHeight:    t.fontSize.xl * 1.15,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            numberOfLines={2}
            style={{
              color:      t.colors.textMuted,
              fontFamily: t.fontFamily.body,
              fontSize:   t.fontSize.sm,
              marginTop:  2,
              lineHeight: t.fontSize.sm * 1.4,
              textAlign:  centered ? 'center' : 'left',
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {action && (
        <View style={{ marginLeft: 'auto' }}>
          {action}
        </View>
      )}
    </View>
  );
}
