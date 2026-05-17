import { useEffect }                       from 'react';
import { Sun, Moon }                       from 'lucide-react';
import { motion, AnimatePresence }         from 'framer-motion';

import { useUIStore }                      from '../../store/uiStore';
import { EASE, DURATION, SPRING, TAP }     from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * ThemeToggle — light/dark switcher.
 *
 * The icon rotates as it crossfades, creating a delightful "flip"
 * sensation instead of an abrupt swap. The button itself spring-
 * compresses on tap and warms on hover.
 *
 * initTheme() runs on mount to restore the persisted preference
 * from localStorage before the button becomes interactive.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme, initTheme } = useUIStore();
  const isDark = theme === 'dark';

  useEffect(() => { initTheme(); }, []);   // eslint-disable-line

  return (
    <motion.button
      onClick={toggleTheme}
      whileTap={TAP.button}
      whileHover={{ scale: 1.05 }}
      transition={SPRING.snappy}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
      style={{
        position:        'relative',
        width:           '36px',
        height:          '36px',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        borderRadius:    'var(--radius-atomic)',
        border:          '1px solid var(--border)',
        background:      'var(--bg-raised)',
        color:           'var(--text-secondary)',
        cursor:          'pointer',
        overflow:        'hidden',
        transition:      `background ${DURATION.base}ms ${EASE.state},
                          border-color ${DURATION.base}ms ${EASE.state},
                          color ${DURATION.base}ms ${EASE.state}`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--brand-border)';
        e.currentTarget.style.background  = 'var(--brand-subtle)';
        e.currentTarget.style.color       = 'var(--brand-text)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background  = 'var(--bg-raised)';
        e.currentTarget.style.color       = 'var(--text-secondary)';
      }}
    >
      {/*
        Icon crossfade with a signature rotate. The sun enters from
        -90deg (as if rising) and the moon enters from +90deg (as if
        setting into view). The motion maps to the concept.
      */}
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate:   0, scale: 1   }}
            exit={{    opacity: 0, rotate:  90, scale: 0.5 }}
            transition={{ duration: DURATION.base, ease: EASE.state }}
            style={{ display: 'flex', color: 'inherit' }}
          >
            <Sun size={16} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ opacity: 0, rotate:  90, scale: 0.5 }}
            animate={{ opacity: 1, rotate:   0, scale: 1   }}
            exit={{    opacity: 0, rotate: -90, scale: 0.5 }}
            transition={{ duration: DURATION.base, ease: EASE.state }}
            style={{ display: 'flex', color: 'inherit' }}
          >
            <Moon size={16} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}