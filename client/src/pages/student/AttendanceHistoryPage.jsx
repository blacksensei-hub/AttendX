import { useState, useMemo }                        from 'react';
import { useQuery, useMutation, useQueryClient }    from '@tanstack/react-query';
import { motion, AnimatePresence }                  from 'framer-motion';
import { format }                                   from 'date-fns';
import {
  Trash2, AlertTriangle, Download, Search, Filter,
  ChevronLeft, ChevronRight, X, MessageSquare,
}                                                   from 'lucide-react';
import toast                                        from 'react-hot-toast';

import api                                          from '../../services/api';
import PageShell, { PageHeader }                    from '../../components/layout/PageShell';
import StatusPill                                   from '../../components/ui/StatusPill';
import { AnimatedList, AnimatedItem }               from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
  overlayBackdrop, overlayContent,
}                                                   from '../../lib/motion';

const PAGE_SIZE = 20;

/**
 * ═════════════════════════════════════════════════════════════════
 * AttendanceHistoryPage — student's full attendance record.
 *
 * Features:
 *   • Server-side pagination, status + date filtering
 *   • Client-side free-text search on current page
 *   • Active filter pills with individual clear
 *   • One-click CSV export (respects current filters)
 *   • Inline appeal submission for Late/Absent records
 *   • Bulk clear-all with confirmation
 * ═════════════════════════════════════════════════════════════════
 */
