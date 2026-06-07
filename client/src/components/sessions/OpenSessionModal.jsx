import { useEffect, useRef }                 from 'react';
import { useForm }                           from 'react-hook-form';
import { zodResolver }                       from '@hookform/resolvers/zod';
import { z }                                 from 'zod';
import { motion, AnimatePresence }           from 'framer-motion';
import { X, Radio, Clock, Timer, AlarmClock } from 'lucide-react';
import { useMutation }                       from '@tanstack/react-query';
import toast                                 from 'react-hot-toast';

import { sessionService }                    from '../../services/sessionService';
import {
  EASE, DURATION, SPRING, TAP,
  overlayBackdrop, overlayContent,
}                                            from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * OpenSessionModal — lecturer's pre-flight for opening a session.
 *
 * On the critical demo-day path: ClassCard → this modal →
 * LiveSessionPage. Validation via zod keeps the inputs within the
 * ranges the backend accepts (late threshold 1-60, QR interval 3-60,
 * auto-close 5-180).
 *
 * Minimal cognitive load — only 4 inputs, 3 of them optional.
 * Sensible defaults (late after 15min, QR rotates every 5s).
 * ═════════════════════════════════════════════════════════════════
 */

// Empty number inputs arrive from the form as '' (not undefined).
// z.coerce.number() would turn '' into 0 (Number('') === 0), which then
// fails the .min() checks — and .optional() only permits undefined, not 0.
// Converting blanks to undefined first lets .default()/.optional() work,
// so "Auto-close after" can genuinely be left blank for manual close.
const blankToUndefined = (v) =>
  v === '' || v === null || v === undefined ? undefined : v;

const schema = z.object({
  title:          z.string().optional(),
  late_threshold: z.preprocess(blankToUndefined, z.coerce.number().min(1).max(60).default(15)),
  qr_interval:    z.preprocess(blankToUndefined, z.coerce.number().min(3).max(60).default(5)),
  close_after:    z.preprocess(blankToUndefined, z.coerce.number().min(5).max(180).optional()),
});

