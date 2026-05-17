import { useState }                                  from 'react';
import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  MessageSquare, CheckCircle, XCircle,
  Clock, Trash2, AlertTriangle,
}                                                    from 'lucide-react';
import { format }                                    from 'date-fns';
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
 * AppealsPage — lecturer's appeals review queue.
 *
 * Students submit attendance appeals from their history page. This
 * is where the lecturer reviews each, approves (marking the student
 * as Present or Late) or rejects with an optional note.
 *
 * Features:
 *   • Tabbed filter — Pending / Approved / Rejected / All
 *   • Bulk delete with confirmation
 *   • Inline expand-to-review form with explicit status choice
 *   • StatusPill throughout for consistent visual language
 *   • AnimatedList for orchestrated entrance
 * ═════════════════════════════════════════════════════════════════
 */
export default function AppealsPage() {
  const qc = useQueryClient();

  const [reviewing,    setReviewing]    = useState(null);
  const [lecturerNote, setLecturerNote] = useState('');
  const [filter,       setFilter]       = useState('pending');
  const [showConfirm,  setShowConfirm]  = useState(false);

  // ── Fetch appeals ─────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey:        ['lecturer-appeals'],
    queryFn:         () => api.get('/appeals/lecturer').then(r => r.data),
    refetchInterval: 30_000,
  });

  const appeals      = data?.appeals      ?? [];
  const pendingCount = data?.pendingCount ?? 0;

  const filtered = filter === 'all'
    ? appeals
    : appeals.filter(a => a.status === filter);

  const TABS = [
    { key: 'pending',  label: 'Pending',  count: appeals.filter(a => a.status === 'pending').length  },
    { key: 'approved', label: 'Approved', count: appeals.filter(a => a.status === 'approved').length },
    { key: 'rejected', label: 'Rejected', count: appeals.filter(a => a.status === 'rejected').length },
    { key: 'all',      label: 'All',      count: appeals.length },
  ];

  // ── Review mutation ──────────────────────────────────────────
  // Approval requires an explicit status ('present' or 'late') so
  // the backend never assumes. Rejection only needs the decision.
  const reviewMut = useMutation({
    mutationFn: ({ appealId, decision, status, lecturer_note }) =>
      api.put(`/appeals/${appealId}/review`, { decision, status, lecturer_note }),
    onSuccess: (_, vars) => {
      const label = vars.decision === 'approved'
        ? `Appeal approved — marked as ${vars.status}`
        : 'Appeal rejected';
      toast.success(label);
      qc.invalidateQueries({ queryKey: ['lecturer-appeals'] });
      qc.invalidateQueries({ queryKey: ['lecturer-appeals-count'] });
      setReviewing(null);
      setLecturerNote('');
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to review appeal'),
  });

  // ── Delete all mutation ──────────────────────────────────────
  const deleteAllMut = useMutation({
    mutationFn: () => api.delete('/appeals/lecturer/all'),
    onSuccess:  (res) => {
      toast.success(res.data?.message ?? 'All appeals deleted');
      qc.invalidateQueries({ queryKey: ['lecturer-appeals'] });
      qc.invalidateQueries({ queryKey: ['lecturer-appeals-count'] });
      setShowConfirm(false);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to delete appeals'),
  });

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Attendance Appeals" subtitle="Loading…" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="shimmer"
              style={{
                height:       '180px',
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
        title="Attendance Appeals"
        subtitle={
          pendingCount > 0
            ? `${pendingCount} appeal${pendingCount > 1 ? 's' : ''} waiting for your review`
            : 'All caught up — no pending appeals'
        }
        action={appeals.length > 0 && (
          <motion.button
            whileTap={TAP.button}
            whileHover={{ y: -1 }}
            transition={SPRING.snappy}
            onClick={() => setShowConfirm(true)}
            className="btn-danger"
          >
            <Trash2 size={14} />
            Delete all
          </motion.button>
        )}
      />

      {/* ── Delete confirmation ─────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{    opacity: 0, y: -8, scale: 0.97 }}
            transition={SPRING.snappy}
            style={{
              background:   'var(--red-bg)',
              border:       '1px solid var(--red-border)',
              borderRadius: 'var(--radius-molecular)',
              padding:      'var(--space-3)',
              boxShadow:    'var(--shadow-sm)',
            }}
          >
            <div style={{
              display:    'flex',
              alignItems: 'flex-start',
              gap:        'var(--space-2)',
            }}>
              <div style={{
                width:          '36px',
                height:         '36px',
                borderRadius:   'var(--radius-atomic)',
                background:     'var(--red-bg)',
                border:         '1px solid var(--red-border)',
                flexShrink:     0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}>
                <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  color:        'var(--text-primary)',
                  fontWeight:   600,
                  fontFamily:   'var(--font-display)',
                  fontSize:     'var(--text-sm)',
                  marginBottom: '4px',
                }}>
                  Delete all {appeals.length} appeal{appeals.length !== 1 ? 's' : ''}?
                </p>
                <p style={{
                  color:        'var(--text-secondary)',
                  fontSize:     'var(--text-xs)',
                  lineHeight:   1.6,
                  marginBottom: 'var(--space-2)',
                }}>
                  This permanently removes all appeal records including approved and rejected ones. Students will no longer see their appeal history. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <motion.button
                    whileTap={TAP.button}
                    onClick={() => deleteAllMut.mutate()}
                    disabled={deleteAllMut.isPending}
                    style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          '6px',
                      padding:      '8px 14px',
                      background:   'var(--red)',
                      color:        '#fff',
                      border:       'none',
                      borderRadius: 'var(--radius-atomic)',
                      fontSize:     'var(--text-xs)',
                      fontWeight:   600,
                      cursor:       deleteAllMut.isPending ? 'not-allowed' : 'pointer',
                      opacity:      deleteAllMut.isPending ? 0.7 : 1,
                      fontFamily:   'var(--font-body)',
                    }}
                  >
                    <Trash2 size={12} />
                    {deleteAllMut.isPending ? 'Deleting…' : 'Yes, delete all'}
                  </motion.button>
                  <motion.button
                    whileTap={TAP.button}
                    onClick={() => setShowConfirm(false)}
                    className="btn-ghost"
                    style={{ padding: '8px 14px', fontSize: 'var(--text-xs)' }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filter tabs ─────────────────────────────────────── */}
      <div style={{
        display:  'flex',
        gap:      '6px',
        flexWrap: 'wrap',
        position: 'relative',
      }}>
        {TABS.map(tab => {
          const active = filter === tab.key;
          return (
            <motion.button
              key={tab.key}
              whileTap={TAP.button}
              onClick={() => setFilter(tab.key)}
              style={{
                position:      'relative',
                padding:       '6px 14px',
                borderRadius:  'var(--radius-pill)',
                border:        '1px solid',
                borderColor:   'transparent',
                background:    'transparent',
                fontSize:      'var(--text-xs)',
                fontWeight:    active ? 600 : 500,
                cursor:        'pointer',
                color:         active ? 'var(--brand-text)' : 'var(--text-muted)',
                display:       'flex',
                alignItems:    'center',
                gap:           '6px',
                fontFamily:    'var(--font-body)',
                transition:    `color ${DURATION.base}ms ${EASE.state}`,
              }}
            >
              {/*
                Morphing pill background via layoutId — slides between
                tabs instead of showing/hiding per-tab. Same technique
                as the sidebar active indicator.
              */}
              {active && (
                <motion.div
                  layoutId="appeal-tab-active"
                  transition={SPRING.gentle}
                  style={{
                    position:     'absolute',
                    inset:        0,
                    background:   'var(--brand-subtle)',
                    border:       '1px solid var(--brand-border)',
                    borderRadius: 'var(--radius-pill)',
                    zIndex:       0,
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>
                {tab.label}
              </span>
              {tab.count > 0 && (
                <span style={{
                  position:     'relative',
                  zIndex:       1,
                  background:   active ? 'var(--brand)' : 'var(--bg-raised)',
                  color:        active ? '#fff' : 'var(--text-muted)',
                  borderRadius: 'var(--radius-pill)',
                  padding:      '1px 7px',
                  fontSize:     '10px',
                  fontWeight:   700,
                  minWidth:     '18px',
                  textAlign:    'center',
                  transition:   `all ${DURATION.base}ms ${EASE.state}`,
                }}>
                  {tab.count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── Empty state / Appeals list ──────────────────────── */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key={`empty-${filter}`}
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
                width:          '56px',
                height:         '56px',
                borderRadius:   'var(--radius-molecular)',
                background:     'var(--bg-raised)',
                border:         '1px solid var(--border)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                marginBottom:   'var(--space-3)',
              }}
            >
              <MessageSquare size={24} style={{ color: 'var(--text-muted)' }} />
            </motion.div>
            <p style={{
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
            }}>
              No {filter === 'all' ? '' : filter} appeals
            </p>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-sm)',
              marginTop: '6px',
            }}>
              {filter === 'pending'
                ? 'All appeals have been reviewed'
                : 'No appeals in this category yet'}
            </p>
          </motion.div>
        ) : (
          <AnimatedList
            key="list"
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <AnimatePresence initial={false}>
              {filtered.map(appeal => (
                <AnimatedItem key={appeal.id} layout>
                  <AppealCard
                    appeal={appeal}
                    isReviewing={reviewing?.id === appeal.id}
                    note={lecturerNote}
                    onNoteChange={setLecturerNote}
                    onStartReview={() => setReviewing(appeal)}
                    onCancelReview={() => {
                      setReviewing(null);
                      setLecturerNote('');
                    }}
                    onApprove={(status) => reviewMut.mutate({
                      appealId:      appeal.id,
                      decision:      'approved',
                      status,
                      lecturer_note: lecturerNote,
                    })}
                    onReject={() => reviewMut.mutate({
                      appealId:      appeal.id,
                      decision:      'rejected',
                      lecturer_note: lecturerNote,
                    })}
                    isPending={reviewMut.isPending}
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

// ─── Single appeal card ────────────────────────────────────────
function AppealCard({
  appeal, isReviewing, note, onNoteChange,
  onStartReview, onCancelReview, onApprove, onReject,
  isPending,
}) {
  return (
    <motion.div
      whileHover={!isReviewing ? { y: -2 } : undefined}
      transition={SPRING.snappy}
      style={{
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-molecular)',
        overflow:     'hidden',
        boxShadow:    'var(--shadow-md)',
      }}
    >
      {/* Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            'var(--space-2)',
        padding:        'var(--space-3)',
        borderBottom:   '1px solid var(--border)',
        background:     'var(--bg-raised)',
      }}>
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        'var(--space-2)',
          minWidth:   0,
          flex:       1,
        }}>
          <div style={{
            width:          '36px',
            height:         '36px',
            borderRadius:   'var(--radius-atomic)',
            background:     'var(--brand-subtle)',
            border:         '1px solid var(--brand-border)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontFamily:     'var(--font-display)',
            fontWeight:     700,
            color:          'var(--brand-text)',
            fontSize:       'var(--text-sm)',
            flexShrink:     0,
          }}>
            {appeal.student?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              color:        'var(--text-primary)',
              fontWeight:   600,
              fontSize:     'var(--text-sm)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {appeal.student?.name}
            </p>
            <p style={{
              color:        'var(--text-muted)',
              fontSize:     'var(--text-xs)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              marginTop:    '1px',
            }}>
              {appeal.student?.student_id
                ? `${appeal.student.student_id} · `
                : ''}
              {appeal.student?.email}
            </p>
          </div>
        </div>

        <StatusPill status={appeal.status} showSweep={false} />
      </div>

      {/* Body */}
      <div style={{
        padding:       'var(--space-3)',
        display:       'flex',
        flexDirection: 'column',
        gap:           'var(--space-2)',
      }}>

        {/* Session info */}
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '6px',
          flexWrap:   'wrap',
        }}>
          <Clock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
            {appeal.session?.class_name_snapshot}
            {appeal.session?.title ? ` · ${appeal.session.title}` : ''}
            {' · '}
            {appeal.session?.open_at
              ? format(new Date(appeal.session.open_at), 'dd MMM yyyy, HH:mm')
              : '—'}
          </p>
        </div>

        {/* Student reason */}
        <QuoteBlock label="Student's reason" tone="neutral">
          {appeal.reason}
        </QuoteBlock>

        {/* Lecturer note — shown after review */}
        {appeal.lecturer_note && (
          <QuoteBlock
            label="Your note"
            tone={appeal.status === 'approved' ? 'approved' : 'rejected'}
          >
            {appeal.lecturer_note}
          </QuoteBlock>
        )}

        {/* Review UI */}
        {appeal.status === 'pending' && (
          <AnimatePresence mode="wait">
            {isReviewing ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{    opacity: 0, height: 0 }}
                transition={{ duration: DURATION.base, ease: EASE.state }}
                style={{
                  display:       'flex',
                  flexDirection: 'column',
                  gap:           '8px',
                  overflow:      'hidden',
                }}
              >
                <textarea
                  value={note}
                  onChange={e => onNoteChange(e.target.value)}
                  placeholder="Add a note for the student (optional)…"
                  rows={3}
                  className="input-base"
                  style={{ resize: 'none' }}
                />

                {/* Approve section */}
                <div style={{
                  background:    'var(--green-bg)',
                  border:        '1px solid var(--green-border)',
                  borderRadius:  'var(--radius-atomic)',
                  padding:       'var(--space-2)',
                  display:       'flex',
                  flexDirection: 'column',
                  gap:           '8px',
                }}>
                  <p style={{
                    color:         'var(--green)',
                    fontSize:      '10px',
                    fontWeight:    700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    Approve — mark student as
                  </p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <ApprovalButton
                      label="Present"
                      color="var(--green)"
                      bg="var(--green-bg)"
                      border="var(--green-border)"
                      onClick={() => onApprove('present')}
                      disabled={isPending}
                    />
                    <ApprovalButton
                      label="Late"
                      color="var(--amber)"
                      bg="var(--amber-bg)"
                      border="var(--amber-border)"
                      onClick={() => onApprove('late')}
                      disabled={isPending}
                    />
                  </div>
                </div>

                {/* Reject + Cancel row */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <motion.button
                    whileTap={TAP.button}
                    onClick={onCancelReview}
                    className="btn-ghost"
                    style={{ flex: 1, fontSize: 'var(--text-xs)' }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileTap={TAP.button}
                    whileHover={!isPending ? { y: -1 } : undefined}
                    transition={SPRING.snappy}
                    onClick={onReject}
                    disabled={isPending}
                    className="btn-danger"
                    style={{
                      flex:     1,
                      fontSize: 'var(--text-xs)',
                      opacity:  isPending ? 0.7 : 1,
                    }}
                  >
                    <XCircle size={13} />
                    Reject
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="review-cta"
                whileTap={TAP.button}
                whileHover={{ y: -1 }}
                transition={SPRING.snappy}
                onClick={onStartReview}
                style={{
                  padding:        '10px',
                  background:     'var(--brand-subtle)',
                  border:         '1px solid var(--brand-border)',
                  color:          'var(--brand-text)',
                  borderRadius:   'var(--radius-atomic)',
                  fontSize:       'var(--text-sm)',
                  fontWeight:     600,
                  cursor:         'pointer',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            '6px',
                  fontFamily:     'var(--font-body)',
                }}
              >
                <MessageSquare size={14} />
                Review appeal
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ─── Quote block (student reason or lecturer note) ─────────────
function QuoteBlock({ label, children, tone = 'neutral' }) {
  const toneStyles = {
    neutral: {
      bg:     'var(--bg-raised)',
      border: 'var(--border)',
      color:  'var(--text-muted)',
    },
    approved: {
      bg:     'var(--green-bg)',
      border: 'var(--green-border)',
      color:  'var(--green)',
    },
    rejected: {
      bg:     'var(--red-bg)',
      border: 'var(--red-border)',
      color:  'var(--red)',
    },
  }[tone];

  return (
    <div style={{
      background:   toneStyles.bg,
      border:       `1px solid ${toneStyles.border}`,
      borderRadius: 'var(--radius-atomic)',
      padding:      '10px 14px',
    }}>
      <p style={{
        color:         toneStyles.color,
        fontSize:      '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight:    600,
        marginBottom:  '4px',
      }}>
        {label}
      </p>
      <p style={{
        color:      'var(--text-primary)',
        fontSize:   'var(--text-sm)',
        lineHeight: 1.6,
      }}>
        {children}
      </p>
    </div>
  );
}

// ─── Approval button (Present / Late) ──────────────────────────
function ApprovalButton({ label, color, bg, border, onClick, disabled }) {
  return (
    <motion.button
      whileTap={TAP.button}
      whileHover={!disabled ? { y: -1, scale: 1.02 } : undefined}
      transition={SPRING.snappy}
      onClick={onClick}
      disabled={disabled}
      style={{
        flex:           1,
        padding:        '10px',
        background:     bg,
        border:         `1px solid ${border}`,
        color,
        borderRadius:   'var(--radius-atomic)',
        fontSize:       'var(--text-sm)',
        fontWeight:     700,
        cursor:         disabled ? 'not-allowed' : 'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '6px',
        opacity:        disabled ? 0.7 : 1,
        fontFamily:     'var(--font-body)',
      }}
    >
      <CheckCircle size={14} />
      {label}
    </motion.button>
  );
}