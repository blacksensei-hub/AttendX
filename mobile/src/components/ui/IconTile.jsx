import { View }     from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';

/**
 * ═════════════════════════════════════════════════════════════════
 * IconTile — branded icon-in-a-tile.
 *
 * The signature element from the web design system: a small
 * rounded square with a tinted background, border, and centred
 * icon. Used for:
 *   • Card headers
 *   • Empty-state illustrations
 *   • Role avatars
 *   • Stat card accents
 *
 * Props:
 *   icon    — lucide icon component
 *   tone    — 'brand' (default) | 'green' | 'amber' | 'red' | 'violet' | 'neutral'
 *   size    — 'sm' (32) | 'md' (40, default) | 'lg' (48) | 'xl' (64)
 *   shadow  — whether to apply the tinted shadow glow (default: false)
 * ═════════════════════════════════════════════════════════════════
 */
export default function IconTile({
  icon: Icon,
  tone    = 'brand',
  size    = 'md',
  shadow  = false,
  style,
}) {
  const t = useTheme();
  const dims = resolveSize(size);
  const cfg  = resolveTone(t, tone);

  return (
    <View style={[
      {
        width:           dims.box,
        height:          dims.box,
        borderRadius:    t.radius.atomic,
        backgroundColor: cfg.bg,
        borderWidth:     1,
        borderColor:     cfg.border,
        alignItems:      'center',
        justifyContent:  'center',
        ...(shadow ? resolveShadow(t, tone) : {}),
      },
      style,
    ]}>
      {Icon && (
        <Icon
          size={dims.icon}
          color={cfg.color}
          strokeWidth={2.2}
        />
      )}
    </View>
  );
}

function resolveSize(size) {
  switch (size) {
    case 'sm': return { box: 32, icon: 14 };
    case 'lg': return { box: 48, icon: 22 };
    case 'xl': return { box: 64, icon: 28 };
    case 'md':
    default:   return { box: 40, icon: 18 };
  }
}

function resolveTone(t, tone) {
  switch (tone) {
    case 'brand':  return { bg: t.colors.brandSubtle, border: t.colors.brandBorder, color: t.colors.brandText };
    case 'green':  return { bg: t.colors.greenBg,     border: t.colors.greenBorder, color: t.colors.green     };
    case 'amber':  return { bg: t.colors.amberBg,     border: t.colors.amberBorder, color: t.colors.amber     };
    case 'red':    return { bg: t.colors.redBg,       border: t.colors.redBorder,   color: t.colors.red       };
    case 'violet': return { bg: t.colors.violetBg,    border: t.colors.violetBorder, color: t.colors.violet   };
    case 'neutral':
    default:       return { bg: t.colors.bgRaised,    border: t.colors.border,      color: t.colors.textSecondary };
  }
}

function resolveShadow(t, tone) {
  // Only brand has a pre-tuned shadow in the token system.
  // For other tones we skip the tinted shadow — can be extended later.
  return tone === 'brand' ? t.shadow.brand : {};
}