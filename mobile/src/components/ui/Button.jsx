import {
  Pressable, Text, View, ActivityIndicator,
}                            from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
}                            from 'react-native-reanimated';

import { useTheme }          from '../../theme/ThemeProvider';
import { spring, TAP, SPRING } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Button — the universal pressable action.
 *
 * Variants:
 *   primary   — brand-coloured, filled, for the main action
 *   secondary — subtle, tinted, for secondary actions
 *   ghost     — no background, for tertiary
 *   danger    — red, filled, for destructive actions
 *   success   — green, filled, for confirmations
 *
 * Sizes:
 *   sm  (36px) — compact bars, inline actions
 *   md  (44px) — default
 *   lg  (52px) — hero CTAs, form submits
 *
 * Features:
 *   • Spring compression on press
 *   • Icon before or after label
 *   • Loading state (spinner replaces icon)
 *   • Disabled state (reduced opacity, no press)
 *   • Full-width option
 * ═════════════════════════════════════════════════════════════════
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size    = 'md',
  icon:      Icon,
  iconRight: IconRight,
  loading  = false,
  disabled = false,
  fullWidth = false,
  style,
}) {
  const t = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const v = resolveVariant(t, variant);
  const s = resolveSize(t, size);
  const inactive = disabled || loading;

  return (
    <Animated.View style={[animatedStyle, fullWidth && { width: '100%' }]}>
      <Pressable
        onPress={inactive ? undefined : onPress}
        onPressIn={()  => { if (!inactive) scale.value = spring(TAP.button); }}
        onPressOut={() => { scale.value = spring(1); }}
        disabled={inactive}
        style={({ pressed }) => ([
          {
            flexDirection:     'row',
            alignItems:        'center',
            justifyContent:    'center',
            gap:               t.spacing.xs + 2,
            height:            s.height,
            paddingHorizontal: s.paddingX,
            borderRadius:      t.radius.atomic,
            backgroundColor:   v.bg,
            borderWidth:       v.borderWidth,
            borderColor:       v.border,
            opacity:           inactive ? 0.55 : 1,
            ...v.shadow,
          },
          style,
        ])}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={v.color}
          />
        ) : Icon ? (
          <Icon size={s.icon} color={v.color} strokeWidth={2.4} />
        ) : null}

        <Text style={{
          color:      v.color,
          fontFamily: t.fontFamily.bodySemibold,
          fontSize:   s.fontSize,
          letterSpacing: t.letterSpacing.snug,
        }}>
          {label}
        </Text>

        {IconRight && !loading && (
          <IconRight size={s.icon} color={v.color} strokeWidth={2.4} />
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Variant resolution ───────────────────────────────────────
function resolveVariant(t, variant) {
  switch (variant) {
    case 'primary':
      return {
        bg:     t.colors.brand,
        color:  '#ffffff',
        border: 'transparent',
        borderWidth: 0,
        shadow: t.shadow.brand,
      };
    case 'secondary':
      return {
        bg:     t.colors.brandSubtle,
        color:  t.colors.brandText,
        border: t.colors.brandBorder,
        borderWidth: 1,
        shadow: {},
      };
    case 'ghost':
      return {
        bg:     'transparent',
        color:  t.colors.textSecondary,
        border: 'transparent',
        borderWidth: 0,
        shadow: {},
      };
    case 'danger':
      return {
        bg:     t.colors.redBg,
        color:  t.colors.red,
        border: t.colors.redBorder,
        borderWidth: 1,
        shadow: {},
      };
    case 'success':
      return {
        bg:     t.colors.green,
        color:  '#ffffff',
        border: 'transparent',
        borderWidth: 0,
        shadow: {},
      };
    default:
      return resolveVariant(t, 'primary');
  }
}

// ─── Size resolution ──────────────────────────────────────────
function resolveSize(t, size) {
  switch (size) {
    case 'sm': return { height: 36, paddingX: t.spacing.md, fontSize: t.fontSize.xs, icon: 14 };
    case 'lg': return { height: 52, paddingX: t.spacing.lg, fontSize: t.fontSize.md, icon: 18 };
    case 'md':
    default:   return { height: 44, paddingX: t.spacing.md, fontSize: t.fontSize.sm, icon: 16 };
  }
}