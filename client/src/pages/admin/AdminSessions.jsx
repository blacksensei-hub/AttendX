import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  StopCircle, Clock, RefreshCw, Radio, Shield,
}                                                    from 'lucide-react';
import { formatDistanceToNow }                       from 'date-fns';
import toast                                         from 'react-hot-toast';

import { adminService }                              from '../../services/adminService';
import PageShell, { PageHeader }                     from '../../components/layout/PageShell';
import StatusPill                                    from '../../components/ui/StatusPill';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AdminSessions — platform-wide live sessions.
 *
 * Admins see every open session across the platform. They can
 * force-close any session — useful for emergencies (accidental
 * opens, forgotten sessions running overnight, technical issues).
 *
 * Auto-polls every 15 seconds so the view stays current even while
 * admins are watching it. Live-dot on each session plus a pulsing
 * attendance-count indicator make real-time changes visible.
 * ═════════════════════════════════════════════════════════════════
 */
export default function AdminSessions() {
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey:        ['admin-active-sessions'],
    queryFn:         adminService.getActiveSessions,
    refetchInterval: 15_000,
  });

  const sessions = data?.sessions ?? [];

  const closeMut = useMutation({
    mutationFn: adminService.forceCloseSession,
    onSuccess:  () => {
      toast.success('Session force-closed');
      qc.invalidateQueries({ queryKey: ['admin-active-sessions'] });
    },
    onError: (e) =>
      toast.error(e.response?.data?.message || 'Failed to close session'),
  });

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Header ──────────────────────────────────────────── */}
      <PageHeader
        title="Live sessions"
        subtitle={
          sessions.length === 0
            ? 'No sessions running right now · auto-refreshes every 15 seconds'
            : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} currently open · auto-refreshes every 15 seconds`
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
            Refresh
          </motion.button>
        }
      />

      {/* ── Admin-only force-close notice ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.gentle}
        style={{
          display:       'flex',
          alignItems:    'flex-start',
          gap:           '10px',
          padding:       '10px 14px',
          background:    'var(--violet-bg)',
          border:        '1px solid var(--violet-border)',
          borderRadius:  'var(--radius-atomic)',
        }}
      >
        <Shield
          size={14}
          style={{
            color:      'var(--violet)',
            flexShrink: 0,
            marginTop:  '2px',
          }}
          strokeWidth={2.5}
        />
        <p style={{
          color:      'var(--text-secondary)',
          fontSize:   'var(--text-xs)',
          lineHeight: 1.6,
        }}>
          Force-closing a session ends it immediately for all students and notifies the owning lecturer. Use only for emergencies — lecturers can close their own sessions normally.
        </p>
      </motion.div>

      {/* ── Loading / empty / list ──────────────────────────── */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           '8px',
            }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="shimmer"
                style={{
                  height:       '96px',
                  borderRadius: 'var(--radius-molecular)',
                }}
              />
            ))}
          </motion.div>
        ) : sessions.length === 0 ? (
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
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
            }}>
              No active sessions
            </p>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-sm)',
              marginTop: '6px',
              maxWidth:  '320px',
            }}>
              Sessions will appear here when lecturers open them. The page auto-refreshes every 15 seconds.
            </p>
          </motion.div>
        ) : (
          <AnimatedList
            key="list"
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           'var(--space-2)',
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
                  <SessionRow
                    session={session}
                    onForceClose={() => {
                      if (confirm(`Force-close "${session.title || 'Attendance session'}" in ${session.class?.name}?\n\nThis immediately stops the session for all students and notifies ${session.class?.lecturer?.name}.`)) {
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

// ─── Session row ───────────────────────────────────────────────
function SessionRow({ session, onForceClose, closing }) {
  return (
    <motion.div
      style={{
        background:    'var(--bg-card)',
        borderRadius:  'var(--radius-molecular)',
        padding:       'var(--space-3)',
        display:       'flex',
        alignItems:    'center',
        gap:           'var(--space-3)',
        flexWrap:      'wrap',
        boxShadow:     'var(--shadow-md)',
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Subtle green glow — signals "live right now" */}
      <div style={{
        position:      'absolute',
        top:           '-40px',
        left:          '-40px',
        width:         '140px',
        height:        '140px',
        background:    'var(--green-bg)',
        filter:        'blur(40px)',
        opacity:       0.55,
        pointerEvents: 'none',
      }} />

      {/* Live pill */}
      <div style={{
        position:   'relative',
        flexShrink: 0,
      }}>
        <StatusPill status="live" label="Live" showSweep={false} />
      </div>

      {/* Session info */}
      <div style={{
        position: 'relative',
        flex:     1,
        minWidth: '200px',
      }}>
        <p style={{
          color:      'var(--text-primary)',
          fontWeight: 600,
          fontSize:   'var(--text-sm)',
          fontFamily: 'var(--font-display)',
        }}>
          {session.title || 'Attendance session'}
        </p>
        <p style={{
          color:     'var(--text-muted)',
          fontSize:  'var(--text-xs)',
          marginTop: '2px',
        }}>
          {session.class?.name}
          {' · '}
          <span style={{
            color:      'var(--brand-text)',
            fontWeight: 500,
          }}>
            {session.class?.lecturer?.name}
          </span>
        </p>
      </div>

      {/* Stats — attendance count animates on change */}
      <div style={{
        position:   'relative',
        display:    'flex',
        gap:        'var(--space-3)',
        alignItems: 'center',
      }}>
        <MetricCell
          value={session.attendanceCount}
          label="Marked"
          color="var(--green)"
          animate
        />
        <div style={{
          width:      '1px',
          height:     '32px',
          background: 'var(--border)',
        }} />
        <MetricCell
          value={session.open_at
            ? formatDistanceToNow(new Date(session.open_at), { addSuffix: true })
            : '—'
          }
          label="Opened"
          isText
        />
      </div>

      {/* Force-close button */}
      <motion.button
        whileTap={TAP.button}
        whileHover={!closing ? { y: -1 } : undefined}
        transition={SPRING.snappy}
        onClick={onForceClose}
        disabled={closing}
        className="btn-danger"
        style={{
          position: 'relative',
          fontSize: 'var(--text-xs)',
          padding:  '8px 14px',
          opacity:  closing ? 0.7 : 1,
        }}
      >
        <StopCircle size={13} />
        {closing ? 'Closing…' : 'Force close'}
      </motion.button>
    </motion.div>
  );
}

// ─── Metric cell (count + label, optionally animated) ─────────
function MetricCell({ value, label, color, animate, isText }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '60px' }}>
      {animate ? (
        <AnimatePresence mode="wait">
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{    opacity: 0, y: -6, scale: 0.9 }}
            transition={SPRING.bounce}
            style={{
              color,
              fontWeight: 700,
              fontSize:   'var(--text-lg)',
              fontFamily: 'var(--font-display)',
              lineHeight: 1.1,
            }}
          >
            {value}
          </motion.p>
        </AnimatePresence>
      ) : (
        <p style={{
          color:      'var(--text-secondary)',
          fontSize:   isText ? 'var(--text-xs)' : 'var(--text-lg)',
          fontWeight: isText ? 500 : 700,
          fontFamily: isText ? 'var(--font-body)' : 'var(--font-display)',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
        }}>
          {value}
        </p>
      )}
      <p style={{
        color:         'var(--text-muted)',
        fontSize:      '10px',
        marginTop:     '2px',
        fontWeight:    600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {label}
      </p>
    </div>
  );
}