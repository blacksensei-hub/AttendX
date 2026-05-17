import { motion, AnimatePresence } from 'framer-motion';
import { EASE, DURATION }          from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * StatusPill — the canonical status badge for the entire app.
 *
 * When the status changes, the colour animates and a sweep line
 * confirms commit. Replaces every hand-rolled colored span across
 * appeals, attendance, reports, schedules, etc.
 *
 * Props:
 *   status       — 'present' | 'late' | 'absent' | 'pending' |
 *                  'approved' | 'rejected' | 'scheduled' |
 *                  'live' | 'closed' | 'open'
 *   size         — 'sm' (default) | 'md'
 *   label        — optional override for displayed text
 *   showSweep    — whether to sweep a line on status change (default true)
 *   icon         — optional icon component rendered before the label
 * ═════════════════════════════════════════════════════════════════
 */

const STYLES = {
  present:   { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-border)'   },
  late:      { color: 'var(--amber)',  bg: 'var(--amber-bg)',  border: 'var(--amber-border)'   },
  absent:    { color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-border)'     },
  pending:   { color: 'var(--amber)',  bg: 'var(--amber-bg)',  border: 'var(--amber-border)'   },
  approved:  { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-border)'   },
  rejected:  { color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-border)'     },
  scheduled: { color: 'var(--brand)',  bg: 'var(--brand-subtle)', border: 'var(--brand-border)'},
  live:      { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-border)'   },
  open:      { color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-border)'   },
  closed:    { color: 'var(--text-muted)', bg: 'var(--bg-raised)', border: 'var(--border)'     },
};

const SIZES = {
  sm: { padding: '3px 10px', fontSize: 'var(--text-xs)' },
  md: { padding: '5px 14px', fontSize: 'var(--text-sm)' },
};

export default function StatusPill({
  status,
  size       = 'sm',
  label,
  showSweep  = true,
  icon: Icon,
}) {
  const s           = STYLES[status] ?? STYLES.absent;
  const sz          = SIZES[size]    ?? SIZES.sm;
  const displayText = label ?? status;

  return (
    <motion.span
      layout
      animate={{
        backgroundColor: s.bg,
        color:           s.color,
        borderColor:     s.border,
      }}
      transition={{ duration: DURATION.base, ease: EASE.state }}
      style={{
        position:      'relative',
        display:       'inline-flex',
        alignItems:    'center',
        gap:           '0.375rem',
        padding:       sz.padding,
        fontSize:      sz.fontSize,
        fontWeight:    600,
        borderRadius:  'var(--radius-pill)',
        border:        '1px solid',
        textTransform: 'capitalize',
        letterSpacing: '0.01em',
        overflow:      'hidden',
        willChange:    'background-color, color',
        lineHeight:    1,
      }}
    >
      {Icon && <Icon size={12} style={{ flexShrink: 0 }} />}

      {/*
        AnimatePresence with mode="wait" crossfades the text when status
        changes. The tiny y-axis shift reinforces that SOMETHING changed —
        users never miss a status update now.
      */}
      <AnimatePresence mode="wait">
        <motion.span
          key={displayText}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -4 }}
          transition={{ duration: DURATION.fast, ease: EASE.state }}
        >
          {displayText}
        </motion.span>
      </AnimatePresence>

      {/*
        Sweep — 2px line traces left → right → off-right to confirm
        "committed". Only runs on first render and status change.
        Replaces the need for toast confirmations on inline edits.
      */}
      {showSweep && (
        <motion.span
          key={`sweep-${displayText}`}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: [0, 1, 1, 0], originX: [0, 0, 1, 1] }}
          transition={{
            duration: 1.1,
            times:    [0, 0.4, 0.6, 1],
            ease:     EASE.entry,
          }}
          style={{
            position:      'absolute',
            left:          0,
            right:         0,
            bottom:        0,
            height:        '2px',
            background:    s.color,
            borderRadius:  'var(--radius-pill)',
            pointerEvents: 'none',
          }}
        />
      )}
    </motion.span>
  );
}