import { useState, useEffect, useRef }               from 'react';
import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  Bell, X, CheckCheck, Trash2,
  Radio, CheckCircle, Clock,
}                                                    from 'lucide-react';
import { formatDistanceToNow }                       from 'date-fns';

import api                                           from '../../services/api';
import {
  EASE, DURATION, SPRING, TAP,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * NotificationPanel — bell icon + dropdown in the topbar.
 *
 * Polls every 15 seconds. Opening the panel auto-marks-all-read.
 * Each notification type gets its own icon + colour so the user can
 * scan the list without reading every line.
 *
 * Uses lucide icons (not emoji) so the visual language matches the
 * rest of the app regardless of the system's emoji renderer.
 * ═════════════════════════════════════════════════════════════════
 */

// Icon + colour per notification type
const TYPE_META = {
  session_opened: {
    icon:   Radio,
    color:  'var(--green)',
    bg:     'var(--green-bg)',
    border: 'var(--green-border)',
  },
  attendance_confirmed: {
    icon:   CheckCircle,
    color:  'var(--brand-text)',
    bg:     'var(--brand-subtle)',
    border: 'var(--brand-border)',
  },
  session_closing_soon: {
    icon:   Clock,
    color:  'var(--amber)',
    bg:     'var(--amber-bg)',
    border: 'var(--amber-border)',
  },
  default: {
    icon:   Bell,
    color:  'var(--text-secondary)',
    bg:     'var(--bg-raised)',
    border: 'var(--border)',
  },
};

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const panelRef        = useRef(null);
  const qc              = useQueryClient();

  // ── Fetch notifications ──────────────────────────────────────
  const { data } = useQuery({
    queryKey:        ['notifications'],
    queryFn:         () => api.get('/notifications').then(r => r.data),
    refetchInterval: 15_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount   = data?.unreadCount   ?? 0;

  // ── Close on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Mutations ────────────────────────────────────────────────
  const markAllMut = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const clearMut = useMutation({
    mutationFn: () => api.delete('/notifications'),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneMut = useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}/read`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>

      {/* ── Bell button ─────────────────────────────────────── */}
      <motion.button
        whileTap={TAP.button}
        whileHover={{ scale: 1.05 }}
        transition={SPRING.snappy}
        onClick={() => {
          setOpen(o => !o);
          if (!open && unreadCount > 0) markAllMut.mutate();
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        style={{
          position:       'relative',
          width:          '36px',
          height:         '36px',
          borderRadius:   'var(--radius-atomic)',
          background:     open ? 'var(--brand-subtle)' : 'var(--bg-raised)',
          border:         `1px solid ${open ? 'var(--brand-border)' : 'var(--border)'}`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          open ? 'var(--brand-text)' : 'var(--text-secondary)',
          cursor:         'pointer',
          transition:     `all ${DURATION.base}ms ${EASE.state}`,
        }}
        onMouseEnter={e => {
          if (open) return;
          e.currentTarget.style.borderColor = 'var(--brand-border)';
          e.currentTarget.style.background  = 'var(--brand-subtle)';
          e.currentTarget.style.color       = 'var(--brand-text)';
        }}
        onMouseLeave={e => {
          if (open) return;
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.background  = 'var(--bg-raised)';
          e.currentTarget.style.color       = 'var(--text-secondary)';
        }}
      >
        <Bell size={16} />

        {/* Unread badge — spring-pops when count changes */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{    scale: 0, opacity: 0 }}
              transition={SPRING.bounce}
              style={{
                position:       'absolute',
                top:            '-5px',
                right:          '-5px',
                minWidth:       '18px',
                height:         '18px',
                background:     'var(--red)',
                borderRadius:   'var(--radius-pill)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '10px',
                fontWeight:     700,
                color:          '#fff',
                boxShadow:      '0 0 0 2px var(--topbar-bg)',
                padding:        '0 4px',
                fontFamily:     'var(--font-body)',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Dropdown panel ──────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{    opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: DURATION.base, ease: EASE.state }}
            style={{
              position:      'absolute',
              top:           'calc(100% + 8px)',
              right:         0,
              width:         '380px',
              maxWidth:      'calc(100vw - 32px)',
              maxHeight:     '500px',
              background:    'var(--bg-card)',
              borderRadius:  'var(--radius-molecular)',
              boxShadow:     'var(--shadow-lg)',
              zIndex:        100,
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
              transformOrigin: 'top right',
            }}
          >
            {/* ── Header ───────────────────────────────────── */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        'var(--space-2) var(--space-3)',
              borderBottom:   '1px solid var(--border)',
              flexShrink:     0,
              background:     'var(--bg-raised)',
            }}>
              <div style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '8px',
              }}>
                <Bell size={14} style={{ color: 'var(--text-muted)' }} />
                <p style={{
                  fontWeight: 600,
                  color:      'var(--text-primary)',
                  fontSize:   'var(--text-sm)',
                  fontFamily: 'var(--font-display)',
                }}>
                  Notifications
                </p>
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{    opacity: 0, scale: 0.6 }}
                      transition={SPRING.snappy}
                      style={{
                        padding:      '2px 8px',
                        background:   'var(--brand-subtle)',
                        color:        'var(--brand-text)',
                        border:       '1px solid var(--brand-border)',
                        borderRadius: 'var(--radius-pill)',
                        fontSize:     '10px',
                        fontWeight:   700,
                        fontFamily:   'var(--font-mono)',
                      }}
                    >
                      {unreadCount} new
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <div style={{ display: 'flex', gap: '2px' }}>
                <AnimatePresence>
                  {notifications.length > 0 && (
                    <>
                      <HeaderIconButton
                        title="Mark all read"
                        onClick={() => markAllMut.mutate()}
                        icon={CheckCheck}
                      />
                      <HeaderIconButton
                        title="Clear all"
                        onClick={() => clearMut.mutate()}
                        icon={Trash2}
                      />
                    </>
                  )}
                </AnimatePresence>
                <HeaderIconButton
                  title="Close"
                  onClick={() => setOpen(false)}
                  icon={X}
                />
              </div>
            </div>

            {/* ── List ─────────────────────────────────────── */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.08, duration: DURATION.medium }}
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
                    animate={{
                      scale:   [1, 1.04, 1],
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 2.5,
                      ease:     EASE.state,
                      repeat:   Infinity,
                    }}
                    style={{
                      width:          '48px',
                      height:         '48px',
                      borderRadius:   'var(--radius-molecular)',
                      background:     'var(--bg-raised)',
                      border:         '1px solid var(--border)',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      marginBottom:   'var(--space-2)',
                    }}
                  >
                    <Bell size={20} style={{ color: 'var(--text-muted)' }} />
                  </motion.div>
                  <p style={{
                    color:      'var(--text-primary)',
                    fontWeight: 600,
                    fontSize:   'var(--text-sm)',
                    fontFamily: 'var(--font-display)',
                  }}>
                    You're all caught up
                  </p>
                  <p style={{
                    color:     'var(--text-muted)',
                    fontSize:  'var(--text-xs)',
                    marginTop: '4px',
                    maxWidth:  '240px',
                    lineHeight: 1.5,
                  }}>
                    You'll be notified when sessions open or close, or when your attendance is confirmed.
                  </p>
                </motion.div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map((n, i) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      isLast={i === notifications.length - 1}
                      onMarkRead={() => { if (!n.read) markOneMut.mutate(n.id); }}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Header icon button (mark-all / clear / close) ─────────────
function HeaderIconButton({ title, onClick, icon: Icon }) {
  return (
    <motion.button
      whileTap={TAP.button}
      whileHover={{ scale: 1.05 }}
      transition={SPRING.snappy}
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        background:   'none',
        border:       'none',
        cursor:       'pointer',
        color:        'var(--text-muted)',
        display:      'flex',
        alignItems:   'center',
        padding:      '6px',
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
      <Icon size={14} />
    </motion.button>
  );
}

// ─── Single notification row ───────────────────────────────────
function NotificationItem({ notification: n, isLast, onMarkRead }) {
  const meta = TYPE_META[n.type] ?? TYPE_META.default;
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8, backgroundColor: 'var(--brand-subtle)' }}
      animate={{
        opacity: 1,
        x:       0,
        backgroundColor: !n.read ? 'var(--brand-subtle)' : 'transparent',
      }}
      exit={{ opacity: 0, x: -12 }}
      transition={{
        opacity: { duration: DURATION.base, ease: EASE.entry },
        x:       { ...SPRING.snappy },
        backgroundColor: { duration: 0.4, ease: EASE.state },
      }}
      onClick={onMarkRead}
      style={{
        display:      'flex',
        gap:          'var(--space-2)',
        padding:      'var(--space-2) var(--space-3)',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor:       !n.read ? 'pointer' : 'default',
      }}
    >
      {/* Type icon tile */}
      <div style={{
        width:          '36px',
        height:         '36px',
        borderRadius:   'var(--radius-atomic)',
        background:     meta.bg,
        border:         `1px solid ${meta.border}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
      }}>
        <Icon size={16} style={{ color: meta.color }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          gap:            '8px',
        }}>
          <p style={{
            color:      'var(--text-primary)',
            fontWeight: !n.read ? 600 : 500,
            fontSize:   'var(--text-sm)',
            lineHeight: 1.4,
            fontFamily: !n.read ? 'var(--font-display)' : 'var(--font-body)',
          }}>
            {n.title}
          </p>
          {!n.read && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={SPRING.bounce}
              style={{
                width:        '8px',
                height:       '8px',
                borderRadius: 'var(--radius-pill)',
                background:   'var(--brand)',
                flexShrink:   0,
                marginTop:    '6px',
                boxShadow:    '0 0 8px var(--brand)',
              }}
            />
          )}
        </div>
        <p style={{
          color:      'var(--text-secondary)',
          fontSize:   'var(--text-xs)',
          marginTop:  '2px',
          lineHeight: 1.5,
        }}>
          {n.message}
        </p>
        <p style={{
          color:      'var(--text-muted)',
          fontSize:   '10px',
          marginTop:  '6px',
          fontFamily: 'var(--font-mono)',
        }}>
          {n.createdAt
            ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })
            : '—'}
        </p>
      </div>
    </motion.div>
  );
}