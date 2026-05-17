import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { useNavigate }                               from 'react-router-dom';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  Radio, Clock, StopCircle, Eye, RefreshCw,
}                                                    from 'lucide-react';
import { formatDistanceToNow, format }               from 'date-fns';
import toast                                         from 'react-hot-toast';

import api                                           from '../../services/api';
import PageShell, { PageHeader }                     from '../../components/layout/PageShell';
import StatusPill                                    from '../../components/ui/StatusPill';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * LiveSessionsPage — overview of every open session the lecturer has.
 *
 * Polls every 10 seconds so the numbers stay fresh. Each session
 * card uses layoutId for the shared-element transition into the
 * LiveSessionPage when the lecturer clicks "View QR".
 * ═════════════════════════════════════════════════════════════════
 */
export default function LiveSessionsPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  // ── Fetch active sessions ────────────────────────────────────
  // Fetching directly (rather than deriving from the classes query)
  // guarantees we always see the canonical state from the DB.
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey:        ['lecturer-active-sessions'],
    queryFn:         () => api.get('/sessions/lecturer-active').then(r => r.data),
    refetchInterval: 10_000,
    staleTime:       0,
    refetchOnMount:  true,
  });
  const sessions = data?.sessions ?? [];

  // ── Close session ────────────────────────────────────────────
  const closeMut = useMutation({
    mutationFn: (sessionId) => api.put(`/sessions/${sessionId}/close`),
    onSuccess:  () => {
      toast.success('Session closed');
      refetch();
      qc.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to close'),
  });

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Live Sessions" subtitle="Loading…" />
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           'var(--space-2)',
        }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="shimmer"
              style={{
                height:       '220px',
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
        title="Live Sessions"
        subtitle={
          sessions.length === 0
            ? 'No sessions running right now'
            : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} currently open · refreshes every 10 seconds`
        }
        action={
          <motion.button
            whileTap={TAP.button}
            whileHover={{ y: -1 }}
            transition={SPRING.snappy}
            onClick={() => refetch()}
            className="btn-ghost"
          >
            <motion.span
              animate={isFetching ? { rotate: 360 } : { rotate: 0 }}
              transition={isFetching
                ? { duration: 0.8, ease: 'linear', repeat: Infinity }
                : { duration: DURATION.base, ease: EASE.state }
              }
              style={{ display: 'flex' }}
            >
              <RefreshCw size={13} />
            </motion.span>
            Refresh now
          </motion.button>
        }
      />

      {/* ── Empty state / sessions list ─────────────────────── */}
      <AnimatePresence mode="wait">
        {sessions.length === 0 ? (
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
              transition={{
                duration: DURATION.slow,
                ease:     EASE.bounce,
                delay:    0.1,
              }}
              style={{
                width:          '64px',
                height:         '64px',
                borderRadius:   'var(--radius-molecular)',
                background:     'var(--bg-raised)',
                border:         '1px solid var(--border)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                marginBottom:   'var(--space-3)',
              }}
            >
              <Radio size={26} style={{ color: 'var(--text-muted)' }} />
            </motion.div>

            <p style={{
              color:        'var(--text-primary)',
              fontFamily:   'var(--font-display)',
              fontWeight:   600,
              fontSize:     'var(--text-md)',
              marginBottom: '6px',
            }}>
              No active sessions
            </p>
            <p style={{
              color:        'var(--text-muted)',
              fontSize:     'var(--text-sm)',
              marginBottom: 'var(--space-3)',
              maxWidth:     '320px',
            }}>
              Open a session from the Classes page to see it appear here in real time.
            </p>

            <motion.button
              whileTap={TAP.button}
              whileHover={{ y: -1 }}
              transition={SPRING.snappy}
              onClick={() => navigate('/lecturer/classes')}
              className="btn-primary"
            >
              Go to Classes
            </motion.button>
          </motion.div>
        ) : (
          <AnimatedList
            key="list"
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           'var(--space-3)',
            }}
          >
            <AnimatePresence initial={false}>
              {sessions.map(session => (
                <AnimatedItem
                  key={session.id}
                  layout
                  whileHover={{ y: -2 }}
                  transition={SPRING.snappy}
                >
                  <SessionCard
                    session={session}
                    onView={() => navigate(`/lecturer/session/${session.id}`)}
                    onClose={() => {
                      if (confirm('Close this session? Students will no longer be able to mark attendance.')) {
                        closeMut.mutate(session.id);
                      }
                    }}
                    closing={closeMut.isPending}
                  />
                </AnimatedItem>
              ))}
            </AnimatePresence>
          </AnimatedList>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Session card ──────────────────────────────────────────────
function SessionCard({ session, onView, onClose, closing }) {
  const absent = Math.max(0, (session.enrollmentCount ?? 0) - (session.total ?? 0));
  const rate   = session.enrollmentCount > 0
    ? Math.round(((session.total ?? 0) / session.enrollmentCount) * 100)
    : 0;

  const classId = session.classId ?? session.class_id ?? session.class?.id;

  return (
    <motion.div
      /*
        layoutId morphs INTO the LiveSessionPage header when "View QR"
        is clicked. Matches the ClassCard layoutId pattern — the
        transition works from either entry point.
      */
      layoutId={classId ? `class-morph-${classId}` : undefined}
      transition={SPRING.gentle}
      style={{
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-molecular)',
        overflow:     'hidden',
        boxShadow:    'var(--shadow-md)',
        position:     'relative',
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            'var(--space-2)',
        padding:        'var(--space-3)',
        borderBottom:   '1px solid var(--border)',
        position:       'relative',
      }}>
        {/* Subtle brand glow — signals "this is live right now" */}
        <div style={{
          position:      'absolute',
          top:           '-40px',
          right:         '-40px',
          width:         '140px',
          height:        '140px',
          background:    'var(--green-bg)',
          filter:        'blur(40px)',
          opacity:       0.6,
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
          <StatusPill status="live" label="Live" showSweep={false} />

          <div style={{ minWidth: 0 }}>
            <p style={{
              color:        'var(--text-primary)',
              fontWeight:   600,
              fontSize:     'var(--text-md)',
              fontFamily:   'var(--font-display)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {session.title || session.className}
            </p>
            {session.title && (
              <p style={{
                color:     'var(--text-muted)',
                fontSize:  'var(--text-xs)',
                marginTop: '2px',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                {session.className}
              </p>
            )}
          </div>
        </div>

        <div style={{
          position:   'relative',
          display:    'flex',
          gap:        '6px',
          flexShrink: 0,
        }}>
          <motion.button
            whileTap={TAP.button}
            whileHover={{ y: -1 }}
            transition={SPRING.snappy}
            onClick={onView}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '6px',
              padding:      '8px 14px',
              background:   'var(--brand-subtle)',
              border:       '1px solid var(--brand-border)',
              color:        'var(--brand-text)',
              borderRadius: 'var(--radius-atomic)',
              fontSize:     'var(--text-xs)',
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   'var(--font-body)',
            }}
          >
            <Eye size={13} />
            View QR
          </motion.button>

          <motion.button
            whileTap={TAP.button}
            whileHover={{ y: -1 }}
            transition={SPRING.snappy}
            onClick={onClose}
            disabled={closing}
            className="btn-danger"
            style={{
              padding:  '8px 14px',
              fontSize: 'var(--text-xs)',
              opacity:  closing ? 0.6 : 1,
            }}
          >
            <StopCircle size={13} />
            {closing ? 'Closing…' : 'Close'}
          </motion.button>
        </div>
      </div>

      {/* ── Stats grid ──────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
      }}>
        <Stat
          label="Present"
          value={session.present ?? 0}
          color="var(--green)"
          bg="var(--green-bg)"
        />
        <Stat
          label="Late"
          value={session.late ?? 0}
          color="var(--amber)"
          bg="var(--amber-bg)"
        />
        <Stat
          label="Absent"
          value={absent}
          color="var(--red)"
          bg="var(--red-bg)"
        />
        <Stat
          label="Marked"
          value={`${session.total ?? 0}/${session.enrollmentCount ?? 0}`}
          color="var(--brand-text)"
          bg="var(--bg-raised)"
          isLast={false}
        />
        <Stat
          label="Rate"
          value={`${rate}%`}
          color="var(--violet)"
          bg="var(--violet-bg)"
          isLast
        />
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div style={{
        padding:      '10px var(--space-3)',
        borderTop:    '1px solid var(--border)',
        background:   'var(--bg-raised)',
        display:      'flex',
        alignItems:   'center',
        gap:          '6px',
        flexWrap:     'wrap',
      }}>
        <Clock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
          Opened {session.openAt
            ? formatDistanceToNow(new Date(session.openAt), { addSuffix: true })
            : '—'}
        </p>
        {session.closeAt && (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>·</span>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              Auto-closes at{' '}
              <span style={{
                color:      'var(--amber)',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
              }}>
                {format(new Date(session.closeAt), 'HH:mm')}
              </span>
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Stat cell (animates when value changes) ────────────────────
function Stat({ label, value, color, bg, isLast }) {
  return (
    <div style={{
      padding:     'var(--space-3)',
      background:  bg,
      textAlign:   'center',
      borderRight: isLast ? 'none' : '1px solid var(--border)',
      transition:  `background ${DURATION.base}ms ${EASE.state}`,
    }}>
      <AnimatePresence mode="wait">
        <motion.p
          key={String(value)}
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{    opacity: 0, y: -6, scale: 0.9 }}
          transition={SPRING.snappy}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize:   'var(--text-lg)',
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          {value}
        </motion.p>
      </AnimatePresence>
      <p style={{
        color:         'var(--text-muted)',
        fontSize:      '10px',
        marginTop:     '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight:    600,
      }}>
        {label}
      </p>
    </div>
  );
}