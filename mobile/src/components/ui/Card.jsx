import { View }           from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
}                         from 'react-native-reanimated';

import { useTheme }       from '../../theme/ThemeProvider';
import { spring, TAP }    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Card — the molecular surface.
 *
 * Theme-aware. Supports:
 *   • Different elevation levels (none / sm / md / lg)
 *   • Press feedback (when onPress is provided)
 *   • Optional tinted accent — subtle glow in the corner matching
 *     a semantic colour (brand/green/amber/red/violet).
 *   • Raised variant (uses bgRaised instead of bgCard)
 *
 * Props:
 *   onPress      — makes the card interactive with spring compression
 *   elevation    — 'none' | 'sm' | 'md' (default) | 'lg'
 *   variant      — 'default' | 'raised' | 'outlined'
 *   accent       — 'brand' | 'green' | 'amber' | 'red' | 'violet'
 *   accentIntensity — 'subtle' (default) | 'bold'
 *   padded       — apply default padding (default: true)
 * ═════════════════════════════════════════════════════════════════
 */
export default function Card({
  children,
  onPress,
  elevation = 'md',
  variant   = 'default',
  accent,
  accentIntensity = 'subtle',
  padded    = true,
  style,
  ...rest
}) {
  const t = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Resolve background + border based on variant
  const baseStyle = {
    backgroundColor: variant === 'raised'    ? t.colors.bgRaised
                   : variant === 'outlined'  ? 'transparent'
                   :                           t.colors.bgCard,
    borderWidth:     variant === 'outlined'  ? 1 : 0,
    borderColor:     t.colors.border,
    borderRadius:    t.radius.molecular,
    padding:         padded ? t.spacing.md : 0,
    overflow:        'hidden',
    position:        'relative',
    ...t.shadow[elevation],
    ...style,
  };

  const handlePressIn  = () => { scale.value = spring(TAP.card); };
  const handlePressOut = () => { scale.value = spring(1); };

  // The outer wrapper that animates on press
  const Wrapper = onPress ? Animated.View : View;
  const wrapperProps = onPress
    ? {
        style: animatedStyle,
        onStartShouldSetResponder: () => true,
        onResponderGrant:   handlePressIn,
        onResponderRelease: () => { handlePressOut(); onPress(); },
        onResponderTerminate: handlePressOut,
      }
    : {};

  return (
    <Wrapper {...wrapperProps}>
      <View style={baseStyle} {...rest}>
        {accent && (
          <AccentGlow
            theme={t}
            accent={accent}
            intensity={accentIntensity}
          />
        )}
        {children}
      </View>
    </Wrapper>
  );
}

// ─── Ambient glow in the top-right corner ────────────────────
function AccentGlow({ theme: t, accent, intensity }) {
  const bg = t.colors[`${accent}Bg`] ?? t.colors.brandSubtle;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top:      -40,
        right:    -40,
        width:    intensity === 'bold' ? 160 : 120,
        height:   intensity === 'bold' ? 160 : 120,
        backgroundColor: bg,
        opacity:  intensity === 'bold' ? 0.9 : 0.6,
        borderRadius: t.radius.pill,
      }}
    />
  );
}