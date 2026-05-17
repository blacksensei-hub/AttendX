import {
  withSpring, withTiming, withSequence, withDelay,
  Easing, runOnJS,
} from 'react-native-reanimated';

/**
 * ═════════════════════════════════════════════════════════════════
 * Motion vocabulary — mobile.
 *
 * Mirrors the web motion library (client/src/lib/motion.js) so the
 * design language is consistent across platforms. Names map 1:1.
 *
 * Web uses framer-motion + CSS easing.
 * Mobile uses Reanimated's withSpring / withTiming with matching curves.
 *
 * Key concepts:
 *   • DURATION — base/medium/slow time constants
 *   • EASE     — three-curve system (entry / state / exit)
 *   • SPRING   — physics presets (snappy / gentle / page / bounce)
 *   • TAP      — press feedback (button / card)
 *   • helpers  — spring(), timing(), pulse(), shake(), successBounce()
 * ═════════════════════════════════════════════════════════════════
 */

// ─── Durations (ms) ───────────────────────────────────────────
// Same numbers as web for cross-platform muscle memory
export const DURATION = {
  fast:    120,
  base:    180,
  medium:  240,
  slow:    320,
  slower:  480,
};

// ─── Easing curves ────────────────────────────────────────────
// Three-curve system matching the web's EASE.entry/state/exit.
// On the web, framer-motion accepts cubic-bezier arrays directly.
// Reanimated wraps them via Easing.bezier(p1x, p1y, p2x, p2y).
export const EASE = {
  // Entry — content arrives. Soft overshoot, no jitter.
  entry:  Easing.bezier(0.16, 1.0,  0.30, 1.00),

  // State — element morphs in place (colour, position, size).
  // The "industry standard" curve — Material's standard easing.
  state:  Easing.bezier(0.40, 0.00, 0.20, 1.00),

  // Exit — content leaves. Quick, decisive.
  exit:   Easing.bezier(0.40, 0.00, 1.00, 1.00),

  // Bounce — playful overshoot for celebrations.
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1.00),

  // Linear — for continuous loops (spinners, glow pulses).
  linear: Easing.linear,
};

// ─── Spring presets ───────────────────────────────────────────
// Physics-based, frame-rate independent.
//   damping ↑ = less oscillation
//   stiffness ↑ = faster motion
//   mass ↑ = more inertia
export const SPRING = {
  // Snappy — UI controls (tap, hover, toggle). Quick, no bounce.
  snappy: {
    damping:           20,
    stiffness:         300,
    mass:              0.6,
    overshootClamping: false,
  },

  // Gentle — content entry, list items, sheet reveal.
  gentle: {
    damping:   18,
    stiffness: 180,
    mass:      0.8,
  },

  // Page — route transitions, modal dismissal.
  page: {
    damping:   24,
    stiffness: 140,
    mass:      1.0,
  },

  // Bounce — celebrations, badges, achievements. Visible overshoot.
  bounce: {
    damping:   8,
    stiffness: 240,
    mass:      0.5,
  },

  // Stiff — micro-interactions where any wobble feels wrong.
  stiff: {
    damping:           24,
    stiffness:         420,
    mass:              0.4,
    overshootClamping: true,
  },
};

// ─── Tap / press scale targets ────────────────────────────────
// Web uses whileTap={TAP.button} → scale 0.97
// Mobile achieves the same feel via withSpring
export const TAP = {
  button: 0.96,    // standard buttons
  card:   0.985,   // larger card-like surfaces
  icon:   0.88,    // small icon buttons (more dramatic)
};

// ─── Press lift (mobile equivalent of web hover lift) ─────────
export const PRESS_LIFT = {
  in:  { scale: 0.97, y: 0 },
  out: { scale: 1,    y: 0 },
};

// ─── Convenience wrappers — use inside Reanimated worklets ────
export const timing = (toValue, opts = {}) =>
  withTiming(toValue, {
    duration: opts.duration || DURATION.base,
    easing:   opts.easing   || EASE.state,
  });

export const spring = (toValue, preset = 'snappy') =>
  withSpring(toValue, SPRING[preset] ?? SPRING.snappy);

// ─── Common animation patterns ────────────────────────────────

/**
 * Stagger entrance — for list items that should cascade in.
 * Use with the index to compute a delay.
 *
 *   opacity.value = withDelay(staggerDelay(index), timing(1));
 */
export const staggerDelay = (index, baseDelay = 40) => index * baseDelay;

/**
 * Pulse — for live indicators, breathing icons, glow halos.
 * Use inside withRepeat:
 *
 *   scale.value = withRepeat(pulse(), -1, false);
 */
export const pulse = (peakScale = 1.1, duration = 800) =>
  withSequence(
    withTiming(peakScale, { duration, easing: EASE.state }),
    withTiming(1,         { duration, easing: EASE.state }),
  );

/**
 * Shake — subtle horizontal shake for form validation errors.
 *
 *   translateX.value = shake();
 */
export const shake = () =>
  withSequence(
    withTiming(-6, { duration: 60, easing: EASE.state }),
    withTiming( 6, { duration: 60, easing: EASE.state }),
    withTiming(-4, { duration: 60, easing: EASE.state }),
    withTiming( 4, { duration: 60, easing: EASE.state }),
    withTiming( 0, { duration: 60, easing: EASE.state }),
  );

/**
 * Success bounce — for confirmations, attendance marked.
 *
 *   scale.value = successBounce();
 */
export const successBounce = () =>
  withSequence(
    withTiming(0,    { duration: 0 }),
    withSpring(1.1,  SPRING.bounce),
    withSpring(1,    SPRING.snappy),
  );

// ─── Layout transition presets ────────────────────────────────
// Reanimated v3 has Layout.springify() and FadeIn/FadeOut for
// entering/exiting elements. These are pre-tuned profiles:
//
//   import { FadeInUp, FadeOut } from 'react-native-reanimated';
//   import { LAYOUT } from '../lib/motion';
//   <Animated.View entering={FadeInUp.duration(LAYOUT.listItem.entering.duration)}>

export const LAYOUT = {
  listItem: {
    entering: { duration: DURATION.medium, easing: EASE.entry },
    exiting:  { duration: DURATION.base,   easing: EASE.exit  },
  },
  modal: {
    entering: { duration: DURATION.slow,   easing: EASE.entry },
    exiting:  { duration: DURATION.medium, easing: EASE.exit  },
  },
  toast: {
    entering: { duration: DURATION.base,   easing: EASE.entry },
    exiting:  { duration: DURATION.fast,   easing: EASE.exit  },
  },
};

// Re-export commonly used Reanimated bits so screens import once
export { runOnJS, withDelay, withSequence };