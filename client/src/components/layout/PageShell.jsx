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

/**
 * PageHeader — the Roll Call page opener.
 *
 *   kicker   mono slash label above the title ("Lecturer / Classes").
 *            Defaults to today's date so every page carries one.
 *   title    big tight display headline
 *   accent   optional trailing word(s) set in cobalt ("Jeffrey.")
 */
export function PageHeader({ title, accent, kicker, subtitle, action, children }) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return (
    <header style={{
      display:        'flex',
      alignItems:     'flex-end',
      justifyContent: 'space-between',
      flexWrap:       'wrap',
      gap:            'var(--space-4)',
      paddingBottom:  'var(--space-2)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="kicker"><span className="dot" />{kicker ?? today}</p>
        <h1 style={{
          marginTop:     14,
          fontFamily:    'var(--font-display)',
          fontSize:      'clamp(34px, 4.4vw, 60px)',
          fontWeight:    650,
          lineHeight:    0.98,
          color:         'var(--text-primary)',
          letterSpacing: '-0.038em',
          textWrap:      'balance',
        }}>
          {title}
          {accent && <> <span className="accent-word">{accent}</span></>}
        </h1>
        {subtitle && (
          <p style={{
            color:     'var(--text-subtle)',
            fontSize:  'var(--text-md)',
            lineHeight: 1.5,
            marginTop: 12,
            maxWidth:  '60ch',
          }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {action && <div style={{ flexShrink: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{action}</div>}
    </header>
  );
}