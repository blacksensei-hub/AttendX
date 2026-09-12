// client/src/components/SplashScreen.jsx
import { motion } from 'framer-motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * SplashScreen — branded first-load moment.
 *
 * Deliberately short. A splash on the web is pure branding: unlike
 * mobile, there's no token check or native boot to wait on, so
 * anything longer than ~1.5s is just an obstacle between the user
 * and the page they asked for.
 *
 * Fixed dark background rather than var(--bg): this renders before
 * (or alongside) the theme class landing on <html>, so reading the
 * token risks a flash of the wrong palette. Hardcoding the dark
 * value means the splash looks identical either way, and the
 * fade-out covers the handover to whatever theme the user has.
 * ═════════════════════════════════════════════════════════════════
 */
export default function SplashScreen() {
  return (
    <motion.div
      // Only an exit animation — it's already on screen when it mounts,
      // so fading in would just delay things further.
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        background:     '#0a0a14',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '24px',
        padding:        '24px',
      }}
    >
      {/* Ambient glow behind the mark */}
      <div style={{
        position:      'absolute',
        width:         '420px',
        height:        '420px',
        maxWidth:      '90vw',
        maxHeight:     '90vw',
        background:    'rgba(59, 130, 246, 0.18)',
        filter:        'blur(100px)',
        borderRadius:  '50%',
        pointerEvents: 'none',
      }} />

      {/* Logo plate — the asset has a white background, so it sits on
          a white card rather than as a bare rectangle on the dark. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position:       'relative',
          background:     '#ffffff',
          borderRadius:   '20px',
          padding:        '18px 26px',
          boxShadow:      '0 20px 60px -12px rgba(0,0,0,0.6)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        <img
          src="/logo-full.png"
          alt="AttendX"
          style={{
            display:   'block',
            height:    '84px',
            width:     'auto',
            maxWidth:  '100%',
            objectFit: 'contain',
          }}
        />
      </motion.div>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position:      'relative',
          color:         'rgba(255,255,255,0.5)',
          fontSize:      '13px',
          fontFamily:    "'Inter', system-ui, sans-serif",
          letterSpacing: '0.02em',
          textAlign:     'center',
          margin:        0,
        }}
      >
        Smart attendance. Simple experience.
      </motion.p>

      {/* Progress hairline — a quiet indicator that something is
          happening, rather than a spinner competing with the logo. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        style={{
          position:     'relative',
          width:        '140px',
          height:       '2px',
          borderRadius: '2px',
          background:   'rgba(255,255,255,0.08)',
          overflow:     'hidden',
        }}
      >
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
          style={{
            width:        '60%',
            height:       '100%',
            borderRadius: '2px',
            background:   'linear-gradient(90deg, transparent, #3b82f6, transparent)',
          }}
        />
      </motion.div>
    </motion.div>
  );
}