export default function OpenSessionModal({ classData, open, onClose, onOpened }) {
  const overlayRef = useRef(null);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      late_threshold: 15,
      qr_interval:    5,
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => sessionService.openSession(classData.id, data),
    onSuccess:  (data) => {
      toast.success('Session opened · students can mark attendance now');
      onOpened(data.session);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to open session'),
  });

  // ── Escape key closes ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          variants={overlayBackdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={e => e.target === overlayRef.current && onClose()}
          style={{
            position:        'fixed',
            inset:           0,
            zIndex:          50,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            padding:         'var(--space-3)',
            backgroundColor: 'var(--bg-overlay)',
            backdropFilter:  'blur(6px) saturate(140%)',
          }}
        >
          <motion.div
            variants={overlayContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              width:        '100%',
              maxWidth:     '520px',
              background:   'var(--bg-card)',
              borderRadius: 'var(--radius-organism)',
              overflow:     'hidden',
              boxShadow:    'var(--shadow-lg)',
            }}
          >

            {/* ── Header ──────────────────────────────────────── */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        'var(--space-3) var(--space-4)',
              borderBottom:   '1px solid var(--border)',
              background:     'var(--bg-raised)',
              position:       'relative',
              overflow:       'hidden',
            }}>
              {/* Ambient brand glow */}
              <div style={{
                position:      'absolute',
                top:           '-40px',
                right:         '-40px',
                width:         '160px',
                height:        '160px',
                background:    'var(--brand-subtle)',
                filter:        'blur(50px)',
                opacity:       0.7,
                pointerEvents: 'none',
              }} />

              <div style={{
                position:   'relative',
                display:    'flex',
                alignItems: 'center',
                gap:        'var(--space-2)',
                minWidth:   0,
                flex:       1,
              }}>
                <div style={{
                  width:          '40px',
                  height:         '40px',
                  borderRadius:   'var(--radius-atomic)',
                  background:     'var(--brand-subtle)',
                  border:         '1px solid var(--brand-border)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                  boxShadow:      'var(--shadow-brand)',
                }}>
                  <Radio size={18} style={{ color: 'var(--brand-text)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    color:      'var(--text-primary)',
                    fontSize:   'var(--text-md)',
                  }}>
                    Open attendance session
                  </h2>
                  <p style={{
                    color:        'var(--text-muted)',
                    fontSize:     'var(--text-xs)',
                    marginTop:    '2px',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {classData?.name}
                  </p>
                </div>
              </div>

              <motion.button
                whileTap={TAP.button}
                onClick={onClose}
                aria-label="Close"
                style={{
                  position:     'relative',
                  background:   'none',
                  border:       'none',
                  cursor:       'pointer',
                  color:        'var(--text-muted)',
                  padding:      '6px',
                  display:      'flex',
                  alignItems:   'center',
                  borderRadius: 'var(--radius-atomic)',
                  transition:   `color ${DURATION.base}ms ${EASE.state},
                                 background ${DURATION.base}ms ${EASE.state}`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color      = 'var(--text-primary)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color      = 'var(--text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* ── Form ────────────────────────────────────────── */}
            <form
              onSubmit={handleSubmit(mutation.mutate)}
              style={{
                padding:       'var(--space-4)',
                display:       'flex',
                flexDirection: 'column',
                gap:           'var(--space-3)',
              }}
            >
              {/* Session title */}
              <Field
                label="Session title"
                optional
                hint="e.g. 'Week 3 Lecture' — shown on the dashboard"
                error={errors.title?.message}
              >
                <input
                  {...register('title')}
                  className="input-base"
                  placeholder="Optional — leave blank for generic title"
                  autoFocus
                />
              </Field>

              {/* Late + QR row */}
              <div style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:                 'var(--space-2)',
              }}>
                <Field
                  label="Late after"
                  icon={Clock}
                  suffix="min"
                  error={errors.late_threshold?.message}
                >
                  <input
                    {...register('late_threshold')}
                    type="number"
                    min="1"
                    max="60"
                    className="input-base"
                  />
                </Field>
                <Field
                  label="QR rotates every"
                  icon={Timer}
                  suffix="sec"
                  error={errors.qr_interval?.message}
                >
                  <input
                    {...register('qr_interval')}
                    type="number"
                    min="3"
                    max="60"
                    className="input-base"
                  />
                </Field>
              </div>

              {/* Auto-close */}
              <Field
                label="Auto-close after"
                optional
                icon={AlarmClock}
                suffix="min"
                hint="Leave blank to close manually"
                error={errors.close_after?.message}
              >
                <input
                  {...register('close_after')}
                  type="number"
                  min="5"
                  max="180"
                  className="input-base"
                  placeholder="Blank = close manually"
                />
              </Field>

              {/* ── Actions ───────────────────────────────────── */}
              <div style={{
                display:   'flex',
                gap:       '8px',
                marginTop: '8px',
              }}>
                <motion.button
                  whileTap={TAP.button}
                  type="button"
                  onClick={onClose}
                  className="btn-ghost"
                  style={{ flex: 1 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={TAP.button}
                  whileHover={!mutation.isPending ? { y: -1 } : undefined}
                  transition={SPRING.snappy}
                  type="submit"
                  disabled={mutation.isPending}
                  className="btn-primary"
                  style={{
                    flex:    2,
                    opacity: mutation.isPending ? 0.7 : 1,
                  }}
                >
                  <Radio size={15} />
                  {mutation.isPending ? 'Opening…' : 'Open session'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Form field with icon + suffix + inline error ──────────────
function Field({ label, icon: Icon, suffix, optional, hint, error, children }) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           '6px',
    }}>
      {/* Label row */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '6px',
      }}>
        {Icon && <Icon size={12} style={{ color: 'var(--text-muted)' }} />}
        <label style={{
          color:      'var(--text-secondary)',
          fontSize:   'var(--text-xs)',
          fontWeight: 600,
        }}>
          {label}
        </label>
        {optional && (
          <span style={{
            color:         'var(--text-muted)',
            fontSize:      '10px',
            fontWeight:    500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Optional
          </span>
        )}
        {suffix && (
          <span style={{
            marginLeft: 'auto',
            color:      'var(--text-muted)',
            fontSize:   '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}>
            {suffix}
          </span>
        )}
      </div>

      {/* Input */}
      {children}

      {/* Hint or error */}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -4 }}
            transition={{ duration: DURATION.fast, ease: EASE.state }}
            style={{
              color:    'var(--red)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: DURATION.fast }}
            style={{
              color:    'var(--text-muted)',
              fontSize: '10px',
            }}
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}