import { View, Text } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { useTheme }  from '../../theme/ThemeProvider';
import IconTile      from './IconTile';
import Button        from './Button';
import { DURATION }  from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * EmptyState — shared component for "nothing to show" screens.
 *
 * Mirrors the web app's empty state pattern:
 *   - Dashed border card
 *   - 64px icon tile (brand-tinted for create-something CTAs,
 *     muted for purely informational empty states)
 *   - Bold display headline
 *   - Muted helper text
 *   - Optional CTA button
 *
 * Why a shared component:
 *   This pattern was previously duplicated across screens with
 *   slightly different paddings, font sizes, and animation timings.
 *   Centralising means a future styling tweak happens in one place.
 *
 * Usage:
 *   <EmptyState
 *     icon={BookOpen}
 *     title="No classes yet"
 *     message="Create your first class on the web app to get started."
 *   />
 *
 *   With a CTA:
 *   <EmptyState
 *     icon={Plus}
 *     iconTone="brand"
 *     title="Ready to take attendance?"
 *     message="Open a session and students can scan in."
 *     actionLabel="Open session"
 *     onAction={handleOpen}
 *   />
 * ═════════════════════════════════════════════════════════════════
 */
export default function EmptyState({
  icon,
  iconTone = 'muted',  // 'muted' for nothing-to-show, 'brand' for CTA
  title,
  message,
  actionLabel,
  actionIcon,
  onAction,
  loading = false,
}) {
  const t = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.medium)}
      style={{
        alignItems:      'center',
        gap:             t.spacing.sm,
        paddingVertical: t.spacing.lg,
        paddingHorizontal: t.spacing.md,
        borderWidth:     1,
        borderStyle:     'dashed',
        borderColor:     t.colors.borderHover ?? t.colors.border,
        borderRadius:    t.radius.molecular,
        backgroundColor: t.colors.bgCard,
      }}
    >
      <Animated.View entering={ZoomIn.delay(80).duration(DURATION.medium)}>
        <IconTile icon={icon} tone={iconTone} size="lg" />
      </Animated.View>

      <Text style={{
        fontFamily: t.fontFamily.displayBold,
        fontSize:   t.fontSize.md,
        color:      t.colors.textPrimary,
        textAlign:  'center',
        marginTop:  t.spacing.xs,
      }}>
        {title}
      </Text>

      {message && (
        <Text style={{
          fontFamily: t.fontFamily.body,
          fontSize:   t.fontSize.sm,
          color:      t.colors.textMuted,
          textAlign:  'center',
          maxWidth:   320,
          lineHeight: t.fontSize.sm * 1.5,
        }}>
          {message}
        </Text>
      )}

      {actionLabel && onAction && (
        <View style={{ marginTop: t.spacing.xs + 2, width: '100%', maxWidth: 320 }}>
          <Button
            label={actionLabel}
            icon={actionIcon}
            size="md"
            fullWidth
            loading={loading}
            onPress={onAction}
          />
        </View>
      )}
    </Animated.View>
  );
}