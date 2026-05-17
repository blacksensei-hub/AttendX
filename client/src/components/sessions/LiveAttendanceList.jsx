import { motion, AnimatePresence }   from 'framer-motion';
import { format }                    from 'date-fns';
import { Users }                     from 'lucide-react';

import StatusPill                    from '../ui/StatusPill';
import {
  EASE, DURATION, SPRING,
}                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * LiveAttendanceList — streaming list of students who have marked
 * attendance for the active session.
 *
 * Each new arrival slides in from the top and gets a brief branded
 * highlight that fades over 1.5s — giving the lecturer an
 * unmistakable "new arrival" signal without needing a toast.
 *
 * Uses StatusPill for consistent status styling across the app.
 * ═════════════════════════════════════════════════════════════════
 */
export default function LiveAttendanceList({ records = [] }) {
  return (
    <div style={{
      flex:      1,
      overflowY: 'auto',
      minHeight: 0,
    }}>

      {/* ── Empty state ─────────────────────────────────────── */}
      {records.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.medium, ease: EASE.state }}
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        'var(--space-5) var(--space-3)',
            textAlign:      'center',
          }}
        >
          <motion.div
            /*
              Breathing animation draws peripheral attention to the
              waiting state so a lecturer standing back from the
              screen still knows the session is receptive — the app
              isn't frozen, it's just waiting.
            */
            animate={{ scale: [1, 1.04, 1], opacity: [0.8, 1, 0.8] }}
            transition={{
              duration: 2.5,
              ease:     EASE.state,
              repeat:   Infinity,
            }}
            style={{
              width:          '48px',
              height:         '48px',
              borderRadius:   'var(--radius-molecular)',
              background:     'var(--brand-subtle)',
              border:         '1px solid var(--brand-border)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              marginBottom:   'var(--space-2)',
            }}
          >
            <Users size={20} style={{ color: 'var(--brand-text)' }} />
          </motion.div>

          <p style={{
            color:      'var(--text-secondary)',
            fontSize:   'var(--text-sm)',
            fontWeight: 500,
          }}>
            Waiting for students…
          </p>
          <p style={{
            color:     'var(--text-muted)',
            fontSize:  'var(--text-xs)',
            marginTop: '4px',
            maxWidth:  '260px',
            lineHeight: 1.5,
          }}>
            Attendance will appear here in real time as students scan the QR code.
          </p>
        </motion.div>
      )}

      {/* ── Attendance rows ─────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {records.map((record) => (
          <AttendanceRow key={record.studentId} record={record} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Single attendance row ─────────────────────────────────────
function AttendanceRow({ record }) {
  return (
    <motion.div
      layout
      /*
        Two-stage arrival:
          1. Slide + fade in from the top with a snappy spring
          2. Hold a branded highlight for 1.5s then fade to transparent

        The highlight acts as a "this just happened" signal. Lecturers
        glancing at the list see instantly where to look — no toast
        needed. Uses var(--brand-subtle) so the effect theme-shifts
        automatically when the app switches modes.
      */
      initial={{
        opacity:         0,
        y:               -8,
        backgroundColor: 'var(--brand-subtle)',
      }}
      animate={{
        opacity:         1,
        y:               0,
        backgroundColor: 'rgba(0,0,0,0)',
      }}
      exit={{
        opacity: 0,
        x:       -12,
        transition: { duration: DURATION.base, ease: EASE.exit },
      }}
      transition={{
        opacity: { duration: DURATION.medium, ease: EASE.entry },
        y:       { ...SPRING.snappy },
        backgroundColor: {
          duration: 1.5,
          ease:     EASE.state,
          delay:    0.1,
        },
      }}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--space-3)',
        padding:      'var(--space-2) var(--space-3)',
        borderBottom: '1px solid var(--border)',
        willChange:   'transform, opacity, background-color',
      }}
    >
      {/* Avatar */}
      <div style={{
        width:          '38px',
        height:         '38px',
        borderRadius:   'var(--radius-atomic)',
        background:     'var(--brand-subtle)',
        border:         '1px solid var(--brand-border)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontWeight:     700,
        fontSize:       'var(--text-sm)',
        color:          'var(--brand-text)',
        flexShrink:     0,
        fontFamily:     'var(--font-display)',
      }}>
        {record.studentName?.[0]?.toUpperCase() ?? '?'}
      </div>

      {/*
        Student details — rendered in order of practical importance
        for a lecturer cross-checking against a register:
          1. Student ID (primary institutional reference, monospace)
          2. Full name (human-readable label)
          3. Email    (unique account verifier)
      */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {record.studentId_display && (
          <p style={{
            color:         'var(--brand-text)',
            fontSize:      'var(--text-xs)',
            fontFamily:    'var(--font-mono)',
            fontWeight:    600,
            letterSpacing: '0.04em',
            marginBottom:  '2px',
          }}>
            {record.studentId_display}
          </p>
        )}

        <p style={{
          color:        'var(--text-primary)',
          fontWeight:   600,
          fontSize:     'var(--text-sm)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          lineHeight:   1.3,
        }}>
          {record.studentName ?? '—'}
        </p>

        <p style={{
          color:        'var(--text-muted)',
          fontSize:     'var(--text-xs)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          marginTop:    '1px',
        }}>
          {record.studentEmail ?? '—'}
        </p>
      </div>

      {/* Time + status */}
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-end',
        gap:            '4px',
        flexShrink:     0,
      }}>
        <p style={{
          color:      'var(--text-muted)',
          fontSize:   'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
        }}>
          {record.marked_at
            ? format(new Date(record.marked_at), 'HH:mm:ss')
            : '—'}
        </p>

        <StatusPill status={record.status ?? 'absent'} showSweep={false} />
      </div>
    </motion.div>
  );
}