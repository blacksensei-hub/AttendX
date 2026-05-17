import { useState }                                  from 'react';
import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import { Plus, BookOpen, MapPin, Users }             from 'lucide-react';
import toast                                         from 'react-hot-toast';

import { classService }                              from '../../services/classService';
import PageShell, { PageHeader }                     from '../../components/layout/PageShell';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * MyClassesPage — student's enrolled classes view.
 *
 * Students join classes by entering an 8-character code their
 * lecturer shares. Each enrolled class appears as a card showing
 * its brand initial, location, description, and join code.
 *
 * Simpler than the lecturer Classes page — no schedule management,
 * no session opening, no admin actions. Just "here are your classes."
 * ═════════════════════════════════════════════════════════════════
 */
export default function MyClassesPage() {
  const qc = useQueryClient();
  const [code,     setCode]     = useState('');
  const [showJoin, setShowJoin] = useState(false);

  const { data: classData, isLoading } = useQuery({
    queryKey: ['enrolled-classes'],
    queryFn:  classService.getEnrolledClasses,
  });
  const classes = classData?.classes ?? [];

  const joinMut = useMutation({
    mutationFn: (code) => classService.joinClass(code),
    onSuccess:  () => {
      toast.success('Joined class successfully');
      qc.invalidateQueries({ queryKey: ['enrolled-classes'] });
      setCode('');
      setShowJoin(false);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to join class'),
  });

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="My Classes" subtitle="Loading…" />
        <div style={{
          display:             'grid',
          gap:                 'var(--space-3)',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="shimmer"
              style={{
                height:       '200px',
                borderRadius: 'var(--radius-molecular)',
              }}
            />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Header ──────────────────────────────────────────── */}
      <PageHeader
        title="My Classes"
        subtitle={
          classes.length === 0
            ? 'Enter a class code from your lecturer to get started'
            : `${classes.length} class${classes.length !== 1 ? 'es' : ''} enrolled`
        }
        action={
          <motion.button
            whileTap={TAP.button}
            whileHover={{ y: -1 }}
            transition={SPRING.snappy}
            onClick={() => setShowJoin(true)}
            className="btn-primary"
          >
            <Plus size={16} />
            Join class
          </motion.button>
        }
      />

      {/* ── Join form ───────────────────────────────────────── */}
      <AnimatePresence>
        {showJoin && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{    opacity: 0, y: -8, scale: 0.97 }}
            transition={SPRING.snappy}
            style={{
              background:   'var(--bg-card)',
              border:       '1px solid var(--brand-border)',
              borderRadius: 'var(--radius-molecular)',
              padding:      'var(--space-3)',
              boxShadow:    'var(--shadow-md)',
              position:     'relative',
              overflow:     'hidden',
            }}
          >
            {/* Ambient brand glow */}
            <div style={{
              position:      'absolute',
              top:           '-40px',
              right:         '-40px',
              width:         '160px',
              height:        '160px',
              background:    'var(--brand-subtle)',
              filter:        'blur(50px)',
              opacity:       0.6,
              pointerEvents: 'none',
            }} />

            <div style={{
              position:     'relative',
              display:      'flex',
              alignItems:   'center',
              gap:          '8px',
              marginBottom: '10px',
            }}>
              <div style={{
                width:          '32px',
                height:         '32px',
                borderRadius:   'var(--radius-atomic)',
                background:     'var(--brand-subtle)',
                border:         '1px solid var(--brand-border)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
              }}>
                <Plus size={16} style={{ color: 'var(--brand-text)' }} />
              </div>
              <p style={{
                color:      'var(--text-primary)',
                fontWeight: 600,
                fontSize:   'var(--text-sm)',
                fontFamily: 'var(--font-display)',
              }}>
                Enter class code
              </p>
            </div>

            <p style={{
              position:     'relative',
              color:        'var(--text-muted)',
              fontSize:     'var(--text-xs)',
              marginBottom: 'var(--space-2)',
              lineHeight:   1.5,
            }}>
              Your lecturer will have shared an 8-character code like <span style={{
                fontFamily: 'var(--font-mono)',
                color:      'var(--brand-text)',
                fontWeight: 600,
              }}>ABCD1234</span>. Codes are case-insensitive.
            </p>

            <div style={{
              position:   'relative',
              display:    'flex',
              gap:        '8px',
              flexWrap:   'wrap',
            }}>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD1234"
                className="input-base"
                maxLength={8}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && code && !joinMut.isPending) {
                    joinMut.mutate(code);
                  }
                }}
                style={{
                  flex:          1,
                  minWidth:      '200px',
                  fontFamily:    'var(--font-mono)',
                  fontSize:      'var(--text-md)',
                  letterSpacing: '0.1em',
                  fontWeight:    600,
                  textAlign:     'center',
                }}
              />
              <motion.button
                whileTap={TAP.button}
                whileHover={code && !joinMut.isPending ? { y: -1 } : undefined}
                transition={SPRING.snappy}
                onClick={() => joinMut.mutate(code)}
                disabled={!code || joinMut.isPending}
                className="btn-primary"
                style={{
                  opacity: (!code || joinMut.isPending) ? 0.6 : 1,
                }}
              >
                {joinMut.isPending ? 'Joining…' : 'Join'}
              </motion.button>
              <motion.button
                whileTap={TAP.button}
                onClick={() => {
                  setShowJoin(false);
                  setCode('');
                }}
                className="btn-ghost"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state / class grid ────────────────────────── */}
      <AnimatePresence mode="wait">
        {classes.length === 0 && !showJoin ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -8 }}
            transition={SPRING.snappy}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        'var(--space-6) var(--space-3)',
              background:     'var(--bg-card)',
              border:         '1px dashed var(--border-hover)',
              borderRadius:   'var(--radius-molecular)',
              textAlign:      'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: DURATION.slow, ease: EASE.bounce, delay: 0.1 }}
              style={{
                width:          '64px',
                height:         '64px',
                borderRadius:   'var(--radius-molecular)',
                background:     'var(--brand-subtle)',
                border:         '1px solid var(--brand-border)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                marginBottom:   'var(--space-3)',
              }}
            >
              <BookOpen size={28} style={{ color: 'var(--brand-text)' }} />
            </motion.div>

            <p style={{
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
            }}>
              No classes yet
            </p>
            <p style={{
              color:        'var(--text-muted)',
              fontSize:     'var(--text-sm)',
              marginTop:    '6px',
              marginBottom: 'var(--space-3)',
              maxWidth:     '320px',
            }}>
              Enter a class code from your lecturer to join — you'll see all their session notifications right here.
            </p>

            <motion.button
              whileTap={TAP.button}
              whileHover={{ y: -1 }}
              transition={SPRING.snappy}
              onClick={() => setShowJoin(true)}
              className="btn-primary"
            >
              <Plus size={15} />
              Join a class
            </motion.button>
          </motion.div>
        ) : classes.length > 0 ? (
          <AnimatedList
            key="grid"
            style={{
              display:             'grid',
              gap:                 'var(--space-3)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            <AnimatePresence initial={false}>
              {classes.map(cls => (
                <AnimatedItem key={cls.id} layout>
                  <ClassCard cls={cls} />
                </AnimatedItem>
              ))}
            </AnimatePresence>
          </AnimatedList>
        ) : null}
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Class card ────────────────────────────────────────────────
function ClassCard({ cls }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={SPRING.snappy}
      style={{
        background:    'var(--bg-card)',
        borderRadius:  'var(--radius-molecular)',
        padding:       'var(--space-3)',
        boxShadow:     'var(--shadow-md)',
        position:      'relative',
        overflow:      'hidden',
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
      }}
    >
      {/* Ambient brand glow */}
      <div style={{
        position:      'absolute',
        top:           '-50px',
        right:         '-50px',
        width:         '140px',
        height:        '140px',
        background:    'var(--brand-subtle)',
        filter:        'blur(50px)',
        opacity:       0.5,
        pointerEvents: 'none',
      }} />

      {/* Class initial tile */}
      <div style={{
        position:       'relative',
        width:          '44px',
        height:         '44px',
        background:     'var(--brand-subtle)',
        border:         '1px solid var(--brand-border)',
        borderRadius:   'var(--radius-atomic)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontFamily:     'var(--font-display)',
        fontWeight:     700,
        fontSize:       'var(--text-md)',
        color:          'var(--brand-text)',
        marginBottom:   'var(--space-2)',
      }}>
        {cls.name.slice(0, 2).toUpperCase()}
      </div>

      {/* Title */}
      <h3 style={{
        position:     'relative',
        fontFamily:   'var(--font-display)',
        fontWeight:   600,
        color:        'var(--text-primary)',
        fontSize:     'var(--text-md)',
        lineHeight:   1.3,
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
        marginBottom: '4px',
      }}>
        {cls.name}
      </h3>

      {/* Description */}
      <p style={{
        position:         'relative',
        color:            'var(--text-muted)',
        fontSize:         'var(--text-xs)',
        lineHeight:       1.5,
        marginBottom:     'var(--space-2)',
        display:          '-webkit-box',
        WebkitLineClamp:  2,
        WebkitBoxOrient:  'vertical',
        overflow:         'hidden',
        flex:             1,
      }}>
        {cls.description || 'No description'}
      </p>

      {/* Meta (location, enrolment count) */}
      <div style={{
        position:   'relative',
        display:    'flex',
        flexWrap:   'wrap',
        gap:        'var(--space-2)',
        marginBottom: 'var(--space-2)',
      }}>
        {cls.location_name && (
          <MetaItem icon={MapPin} label={cls.location_name} truncate />
        )}
        {cls.enrollmentCount != null && (
          <MetaItem
            icon={Users}
            label={`${cls.enrollmentCount} student${cls.enrollmentCount !== 1 ? 's' : ''}`}
          />
        )}
      </div>

      {/* Footer — join code */}
      <div style={{
        position:       'relative',
        marginTop:      'auto',
        paddingTop:     'var(--space-2)',
        borderTop:      '1px solid var(--border)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            'var(--space-2)',
      }}>
        <span style={{
          color:         'var(--text-muted)',
          fontSize:      '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight:    600,
        }}>
          Join code
        </span>
        <span style={{
          fontFamily:    'var(--font-mono)',
          color:         'var(--brand-text)',
          fontSize:      'var(--text-sm)',
          fontWeight:    700,
          letterSpacing: '0.06em',
        }}>
          {cls.code}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Meta item (icon + label) ──────────────────────────────────
function MetaItem({ icon: Icon, label, truncate }) {
  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        '4px',
      color:      'var(--text-muted)',
      fontSize:   'var(--text-xs)',
      minWidth:   0,
      flexShrink: truncate ? 1 : 0,
    }}>
      <Icon size={12} style={{ flexShrink: 0 }} />
      <span style={{
        overflow:     truncate ? 'hidden' : 'visible',
        textOverflow: truncate ? 'ellipsis' : 'clip',
        whiteSpace:   'nowrap',
      }}>
        {label}
      </span>
    </div>
  );
}