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
 *
 * "Roll Call" redesign: cool paper canvas, navy ink, cobalt used
 * sparingly for the one action a screen exists for, and teal kept
 * for "present". Values match client/src/App.css one for one.
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
  organism:  24,   // modals, sheets, hero panels
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
  display:       'Montserrat-SemiBold',
  displayBold:   'Montserrat-Bold',
  body:          'Inter',
  bodyMedium:    'Inter-Medium',
  bodySemibold:  'Inter-SemiBold',
  bodyBold:      'Inter-Bold',
  mono:          'JetBrainsMono',
  monoBold:      'JetBrainsMono-SemiBold',
};

export const lineHeight = {
  tight:    1.2,
  snug:     1.35,
  normal:   1.5,
  relaxed:  1.6,
  loose:    1.7,
};

export const letterSpacing = {
  display:  -1.2,   // big headlines (28px and up)
  tight:    -0.6,
  snug:     -0.2,
  normal:    0,
  wide:      0.4,
  wider:     0.8,
  widest:    1.2,   // mono kickers
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
      shadowColor:   '#0B1B3F',
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
      shadowColor:   '#2248FF',
      shadowOffset:  { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius:  16,
    },
    android: { elevation: 6 },
  }),
};

// ─── Light palette ────────────────────────────────────────────
const lightColors = {
  // Surfaces — paper on paper, never pure white
  bg:           '#EEF1F5',
  bgRaised:     '#E4E8EF',
  bgCard:       '#F9FAFC',
  bgHover:      '#E4E8EF',
  bgOverlay:    'rgba(7, 13, 31, 0.52)',
  bgInverse:    '#0B1B3F',
  sidebarBg:    '#EEF1F5',
  topbarBg:     '#F9FAFC',

  // Borders
  border:       'rgba(11, 27, 63, 0.10)',
  borderHover:  'rgba(11, 27, 63, 0.20)',

  // Text — every step measured at 4.5:1 or better on bg
  textPrimary:    '#0B1B3F',
  textSecondary:  '#26365A',
  textMuted:      '#5A6680',
  textInverse:    '#EEF1F5',

  // Brand (cobalt)
  brand:        '#2248FF',
  brandText:    '#1B3BD9',
  brandSubtle:  'rgba(34, 72, 255, 0.08)',
  brandBorder:  'rgba(34, 72, 255, 0.26)',

  // Violet (admin, rare)
  violet:        '#5B3FD9',
  violetBg:      'rgba(91, 63, 217, 0.09)',
  violetBorder:  'rgba(91, 63, 217, 0.26)',

  // Teal (present). green = text-safe, greenFill = dots and bars
  green:        '#08735F',
  greenFill:    '#14C9A6',
  greenBg:      'rgba(20, 201, 166, 0.12)',
  greenBorder:  'rgba(8, 115, 95, 0.28)',

  // Amber (late)
  amber:        '#955600',
  amberFill:    '#F2A93B',
  amberBg:      'rgba(242, 169, 59, 0.16)',
  amberBorder:  'rgba(149, 86, 0, 0.28)',

  // Red (absent / error)
  red:          '#C42536',
  redFill:      '#E5484D',
  redBg:        'rgba(229, 72, 77, 0.10)',
  redBorder:    'rgba(196, 37, 54, 0.26)',

  // Skeleton shimmer
  shimmerBase:      '#E4E8EF',
  shimmerHighlight: '#F9FAFC',
};

// ─── Dark palette — a lecture hall at night, never pure black ──
const darkColors = {
  bg:           '#070D1F',
  bgRaised:     '#131E40',
  bgCard:       '#0C1530',
  bgHover:      '#16224A',
  bgOverlay:    'rgba(3, 6, 16, 0.72)',
  bgInverse:    '#EEF1F7',
  sidebarBg:    '#070D1F',
  topbarBg:     '#0A1229',

  border:       'rgba(238, 241, 247, 0.09)',
  borderHover:  'rgba(238, 241, 247, 0.18)',

  textPrimary:    '#EEF1F7',
  textSecondary:  'rgba(238, 241, 247, 0.80)',
  textMuted:      'rgba(238, 241, 247, 0.56)',
  textInverse:    '#0B1B3F',

  brand:        '#3D5CFF',
  brandText:    '#9BAEFF',
  brandSubtle:  'rgba(77, 107, 255, 0.14)',
  brandBorder:  'rgba(120, 146, 255, 0.34)',

  violet:        '#A994FF',
  violetBg:      'rgba(169, 148, 255, 0.12)',
  violetBorder:  'rgba(169, 148, 255, 0.30)',

  green:        '#2BD9B5',
  greenFill:    '#2BD9B5',
  greenBg:      'rgba(43, 217, 181, 0.12)',
  greenBorder:  'rgba(43, 217, 181, 0.30)',

  amber:        '#F5B13D',
  amberFill:    '#F5B13D',
  amberBg:      'rgba(245, 177, 61, 0.12)',
  amberBorder:  'rgba(245, 177, 61, 0.30)',

  red:          '#FF6B77',
  redFill:      '#FF6B77',
  redBg:        'rgba(255, 107, 119, 0.12)',
  redBorder:    'rgba(255, 107, 119, 0.30)',

  shimmerBase:      '#131E40',
  shimmerHighlight: '#1B2A55',
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