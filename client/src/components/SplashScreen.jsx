// client/src/components/SplashScreen.jsx
import { motion } from 'framer-motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * SplashScreen — the first-load moment.
 *
 * The dark-surface AttendX logo on its own navy, with a hairline that
 * sweeps underneath. Short on purpose: on the web a splash is
 * branding, not a loading gate (the router mounts underneath it).
 *
 * Fixed background rather than var(--bg) so it looks the same
 * whichever theme lands on <html> underneath it.
 * ═════════════════════════════════════════════════════════════════
 */
const EASE_OUT = [0.16, 1, 0.3, 1];

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        background:     '#080C17',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            28,
        padding:        24,
      }}
    >
      <div aria-hidden="true" style={{
        position:      'absolute',
        width:         560,
        height:        560,
        maxWidth:      '100vw',
        maxHeight:     '100vw',
        borderRadius:  '50%',
        background:    'radial-gradient(closest-side, rgba(61,92,255,0.18), transparent)',
        pointerEvents: 'none',
      }} />

      <motion.img
        src="/brand/logo-dark.webp"
        alt="AttendX, Class Attendance Management System"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        style={{ position: 'relative', width: 'min(340px, 78vw)', height: 'auto' }}
      />

      <div aria-hidden="true" style={{
        position:     'relative',
        width:        140,
        height:       2,
        borderRadius: 2,
        background:   'rgba(238,241,247,0.1)',
        overflow:     'hidden',
      }}>
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '160%' }}
          transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity, delay: 0.2 }}
          style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, transparent, #14C9A6, transparent)' }}
        />
      </div>
    </motion.div>
  );
}
