import { View, Text }        from 'react-native';
import Svg, { Rect, Path, G } from 'react-native-svg';

import { useTheme }          from '../../theme/ThemeProvider';

/**
 * ═════════════════════════════════════════════════════════════════
 * BrandMark — the AttendX mark drawn as vector.
 *
 * The four rounded scan brackets from the logo around the teal
 * check, on an ink plate. Drawn with react-native-svg rather than
 * shipped as a PNG, so it is sharp at any size and there is no image
 * asset to resolve at runtime (the old splash's require() of
 * logo-full.png is what rendered blank in Release builds).
 *
 *   <Mark size={40} />                      mark only
 *   <BrandMark size={32} />                 mark + wordmark
 *   <BrandMark size={32} tone="inverse" />  for dark surfaces
 * ═════════════════════════════════════════════════════════════════
 */
export function Mark({ size = 32, tone = 'default' }) {
  const t       = useTheme();
  const plate   = tone === 'inverse' ? '#EEF1F5' : t.colors.bgInverse;
  const bracket = tone === 'inverse' ? '#2248FF' : (t.mode === 'dark' ? '#2248FF' : '#6F8BFF');
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="AttendX">
      <Rect width="64" height="64" rx="15" fill={plate} />
      <G fill="none" stroke={bracket} strokeWidth={5} strokeLinecap="round">
        <Path d="M14 25v-5a6 6 0 0 1 6-6h5" />
        <Path d="M39 14h5a6 6 0 0 1 6 6v5" />
        <Path d="M50 39v5a6 6 0 0 1-6 6h-5" />
        <Path d="M25 50h-5a6 6 0 0 1-6-6v-5" />
      </G>
      <Path
        d="M22.5 32.5l6.5 6.5 13-13.5"
        fill="none"
        stroke="#14C9A6"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function BrandMark({ size = 32, tone = 'default', wordmark = true }) {
  const t   = useTheme();
  const ink = tone === 'inverse' ? '#EEF1F7' : t.colors.textPrimary;
  const x   = tone === 'inverse' ? '#8FA3FF' : t.colors.brandText;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Mark size={size} tone={tone} />
      {wordmark && (
        <Text style={{
          fontFamily:    t.fontFamily.displayBold,
          fontSize:      Math.round(size * 0.72),
          letterSpacing: -0.9,
          color:         ink,
        }}>
          Attend<Text style={{ color: x }}>X</Text>
        </Text>
      )}
    </View>
  );
}

/**
 * Kicker — the mono slash label ("STUDENT / TUESDAY 23 SEP").
 */
export function Kicker({ children, dot, color, style }) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>
      {dot && (
        <View style={{
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: dot === true ? t.colors.brand : dot,
        }} />
      )}
      <Text style={{
        fontFamily:    t.fontFamily.mono,
        fontSize:      10.5,
        letterSpacing: t.letterSpacing.widest,
        textTransform: 'uppercase',
        color:         color ?? t.colors.textMuted,
      }}>
        {children}
      </Text>
    </View>
  );
}