export default function AttendanceHistoryPage() {
  const qc = useQueryClient();

  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('');
  const [from,        setFrom]        = useState('');
  const [to,          setTo]          = useState('');
  const [page,        setPage]        = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [appealModal, setAppealModal] = useState(null);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (from)   params.set('from',   from);
  if (to)     params.set('to',     to);
  params.set('page',  page);
  params.set('limit', PAGE_SIZE);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-history', status, from, to, page],
    queryFn:  () => api.get(`/reports/student-history?${params}`).then(r => r.data),
    keepPreviousData: true,
  });

  const { data: appealsData } = useQuery({
    queryKey: ['my-appeals'],
    queryFn:  () => api.get('/appeals/my').then(r => r.data),
  });

  const records    = data?.records    ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Fast lookup: sessionId → existing appeal
  const appealsBySession = useMemo(() => {
    const map = {};
    (appealsData?.appeals ?? []).forEach(a => { map[a.session_id] = a; });
    return map;
  }, [appealsData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r =>
      r.className?.toLowerCase().includes(q) ||
      r.sessionTitle?.toLowerCase().includes(q)
    );
  }, [records, search]);

  const applyFilter = (fn) => { fn(); setPage(1); };
  const hasFilters  = !!(status || from || to || search);
  const clearFilters = () => {
    setSearch(''); setStatus(''); setFrom(''); setTo(''); setPage(1);
  };

  // ── Mutations ────────────────────────────────────────────────
  const clearMut = useMutation({
    mutationFn: () => api.delete('/reports/student-history').then(r => r.data),
    onSuccess:  (res) => {
      toast.success(res.message || 'History cleared');
      qc.invalidateQueries({ queryKey: ['attendance-history'] });
      qc.invalidateQueries({ queryKey: ['student-stats'] });
      setShowConfirm(false);
      setPage(1);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to clear history'),
  });

  // ── Export CSV ───────────────────────────────────────────────
  const exportCSV = async () => {
    setExporting(true);
    try {
      const exportParams = new URLSearchParams();
      if (status) exportParams.set('status', status);
      if (from)   exportParams.set('from',   from);
      if (to)     exportParams.set('to',     to);
      const res = await api.get(
        `/reports/student-history/export/csv?${exportParams}`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `my-attendance-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Header ──────────────────────────────────────────── */}
      <PageHeader
        title="Attendance History"
        subtitle={`${total} record${total !== 1 ? 's' : ''}${hasFilters ? ' (filtered)' : ''}`}
        action={
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <motion.button
              whileTap={TAP.button}
              whileHover={!exporting && total > 0 ? { y: -1 } : undefined}
              transition={SPRING.snappy}
              onClick={exportCSV}
              disabled={exporting || total === 0}
              className="btn-ghost"
              style={{ fontSize: 'var(--text-xs)' }}
            >
              {exporting ? (
                <span style={{
                  width:        '12px',
                  height:       '12px',
                  border:       '2px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation:    'spin 0.8s linear infinite',
                }} />
              ) : <Download size={13} />}
              Export CSV
            </motion.button>

            {total > 0 && (
              <motion.button
                whileTap={TAP.button}
                whileHover={{ y: -1 }}
                transition={SPRING.snappy}
                onClick={() => setShowConfirm(true)}
                className="btn-danger"
                style={{ fontSize: 'var(--text-xs)' }}
              >
                <Trash2 size={13} />
                Clear all
              </motion.button>
            )}
          </div>
        }
      />

      {/* ── Clear confirmation ─────────────────────────────── */}
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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              <div style={{
                width: '36px', height: '36px',
                borderRadius: 'var(--radius-atomic)',
                background:   'var(--red-bg)',
                border:       '1px solid var(--red-border)',
                flexShrink:   0,
                display:      'flex',
                alignItems:   'center',
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
                  Clear all attendance history?
                </p>
                <p style={{
                  color:      'var(--text-secondary)',
                  fontSize:   'var(--text-xs)',
                  lineHeight: 1.6,
                  marginBottom: 'var(--space-2)',
                }}>
                  This permanently deletes all {total} record{total !== 1 ? 's' : ''}. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <motion.button
                    whileTap={TAP.button}
                    onClick={() => clearMut.mutate()}
                    disabled={clearMut.isPending}
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
                      cursor:       clearMut.isPending ? 'not-allowed' : 'pointer',
                      opacity:      clearMut.isPending ? 0.7 : 1,
                      fontFamily:   'var(--font-body)',
                    }}
                  >
                    <Trash2 size={12} />
                    {clearMut.isPending ? 'Clearing…' : 'Yes, clear all'}
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

      {/* ── Filters panel ───────────────────────────────────── */}
      <div style={{
        background:    'var(--bg-card)',
        borderRadius:  'var(--radius-molecular)',
        padding:       'var(--space-3)',
        boxShadow:     'var(--shadow-sm)',
        display:       'flex',
        flexDirection: 'column',
        gap:           'var(--space-2)',
      }}>
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '6px',
        }}>
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{
            color:      'var(--text-secondary)',
            fontSize:   'var(--text-sm)',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
          }}>
            Filters
          </span>
          {hasFilters && (
            <motion.button
              whileTap={TAP.button}
              onClick={clearFilters}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '3px',
                marginLeft: 'auto',
                color:      'var(--brand-text)',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                fontSize:   'var(--text-xs)',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
              }}
            >
              <X size={11} /> Clear all
            </motion.button>
          )}
        </div>

        <div style={{
          display:             'grid',
          gap:                 '8px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{
              position:  'absolute',
              left:      '12px',
              top:       '50%',
              transform: 'translateY(-50%)',
              color:     'var(--text-muted)',
              pointerEvents: 'none',
            }} />
            <input
              value={search}
              onChange={e => applyFilter(() => setSearch(e.target.value))}
              placeholder="Search class or session…"
              className="input-base"
              style={{ paddingLeft: '34px' }}
            />
          </div>

          <select
            value={status}
            onChange={e => applyFilter(() => setStatus(e.target.value))}
            className="input-base"
            style={{ cursor: 'pointer' }}
          >
            <option value="">All statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </select>

          <input
            type="date"
            value={from}
            onChange={e => applyFilter(() => setFrom(e.target.value))}
            className="input-base"
            placeholder="From"
          />

          <input
            type="date"
            value={to}
            onChange={e => applyFilter(() => setTo(e.target.value))}
            className="input-base"
            placeholder="To"
          />
        </div>
      </div>

      {/* ── Active filter pills ─────────────────────────────── */}
      <AnimatePresence>
        {hasFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{    opacity: 0, height: 0 }}
            transition={{ duration: DURATION.base, ease: EASE.state }}
            style={{
              display:  'flex',
              flexWrap: 'wrap',
              gap:      '6px',
              overflow: 'hidden',
            }}
          >
            {search && <FilterPill label={`"${search}"`} onRemove={() => setSearch('')} />}
            {status && <FilterPill label={status.charAt(0).toUpperCase() + status.slice(1)} onRemove={() => setStatus('')} />}
            {from   && <FilterPill label={`From ${from}`} onRemove={() => setFrom('')} />}
            {to     && <FilterPill label={`To ${to}`}     onRemove={() => setTo('')}   />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading state ───────────────────────────────────── */}
      {isLoading && (
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '8px',
        }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="shimmer"
              style={{
                height:       '76px',
                borderRadius: 'var(--radius-molecular)',
              }}
            />
          ))}
        </div>
      )}

      {/* ── Empty state / records list ──────────────────────── */}
      <AnimatePresence mode="wait">
        {!isLoading && filtered.length === 0 ? (
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
                width: '56px', height: '56px',
                borderRadius: 'var(--radius-molecular)',
                background:   'var(--bg-raised)',
                border:       '1px solid var(--border)',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-3)',
              }}
            >
              <Search size={24} style={{ color: 'var(--text-muted)' }} />
            </motion.div>
            <p style={{
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
            }}>
              {hasFilters ? 'No records match your filters' : 'No attendance records yet'}
            </p>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-sm)',
              marginTop: '6px',
              marginBottom: hasFilters ? 'var(--space-3)' : 0,
            }}>
              {hasFilters
                ? 'Try adjusting or clearing your filters'
                : 'Mark attendance in a session to see your history here'}
            </p>
            {hasFilters && (
              <motion.button
                whileTap={TAP.button}
                whileHover={{ y: -1 }}
                transition={SPRING.snappy}
                onClick={clearFilters}
                className="btn-primary"
                style={{ fontSize: 'var(--text-sm)' }}
              >
                Clear filters
              </motion.button>
            )}
          </motion.div>
        ) : !isLoading && (
          <AnimatedList
            key="list"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <AnimatePresence initial={false}>
              {filtered.map(r => (
                <AnimatedItem key={r.id} layout>
                  <RecordRow
                    record={r}
                    existingAppeal={appealsBySession[r.sessionId]}
                    onAppeal={() => setAppealModal({
                      sessionId:    r.sessionId,
                      className:    r.className,
                      sessionTitle: r.sessionTitle,
                    })}
                  />
                </AnimatedItem>
              ))}
            </AnimatePresence>
          </AnimatedList>
        )}
      </AnimatePresence>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          onGoTo={setPage}
        />
      )}

      {/* ── Appeal modal ────────────────────────────────────── */}
      <AnimatePresence>
        {appealModal && (
          <AppealModal
            session={appealModal}
            onClose={() => setAppealModal(null)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['my-appeals'] });
              setAppealModal(null);
            }}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Record row ────────────────────────────────────────────────
function RecordRow({ record, existingAppeal, onAppeal }) {
  const canAppeal = (record.status === 'absent' || record.status === 'late')
    && !existingAppeal;

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={SPRING.snappy}
      style={{
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-molecular)',
        padding:      'var(--space-2) var(--space-3)',
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--space-2)',
        flexWrap:     'wrap',
        boxShadow:    'var(--shadow-sm)',
      }}
    >
      {/* Class initial */}
      <div style={{
        width:          '40px',
        height:         '40px',
        borderRadius:   'var(--radius-atomic)',
        background:     'var(--brand-subtle)',
        border:         '1px solid var(--brand-border)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontFamily:     'var(--font-display)',
        fontWeight:     700,
        fontSize:       'var(--text-sm)',
        color:          'var(--brand-text)',
        flexShrink:     0,
      }}>
        {record.className?.[0]?.toUpperCase() ?? '?'}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          color:        'var(--text-primary)',
          fontWeight:   600,
          fontSize:     'var(--text-sm)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {record.className}
          {record.className === 'Deleted class' && (
            <span style={{
              marginLeft: '6px',
              color:      'var(--text-muted)',
              fontSize:   'var(--text-xs)',
              fontWeight: 400,
            }}>
              (class removed)
            </span>
          )}
        </p>
        <p style={{
          color:     'var(--text-muted)',
          fontSize:  'var(--text-xs)',
          marginTop: '2px',
        }}>
          {record.sessionTitle || 'Attendance session'}
          {' · '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {record.marked_at
              ? format(new Date(record.marked_at), 'dd MMM yyyy, HH:mm')
              : '—'}
          </span>
        </p>
      </div>

      {/* Right: status + appeal */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        '6px',
        flexShrink: 0,
        flexWrap:   'wrap',
      }}>
        <StatusPill status={record.status} showSweep={false} />

        {canAppeal && (
          <motion.button
            whileTap={TAP.button}
            whileHover={{ y: -1 }}
            transition={SPRING.snappy}
            onClick={onAppeal}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '4px',
              padding:      '4px 10px',
              background:   'var(--amber-bg)',
              border:       '1px solid var(--amber-border)',
              color:        'var(--amber)',
              borderRadius: 'var(--radius-pill)',
              fontSize:     'var(--text-xs)',
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   'var(--font-body)',
            }}
          >
            <MessageSquare size={11} />
            Appeal
          </motion.button>
        )}

        {existingAppeal && (
          <StatusPill
            status={existingAppeal.status}
            label={`Appeal ${existingAppeal.status}`}
            showSweep={false}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Pagination ────────────────────────────────────────────────
function Pagination({ page, totalPages, total, onPrev, onNext, onGoTo }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1))
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '6px',
      paddingTop:     'var(--space-2)',
      flexWrap:       'wrap',
    }}>
      <motion.button
        whileTap={TAP.button}
        onClick={onPrev}
        disabled={page === 1}
        className="btn-ghost"
        style={{ padding: '8px 10px', opacity: page === 1 ? 0.4 : 1 }}
      >
        <ChevronLeft size={15} />
      </motion.button>

      <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
        {pages.map((p, i) =>
          p === '...' ? (
            <span
              key={`e-${i}`}
              style={{
                padding: '8px 4px',
                color:   'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              …
            </span>
          ) : (
            <motion.button
              key={p}
              whileTap={TAP.button}
              onClick={() => onGoTo(p)}
              style={{
                position:     'relative',
                width:        '36px',
                height:       '36px',
                borderRadius: 'var(--radius-atomic)',
                border:       'none',
                background:   'transparent',
                color:        p === page ? 'var(--brand-text)' : 'var(--text-secondary)',
                fontWeight:   p === page ? 700 : 500,
                fontSize:     'var(--text-sm)',
                fontFamily:   'var(--font-mono)',
                cursor:       'pointer',
              }}
            >
              {p === page && (
                <motion.div
                  layoutId="history-page-active"
                  transition={SPRING.gentle}
                  style={{
                    position:     'absolute',
                    inset:        0,
                    background:   'var(--brand-subtle)',
                    border:       '1px solid var(--brand-border)',
                    borderRadius: 'var(--radius-atomic)',
                    zIndex:       0,
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{p}</span>
            </motion.button>
          )
        )}
      </div>

      <motion.button
        whileTap={TAP.button}
        onClick={onNext}
        disabled={page === totalPages}
        className="btn-ghost"
        style={{
          padding: '8px 10px',
          opacity: page === totalPages ? 0.4 : 1,
        }}
      >
        <ChevronRight size={15} />
      </motion.button>

      <span style={{
        color:      'var(--text-muted)',
        fontSize:   'var(--text-xs)',
        marginLeft: 'var(--space-2)',
        fontFamily: 'var(--font-mono)',
      }}>
        Page {page} of {totalPages} · {total} total
      </span>
    </div>
  );
}

// ─── Filter pill ───────────────────────────────────────────────
function FilterPill({ label, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{    opacity: 0, scale: 0.85 }}
      transition={SPRING.snappy}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '6px',
        padding:      '4px 10px',
        background:   'var(--brand-subtle)',
        border:       '1px solid var(--brand-border)',
        borderRadius: 'var(--radius-pill)',
        fontSize:     'var(--text-xs)',
        color:        'var(--brand-text)',
        fontWeight:   500,
      }}
    >
      {label}
      <motion.button
        whileTap={TAP.button}
        onClick={onRemove}
        style={{
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          color:      'inherit',
          display:    'flex',
          padding:    0,
        }}
      >
        <X size={11} />
      </motion.button>
    </motion.div>
  );
}

// ─── Appeal modal ──────────────────────────────────────────────
function AppealModal({ session, onClose, onSuccess }) {
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for your appeal');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/appeals', {
        sessionId: session.sessionId,
        reason:    reason.trim(),
      });
      toast.success('Appeal submitted — your lecturer will review it shortly');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit appeal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={overlayBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
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
          maxWidth:     '500px',
          background:   'var(--bg-card)',
          borderRadius: 'var(--radius-organism)',
          padding:      'var(--space-4)',
          boxShadow:    'var(--shadow-lg)',
        }}
      >
        <div style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          marginBottom:   'var(--space-3)',
        }}>
          <div>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color:      'var(--text-primary)',
              fontSize:   'var(--text-lg)',
            }}>
              Submit appeal
            </h3>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-sm)',
              marginTop: '4px',
            }}>
              {session.className}
              {session.sessionTitle ? ` · ${session.sessionTitle}` : ''}
            </p>
          </div>
          <motion.button
            whileTap={TAP.button}
            onClick={onClose}
            style={{
              background:   'none',
              border:       'none',
              cursor:       'pointer',
              color:        'var(--text-muted)',
              padding:      '6px',
              borderRadius: 'var(--radius-atomic)',
              display:      'flex',
            }}
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* Info banner */}
        <div style={{
          display:      'flex',
          alignItems:   'flex-start',
          gap:          'var(--space-2)',
          padding:      '10px 14px',
          background:   'var(--amber-bg)',
          border:       '1px solid var(--amber-border)',
          borderRadius: 'var(--radius-atomic)',
          marginBottom: 'var(--space-3)',
        }}>
          <MessageSquare size={14} style={{
            color:     'var(--amber)',
            flexShrink: 0,
            marginTop: '2px',
          }} />
          <p style={{
            color:      'var(--text-secondary)',
            fontSize:   'var(--text-xs)',
            lineHeight: 1.6,
          }}>
            Your lecturer will review this appeal and update your attendance status if approved. You will receive an email with the outcome.
          </p>
        </div>

        {/* Reason textarea */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label style={{
            color:        'var(--text-secondary)',
            fontSize:     'var(--text-xs)',
            fontWeight:   600,
            display:      'block',
            marginBottom: '6px',
          }}>
            Reason for appeal *
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={5}
            placeholder="Explain why you believe your attendance status should be changed.&#10;&#10;Include relevant details:&#10;· Technical issues (phone died, camera not working)&#10;· You arrived and could not scan&#10;· Medical or personal emergency"
            className="input-base"
            style={{ resize: 'none', width: '100%', lineHeight: 1.6 }}
          />
          <p style={{
            color:     'var(--text-muted)',
            fontSize:  '10px',
            marginTop: '4px',
            fontFamily:'var(--font-mono)',
          }}>
            {reason.length} characters — be as specific as possible
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <motion.button
            whileTap={TAP.button}
            onClick={onClose}
            className="btn-ghost"
            style={{ flex: 1 }}
          >
            Cancel
          </motion.button>
          <motion.button
            whileTap={TAP.button}
            whileHover={!submitting && reason.trim() ? { y: -1 } : undefined}
            transition={SPRING.snappy}
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="btn-primary"
            style={{
              flex: 2,
              opacity: (submitting || !reason.trim()) ? 0.7 : 1,
            }}
          >
            <MessageSquare size={14} />
            {submitting ? 'Submitting…' : 'Submit appeal'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}