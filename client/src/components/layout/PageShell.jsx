import { motion }         from 'framer-motion';
import { pageTransition } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * PageShell — the outermost wrapper for every routed page.
 *
 * Owns the route entrance animation. One animation per page mount,
 * no parent AnimatePresence, no exit animation. This is the modern
 * pattern: AnimatePresence for stuff INSIDE pages (modals, lists),
 * not for the route boundary itself.
 *
 * Why no exit animation:
 *   AnimatePresence-orchestrated route transitions race badly with
 *   React.lazy() and Suspense. The exit-then-mount-new cycle gets
 *   stuck mid-flight when the new chunk hasn't loaded yet, leaving
 *   pages blank until refresh. Removing the exit phase entirely
 *   makes navigation deterministic: old page unmounts, new page
 *   mounts, new page animates up. No state machine to get wedged.
 *
 * Props:
 *   gap     — gap between direct children (default 'var(--space-4)')
 *   style   — merged with defaults
 * ═════════════════════════════════════════════════════════════════
 */
export default function PageShell({
  children,
  className,
  style,
  gap = 'var(--space-4)',
  ...rest
}) {
  return (
    <motion.main
      className={className}
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      style={{
        display:        'flex',
        flexDirection:  'column',
        gap,
        width:          '100%',
        ...style,
      }}
      {...rest}
    >
      {children}
    </motion.main>
  );
}

export function PageHeader({ title, subtitle, action, children }) {
  return (
    <header style={{
      display:        'flex',
      alignItems:     'flex-start',
      justifyContent: 'space-between',
      flexWrap:       'wrap',
      gap:            'var(--space-3)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          fontFamily:    'var(--font-display)',
          fontSize:      'var(--text-xl)',
          fontWeight:    700,
          color:         'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            color:     'var(--text-muted)',
            fontSize:  'var(--text-sm)',
            marginTop: '0.25rem',
          }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </header>
  );
}