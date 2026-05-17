import { Platform } from 'react-native';

/**
 * ═════════════════════════════════════════════════════════════════
 * Design tokens — mobile.
 *
 * RN doesn't have CSS variables, so the design system lives as a
 * JavaScript object that screens import via useTheme().
 *
 * The token NAMES match the web (App.css) one-for-one so the
 * mental model is identical:
 *   web:    var(--brand-text)
 *   mobile: theme.colors.brandText
 *
 * Two palettes — light and dark — share the same shape so swapping
 * is a one-line operation in ThemeProvider.
 * ═════════════════════════════════════════════════════════════════
 */

// ─── Spacing — 8pt grid ───────────────────────────────────────
export const spacing = {
  none: 0,
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
};

// ─── Radius — 3-tier hierarchy ────────────────────────────────
export const radius = {
  atomic:    10,   // inputs, chips
  molecular: 16,   // cards
  organism:  22,   // modals, sheets
  pill:      999,
  none:      0,
};

// ─── Typography ───────────────────────────────────────────────
// Perfect-fourth scale (1.333) matching web
export const fontSize = {
  xs:    11,
  sm:    13,
  md:    15,
  lg:    18,
  xl:    24,
  xxl:   30,
  xxxl:  39,
  hero:  52,
};

export const fontWeight = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
};

// PostScript names of the loaded fonts (match expo-font keys)
export const fontFamily = {
  display:       'Outfit',
  displayBold:   'Outfit-Bold',
  body:          'Inter',
  bodyMedium:    'Inter-Medium',
  bodySemibold:  'Inter-SemiBold',
  bodyBold:      'Inter-Bold',
  mono:          'JetBrainsMono',
  monoBold:      'JetBrainsMono-Bold',
};

export const lineHeight = {
  tight:    1.2,
  snug:     1.35,
  normal:   1.5,
  relaxed:  1.6,
  loose:    1.7,
};

export const letterSpacing = {
  tight:    -0.4,
  snug:     -0.2,
  normal:    0,
  wide:      0.4,
  wider:     0.8,
  widest:    1.4,
};

// ─── Shadows — platform-aware ─────────────────────────────────
// iOS: shadowColor/Offset/Opacity/Radius. Android: elevation.
export const shadow = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius:  2,
    },
    android: { elevation: 1 },
  }),
  md: Platform.select({
    ios: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius:  8,
    },
    android: { elevation: 3 },
  }),
  lg: Platform.select({
    ios: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius:  20,
    },
    android: { elevation: 8 },
  }),
  xl: Platform.select({
    ios: {
      shadowColor:   '#000',
      shadowOffset:  { width: 0, height: 16 },
      shadowOpacity: 0.22,
      shadowRadius:  36,
    },
    android: { elevation: 14 },
  }),
  // Brand-tinted shadow — for primary buttons and live tiles
  brand: Platform.select({
    ios: {
      shadowColor:   '#3b82f6',
      shadowOffset:  { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius:  16,
    },
    android: { elevation: 6 },
  }),
};

// ─── Light palette ────────────────────────────────────────────
const lightColors = {
  // Surfaces
  bg:           '#fafafa',
  bgRaised:     '#f3f4f6',
  bgCard:       '#ffffff',
  bgHover:      '#f3f4f6',
  bgOverlay:    'rgba(15, 23, 42, 0.55)',
  sidebarBg:    '#f5f5f7',
  topbarBg:     '#ffffff',

  // Borders
  border:       '#e5e7eb',
  borderHover:  '#d1d5db',

  // Text — WCAG ladder
  textPrimary:    '#0f172a',
  textSecondary:  '#475569',
  textMuted:      '#64748b',
  textInverse:    '#ffffff',

  // Brand (blue)
  brand:        '#3b82f6',
  brandText:    '#2563eb',
  brandSubtle:  'rgba(59, 130, 246, 0.10)',
  brandBorder:  'rgba(59, 130, 246, 0.28)',

  // Violet (admin)
  violet:        '#8b5cf6',
  violetBg:      'rgba(139, 92, 246, 0.10)',
  violetBorder:  'rgba(139, 92, 246, 0.28)',

  // Green (success / present)
  green:        '#10b981',
  greenBg:      'rgba(16, 185, 129, 0.10)',
  greenBorder:  'rgba(16, 185, 129, 0.28)',

  // Amber (late / warn)
  amber:        '#f59e0b',
  amberBg:      'rgba(245, 158, 11, 0.10)',
  amberBorder:  'rgba(245, 158, 11, 0.28)',

  // Red (error / absent)
  red:          '#ef4444',
  redBg:        'rgba(239, 68, 68, 0.10)',
  redBorder:    'rgba(239, 68, 68, 0.28)',

  // Skeleton shimmer
  shimmerBase:      '#e5e7eb',
  shimmerHighlight: '#f3f4f6',
};

// ─── Dark palette ─────────────────────────────────────────────
const darkColors = {
  bg:           '#0a0a0b',
  bgRaised:     '#161618',
  bgCard:       '#1c1c1f',
  bgHover:      '#26262a',
  bgOverlay:    'rgba(0, 0, 0, 0.65)',
  sidebarBg:    '#0e0e10',
  topbarBg:     '#0f0f11',

  border:       '#2a2a2e',
  borderHover:  '#3a3a3f',

  textPrimary:    '#f8fafc',
  textSecondary:  '#cbd5e1',
  textMuted:      '#94a3b8',
  textInverse:    '#0a0a0b',

  brand:        '#3b82f6',
  brandText:    '#60a5fa',
  brandSubtle:  'rgba(59, 130, 246, 0.16)',
  brandBorder:  'rgba(59, 130, 246, 0.34)',

  violet:        '#a78bfa',
  violetBg:      'rgba(167, 139, 250, 0.14)',
  violetBorder:  'rgba(167, 139, 250, 0.32)',

  green:        '#34d399',
  greenBg:      'rgba(52, 211, 153, 0.14)',
  greenBorder:  'rgba(52, 211, 153, 0.32)',

  amber:        '#fbbf24',
  amberBg:      'rgba(251, 191, 36, 0.14)',
  amberBorder:  'rgba(251, 191, 36, 0.32)',

  red:          '#f87171',
  redBg:        'rgba(248, 113, 113, 0.14)',
  redBorder:    'rgba(248, 113, 113, 0.32)',

  shimmerBase:      '#26262a',
  shimmerHighlight: '#3a3a3f',
};

// ─── Z-index ladder ───────────────────────────────────────────
export const zIndex = {
  base:     0,
  elevated: 10,
  sticky:   20,
  drawer:   30,
  overlay:  40,
  modal:    50,
  toast:    60,
  tooltip:  70,
};

// ─── Hit slop — minimum tap target compensation ───────────────
export const hitSlop = {
  small:  { top: 8,  bottom: 8,  left: 8,  right: 8  },
  medium: { top: 12, bottom: 12, left: 12, right: 12 },
  large:  { top: 16, bottom: 16, left: 16, right: 16 },
};

// ─── Build a complete theme for a given mode ──────────────────
export function buildTheme(mode = 'light') {
  return {
    mode,
    colors:        mode === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    fontSize,
    fontWeight,
    fontFamily,
    lineHeight,
    letterSpacing,
    shadow,
    zIndex,
    hitSlop,
  };
}

export default buildTheme('light');