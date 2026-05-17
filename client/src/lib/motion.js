/**
 * ═════════════════════════════════════════════════════════════════
 * AttendX — Motion Primitives
 *
 * Single source of truth for all animations. Every curve, duration,
 * and spring preset in the app must come from this file.
 *
 * Three easing curves. Three only. That's the rule.
 * ═════════════════════════════════════════════════════════════════
 */

// ─── Easing curves ──────────────────────────────────────────────
// Used by Framer Motion transitions via `ease: EASE.entry` etc.
export const EASE = {
  entry:  [0.16, 1, 0.3, 1],      // Expo out — elements arriving with intent
  state:  [0.65, 0, 0.35, 1],     // InOut — state switches (toggles, tabs)
  exit:   [0.7, 0, 0.84, 0],      // Expo in — elements leaving faster than entering
  bounce: [0.34, 1.56, 0.64, 1],  // Soft overshoot — celebration moments only
};

// ─── Durations (seconds — Framer Motion expects seconds) ────────
export const DURATION = {
  fast:   0.14,
  base:   0.22,
  medium: 0.32,
  slow:   0.48,
};

// ─── Spring presets ─────────────────────────────────────────────
// Springs feel physical; curves feel mechanical. Use springs whenever
// an element is responding to user input, not just being animated.
export const SPRING = {
  // Snappy — buttons, card presses, list items arriving
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 },
  // Gentle — layout transitions, shared element morphs
  gentle: { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 },
  // Page   — route changes, big transitions
  page:   { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 },
  // Bounce — celebration (perfect attendance, approval success)
  bounce: { type: 'spring', stiffness: 500, damping: 18, mass: 0.7 },
};

// ─── List orchestration ─────────────────────────────────────────
// Stagger caps internally at ~12 items (480ms total max) so long
// rosters don't animate for 3 seconds. After that delayChildren
// orchestration folds children into a single "landing" moment.
export const listContainer = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren:   0.08,
      when:            'beforeChildren',
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.fast, ease: EASE.exit },
  },
};

export const listItem = {
  hidden:  { opacity: 0, y: 16, scale: 0.96 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: SPRING.snappy,
  },
  exit: {
    opacity: 0, y: -8, scale: 0.96,
    transition: { duration: DURATION.base, ease: EASE.exit },
  },
};

// ─── Modal / overlay ────────────────────────────────────────────
// Backdrop fades first, then content springs in from behind.
// Exits reverse quickly — users should never feel trapped.
export const overlayBackdrop = {
  hidden:  { opacity: 0 },
  visible: {
    opacity:    1,
    transition: { duration: DURATION.base, ease: EASE.state },
  },
  exit: {
    opacity:    0,
    transition: { duration: DURATION.fast, ease: EASE.exit },
  },
};

export const overlayContent = {
  hidden:  { opacity: 0, scale: 0.94, y: 12 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: SPRING.snappy,
  },
  exit: {
    opacity: 0, scale: 0.96, y: 8,
    transition: { duration: DURATION.fast, ease: EASE.exit },
  },
};

// ─── Toast / notification ───────────────────────────────────────
export const toast = {
  hidden:  { opacity: 0, y: -16, scale: 0.9 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: SPRING.snappy,
  },
  exit: {
    opacity: 0, y: -12, scale: 0.95,
    transition: { duration: DURATION.base, ease: EASE.exit },
  },
};

// ─── Page transitions ───────────────────────────────────────────
// Used by PageShell to wrap every routed page. Pairs with
// AnimatePresence mode="wait" in the router outlet.
export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1, y: 0,
    transition: { ...SPRING.page, delay: 0.05 },
  },
  exit: {
    opacity: 0, y: -8,
    transition: { duration: DURATION.base, ease: EASE.exit },
  },
};

// ─── Tap / hover motion presets ─────────────────────────────────
// Apply these to interactive elements for consistent "pressable" feel.
// Usage: <motion.button whileTap={TAP.button} whileHover={HOVER.lift}>
export const TAP = {
  button: { scale: 0.97 },
  card:   { scale: 0.99 },
};

export const HOVER = {
  lift:  { y: -2 },
  scale: { scale: 1.02 },
};