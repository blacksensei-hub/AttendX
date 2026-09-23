// client/src/components/SplashScreen.jsx
import { motion } from 'framer-motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * SplashScreen — the first-load moment, Roll Call edition.
 *
 * The mark assembles itself: the four scan brackets close in from
 * outside the frame, then the check draws. It is the whole product
 * in one second (frame the code, get the tick), and it is short on
 * purpose: on the web a splash is branding, not a loading gate.
 *
 * Fixed ink background rather than var(--bg) so it looks the same
 * whichever theme lands on <html> underneath it.
 * ═════════════════════════════════════════════════════════════════
 */
const EASE_OUT = [0.16, 1, 0.3, 1];

const CORNERS = [
  { d: 'M14 25v-5a6 6 0 0 1 6-6h5', x: -10, y: -10 },
  { d: 'M39 14h5a6 6 0 0 1 6 6v5',  x:  10, y: -10 },
  { d: 'M50 39v5a6 6 0 0 1-6 6h-5', x:  10, y:  10 },
  { d: 'M25 50h-5a6 6 0 0 1-6-6v-5', x: -10, y:  10 },
];

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
        background:     '#070D1F',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            22,
        padding:        24,
      }}
    >
      <div aria-hidden="true" style={{
        position:      'absolute',
        width:         520,
        height:        520,
        maxWidth:      '100vw',
        maxHeight:     '100vw',
        borderRadius:  '50%',
        background:    'radial-gradient(closest-side, rgba(61,92,255,0.22), transparent)',
        pointerEvents: 'none',
      }} />

      <svg width="96" height="96" viewBox="0 0 64 64" role="img" aria-label="AttendX" style={{ position: 'relative', overflow: 'visible' }}>
        <g fill="none" stroke="#6F8BFF" strokeWidth="4" strokeLinecap="round">
          {CORNERS.map((c, i) => (
            <motion.path
              key={i}
              d={c.d}
              initial={{ x: c.x, y: c.y, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.05 * i }}
            />
          ))}
        </g>
        <motion.path
          d="M22.5 32.5l6.5 6.5 13-13.5"
          fill="none"
          stroke="#14C9A6"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.45 }}
        />
      </svg>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: EASE_OUT }}
        style={{
          position:      'relative',
          margin:        0,
          fontFamily:    "'Bricolage Grotesque', system-ui, sans-serif",
          fontWeight:    750,
          fontSize:      34,
          letterSpacing: '-0.04em',
          color:         '#EEF1F7',
        }}
      >
        Attend<span style={{ color: '#8FA3FF' }}>X</span>
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        style={{
          position:      'relative',
          margin:        0,
          fontFamily:    "'IBM Plex Mono', ui-monospace, monospace",
          fontSize:      11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color:         'rgba(238,241,247,0.5)',
        }}
      >
        Every seat, counted
      </motion.p>
    </motion.div>
  );
}
