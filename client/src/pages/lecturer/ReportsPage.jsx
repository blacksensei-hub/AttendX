import { useState, useMemo, useCallback, memo }      from 'react';
import { useNavigate }                               from 'react-router-dom';
import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  FileText, Download, ChevronDown,
  Search, Trash2, Edit2,
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
 * ReportsPage — historical record of every session.
 *
 * Memoization changes:
 *   • filtered + grouped derivation in useMemo (only re-runs when
 *     search text or session data changes)
 *   • all action handlers in useCallback so children with memo
 *     don't see fresh function references
 *   • ClassGroupCard and SessionRow wrapped in memo
 *   • Expanded state passed as a derived `isExpanded` boolean
 *     so only the row that flipped re-renders, not all 50 of them
 * ═════════════════════════════════════════════════════════════════
 */
export default function ReportsPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [search,    setSearch]    = useState('');
  const [expanded,  setExpanded]  = useState(null);
  const [exporting, setExporting] = useState(null);

  // ── Fetch all sessions ───────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['all-sessions'],
    queryFn:  () => api.get('/reports/all-sessions').then(r => r.data),
  });

  // ── Derived data: filter + group ─────────────────────────────
  // Wrapped in useMemo so it only re-runs when search or data
  // changes — not on every parent render (e.g. when `expanded`
  // state flips).
  const { sessions, grouped } = useMemo(() => {
    const all = data?.sessions ?? [];
    const filtered = !search.trim()
      ? all
      : all.filter(s => {
          const q = search.toLowerCase();
          return s.className?.toLowerCase().includes(q) ||
                 s.title?.toLowerCase().includes(q);
        });

    const groupedMap = filtered.reduce((acc, s) => {
      const key = s.className ?? 'Unknown class';
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});

    return { sessions: filtered, grouped: groupedMap };
  }, [data?.sessions, search]);

  // ── Mutations ────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (sessionId) => api.delete(`/reports/session/${sessionId}`),
    onSuccess:  () => {
      toast.success('Report deleted');
      qc.invalidateQueries({ queryKey: ['all-sessions'] });
      setExpanded(null);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to delete report'),
  });

  // ── Handlers — wrapped in useCallback for stable refs ───────
  // The deps lists are tight on purpose. Most handlers depend on
  // nothing that changes, so they get fresh references essentially
  // never. The memoized rows never see prop changes from these.
  const handleToggleExpand = useCallback((id) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

  const handleAdjust = useCallback((sessionId, e) => {
    e.stopPropagation();
    navigate(`/lecturer/session/${sessionId}/roster`);
  }, [navigate]);

  const handleDelete = useCallback((session, e) => {
    e.stopPropagation();
    const dateStr = session.openAt
      ? format(new Date(session.openAt), 'dd MMM yyyy')
      : 'this session';

    const confirmed = confirm(
      `Delete the report for "${session.title || 'Attendance session'}" on ${dateStr}?\n\n` +
      `This will permanently remove all ${session.total ?? 0} attendance records for this session. This cannot be undone.`
    );
    if (confirmed) deleteMut.mutate(session.id);
  }, [deleteMut]);

  const exportFile = useCallback(async (sessionId, type, e) => {
    e.stopPropagation();
    setExporting(`${sessionId}-${type}`);
    try {
      const res = await api.get(`/reports/export/${type}?sessionId=${sessionId}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `attendance-${sessionId}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} downloaded`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  }, []);

  const exportAll = useCallback(async (classId, type) => {
    setExporting(`class-${classId}-${type}`);
    try {
      const res = await api.get(`/reports/export/${type}?classId=${classId}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `attendance-class-${classId}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} downloaded`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  }, []);

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Reports" subtitle="Loading…" />
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
        title="Reports"
        subtitle="All attendance records · sessions from deleted classes are preserved here · use Adjust to manually edit with a full audit trail"
      />

      {/* ── Search ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', maxWidth: '420px' }}>
        <Search size={14} style={{
          position:  'absolute',
          left:      '12px',
          top:       '50%',
          transform: 'translateY(-50%)',
          color:     'var(--text-muted)',
          pointerEvents: 'none',
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by class or session name…"
          className="input-base"
          style={{ paddingLeft: '36px' }}
        />
      </div>

      {/* ── Empty state / grouped cards ─────────────────────── */}
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
              <FileText size={28} style={{ color: 'var(--text-muted)' }} />
            </motion.div>

            <p style={{
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
            }}>
              {search ? 'No sessions match your search' : 'No sessions yet'}
            </p>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-sm)',
              marginTop: '6px',
            }}>
              {search
                ? 'Try a different search term or clear the field'
                : 'Open and close a session to see it appear here'}
            </p>
          </motion.div>
        ) : (
          <AnimatedList
            key="groups"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
          >
            {Object.entries(grouped).map(([className, classSessions]) => {
              const classId   = classSessions.find(s => s.classId)?.classId;
              const isDeleted = !classId;

              return (
                <AnimatedItem key={className} layout>
                  <ClassGroupCard
                    className={className}
                    classSessions={classSessions}
                    classId={classId}
                    isDeleted={isDeleted}
                    expanded={expanded}
                    onToggleExpand={handleToggleExpand}
                    onAdjust={handleAdjust}
                    onExportFile={exportFile}
                    onExportAll={exportAll}
                    onDelete={handleDelete}
                    exporting={exporting}
                    deletePending={deleteMut.isPending}
                  />
                </AnimatedItem>
              );
            })}
          </AnimatedList>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Class group card — memoized ───────────────────────────────
// Custom comparator: re-render only if anything that visibly
// affects this card changed. The `expanded` ID changes globally
// but only matters here if it transitioned in or out of one of
// THIS group's sessions.
const ClassGroupCard = memo(function ClassGroupCard({
  className, classSessions, classId, isDeleted,
  expanded, onToggleExpand,
  onAdjust, onExportFile, onExportAll, onDelete,
  exporting, deletePending,
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={SPRING.snappy}
      style={{
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-molecular)',
        overflow:     'hidden',
        boxShadow:    'var(--shadow-md)',
      }}
    >
      {/* ── Class header ────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        'var(--space-3)',
        borderBottom:   '1px solid var(--border)',
        background:     'var(--bg-raised)',
        flexWrap:       'wrap',
        gap:            'var(--space-2)',
        position:       'relative',
      }}>
        {isDeleted && (
          <div style={{
            position:      'absolute',
            top:           '-30px',
            left:          '-30px',
            width:         '120px',
            height:        '120px',
            background:    'var(--red-bg)',
            filter:        'blur(40px)',
            opacity:       0.5,
            pointerEvents: 'none',
          }} />
        )}

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
            background:     isDeleted ? 'var(--red-bg)' : 'var(--brand-subtle)',
            border:         `1px solid ${isDeleted ? 'var(--red-border)' : 'var(--brand-border)'}`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontFamily:     'var(--font-display)',
            fontWeight:     700,
            fontSize:       'var(--text-sm)',
            color:          isDeleted ? 'var(--red)' : 'var(--brand-text)',
            flexShrink:     0,
          }}>
            {className[0]?.toUpperCase()}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{
              display:    'flex',
              alignItems: 'center',
              gap:        '8px',
              flexWrap:   'wrap',
            }}>
              <p style={{
                color:      'var(--text-primary)',
                fontWeight: 600,
                fontSize:   'var(--text-md)',
                fontFamily: 'var(--font-display)',
              }}>
                {className}
              </p>
              {isDeleted && (
                <span style={{
                  color:         'var(--red)',
                  fontSize:      '10px',
                  fontWeight:    700,
                  background:    'var(--red-bg)',
                  border:        '1px solid var(--red-border)',
                  padding:       '2px 8px',
                  borderRadius:  'var(--radius-pill)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Class deleted
                </span>
              )}
            </div>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-xs)',
              marginTop: '2px',
            }}>
              {classSessions.length} session{classSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {!isDeleted && classId && (
          <div style={{
            position:   'relative',
            display:    'flex',
            gap:        '6px',
            flexShrink: 0,
          }}>
            {['csv', 'pdf'].map(type => {
              const isExporting = exporting === `class-${classId}-${type}`;
              return (
                <motion.button
                  key={type}
                  whileTap={TAP.button}
                  whileHover={!isExporting ? { y: -1 } : undefined}
                  transition={SPRING.snappy}
                  onClick={() => onExportAll(classId, type)}
                  disabled={!!exporting}
                  className="btn-ghost"
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding:  '8px 12px',
                    opacity:  isExporting ? 0.6 : 1,
                  }}
                >
                  <Download size={12} />
                  All {type.toUpperCase()}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sessions list ───────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {classSessions.map((session, idx) => (
          <SessionRow
            key={session.id}
            session={session}
            isLast={idx === classSessions.length - 1}
            isExpanded={expanded === session.id}
            isDeleted={isDeleted}
            onToggle={onToggleExpand}
            onAdjust={onAdjust}
            onExport={onExportFile}
            onDelete={onDelete}
            exporting={exporting}
            deletePending={deletePending}
          />
        ))}
      </div>
    </motion.div>
  );
}, (prev, next) => {
  // Re-render only if data, search, or this group's expansion changed
  if (prev.classSessions !== next.classSessions) return false;
  if (prev.exporting     !== next.exporting)     return false;
  if (prev.deletePending !== next.deletePending) return false;

  // Did the expanded session change INTO or OUT OF this group?
  const wasInGroup = prev.classSessions.some(s => s.id === prev.expanded);
  const isInGroup  = next.classSessions.some(s => s.id === next.expanded);
  if (wasInGroup || isInGroup) return false;

  return true;
});

// ─── Session row — memoized ────────────────────────────────────
// The expansion state is passed as a derived `isExpanded` boolean
// so changing the global expanded ID only re-renders the two rows
// whose isExpanded flipped (not all 50).
const SessionRow = memo(function SessionRow({
  session, isLast, isExpanded, isDeleted,
  onToggle, onAdjust, onExport, onDelete,
  exporting, deletePending,
}) {
  const isOpen = session.status === 'open';

  return (
    <div>
      <div
        onClick={() => onToggle(session.id)}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--space-3)',
          padding:      '10px var(--space-3)',
          cursor:       'pointer',
          borderBottom: !isLast || isExpanded ? '1px solid var(--border)' : 'none',
          flexWrap:     'wrap',
          transition:   `background ${DURATION.fast}ms ${EASE.state}`,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div
          className={isOpen ? 'live-dot' : ''}
          style={{
            width:        '8px',
            height:       '8px',
            borderRadius: 'var(--radius-pill)',
            flexShrink:   0,
            background:   isOpen ? 'var(--green)' : 'var(--text-muted)',
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color:        'var(--text-primary)',
            fontWeight:   600,
            fontSize:     'var(--text-sm)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {session.title || 'Attendance session'}
          </p>
          <p style={{
            color:     'var(--text-muted)',
            fontSize:  'var(--text-xs)',
            marginTop: '2px',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {session.openAt
                ? format(new Date(session.openAt), 'dd MMM yyyy, HH:mm')
                : '—'}
            </span>
            {' · '}
            <span style={{
              color:         isOpen ? 'var(--green)' : 'var(--text-muted)',
              textTransform: 'capitalize',
              fontWeight:    isOpen ? 600 : 400,
            }}>
              {session.status}
            </span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
          <CountBadge value={session.present ?? 0} label="P" color="var(--green)" />
          <CountBadge value={session.late    ?? 0} label="L" color="var(--amber)" />
          <CountBadge value={session.total   ?? 0} label="T" color="var(--text-secondary)" />
        </div>

        <div style={{
          display:    'flex',
          gap:        '4px',
          flexShrink: 0,
          flexWrap:   'wrap',
        }}>
          {!isDeleted && (
            <ActionButton
              onClick={(e) => onAdjust(session.id, e)}
              icon={Edit2}
              label="Adjust"
              title="Open roster — adjust attendance with audit trail"
              tone="brand"
            />
          )}
          <ActionButton
            onClick={(e) => onExport(session.id, 'csv', e)}
            icon={Download}
            label="CSV"
            title="Export as CSV"
            tone="neutral"
            disabled={exporting === `${session.id}-csv`}
            loading={exporting === `${session.id}-csv`}
          />
          <ActionButton
            onClick={(e) => onExport(session.id, 'pdf', e)}
            icon={Download}
            label="PDF"
            title="Export as PDF"
            tone="neutral"
            disabled={exporting === `${session.id}-pdf`}
            loading={exporting === `${session.id}-pdf`}
          />
          <ActionButton
            onClick={(e) => onDelete(session, e)}
            icon={Trash2}
            label="Delete"
            title="Delete this session report"
            tone="danger"
            disabled={deletePending}
          />
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={SPRING.snappy}
          style={{
            color:      'var(--text-muted)',
            flexShrink: 0,
            display:    'flex',
          }}
        >
          <ChevronDown size={16} />
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ duration: DURATION.medium, ease: EASE.state }}
            style={{ overflow: 'hidden' }}
          >
            <SessionDetail sessionId={session.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}, (prev, next) => {
  // Re-render this row only if its session, its expansion state,
  // its export state, or its delete-pending state changed.
  return prev.session       === next.session
      && prev.isExpanded    === next.isExpanded
      && prev.isLast        === next.isLast
      && prev.isDeleted     === next.isDeleted
      && prev.exporting     === next.exporting
      && prev.deletePending === next.deletePending;
});

// ─── Count badge ───────────────────────────────────────────────
const CountBadge = memo(function CountBadge({ value, label, color }) {
  return (
    <div style={{
      textAlign:  'center',
      minWidth:   '28px',
    }}>
      <p style={{
        color,
        fontWeight: 700,
        fontSize:   'var(--text-md)',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.1,
      }}>
        {value}
      </p>
      <p style={{
        color:         'var(--text-muted)',
        fontSize:      '9px',
        fontWeight:    700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginTop:     '1px',
      }}>
        {label}
      </p>
    </div>
  );
});

// ─── Action button ─────────────────────────────────────────────
const ActionButton = memo(function ActionButton({
  onClick, icon: Icon, label, title, tone, disabled, loading,
}) {
  const styles = {
    brand: {
      bg:          'var(--brand-subtle)',
      border:      'var(--brand-border)',
      color:       'var(--brand-text)',
      hoverBg:     'var(--brand)',
      hoverColor:  '#fff',
    },
    neutral: {
      bg:          'var(--bg-raised)',
      border:      'var(--border)',
      color:       'var(--text-muted)',
      hoverBg:     'var(--bg-hover)',
      hoverColor:  'var(--text-primary)',
    },
    danger: {
      bg:          'var(--red-bg)',
      border:      'var(--red-border)',
      color:       'var(--red)',
      hoverBg:     'rgba(239,68,68,0.16)',
      hoverColor:  'var(--red)',
    },
  }[tone];

  return (
    <motion.button
      whileTap={TAP.button}
      whileHover={!disabled ? { y: -1 } : undefined}
      transition={SPRING.snappy}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '4px',
        padding:       '6px 10px',
        background:    styles.bg,
        border:        `1px solid ${styles.border}`,
        color:         styles.color,
        borderRadius:  'var(--radius-atomic)',
        fontSize:      '10px',
        fontWeight:    700,
        cursor:        disabled ? 'not-allowed' : 'pointer',
        opacity:       disabled && !loading ? 0.5 : 1,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontFamily:    'var(--font-body)',
        transition:    `all ${DURATION.base}ms ${EASE.state}`,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.background = styles.hoverBg;
        e.currentTarget.style.color      = styles.hoverColor;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = styles.bg;
        e.currentTarget.style.color      = styles.color;
      }}
    >
      {loading ? (
        <span style={{
          width:          '10px',
          height:         '10px',
          border:         '1.5px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius:   'var(--radius-pill)',
          animation:      'spin 0.8s linear infinite',
        }} />
      ) : (
        <Icon size={10} />
      )}
      {label}
    </motion.button>
  );
});

// ─── Session detail — has its own query, naturally isolated ───
function SessionDetail({ sessionId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['session-attendance-detail', sessionId],
    queryFn:  () => api.get(`/sessions/${sessionId}/attendance`).then(r => r.data),
  });

  const records = data?.records ?? [];

  if (isLoading) return (
    <div style={{
      padding:      'var(--space-3)',
      textAlign:    'center',
      color:        'var(--text-muted)',
      fontSize:     'var(--text-sm)',
      borderBottom: '1px solid var(--border)',
      background:   'var(--bg-raised)',
    }}>
      Loading records…
    </div>
  );

  if (records.length === 0) return (
    <div style={{
      padding:      'var(--space-3)',
      textAlign:    'center',
      color:        'var(--text-muted)',
      fontSize:     'var(--text-sm)',
      borderBottom: '1px solid var(--border)',
      background:   'var(--bg-raised)',
    }}>
      No attendance records for this session
    </div>
  );

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'auto 1fr 1fr auto auto',
        gap:                 'var(--space-2)',
        padding:             '10px var(--space-3)',
        background:          'var(--bg-raised)',
        borderBottom:        '1px solid var(--border)',
      }}>
        {['#', 'Student', 'Email', 'Time', 'Status'].map(h => (
          <p key={h} style={{
            color:         'var(--text-muted)',
            fontSize:      '10px',
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {h}
          </p>
        ))}
      </div>

      {records.map((r, idx) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            ...SPRING.snappy,
            delay: Math.min(idx * 0.02, 0.25),
          }}
          style={{
            display:             'grid',
            gridTemplateColumns: 'auto 1fr 1fr auto auto',
            gap:                 'var(--space-2)',
            padding:             '10px var(--space-3)',
            alignItems:          'center',
            borderBottom:        idx < records.length - 1
              ? '1px solid var(--border)' : 'none',
          }}
        >
          <p style={{
            color:      'var(--text-muted)',
            fontSize:   'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            minWidth:   '24px',
            fontWeight: 500,
          }}>
            {idx + 1}
          </p>

          <div style={{ minWidth: 0 }}>
            <p style={{
              color:      'var(--text-primary)',
              fontSize:   'var(--text-xs)',
              fontWeight: 600,
            }}>
              {r.studentName ?? '—'}
            </p>
            {r.studentId_display && (
              <p style={{
                color:         'var(--brand-text)',
                fontSize:      '10px',
                fontFamily:    'var(--font-mono)',
                letterSpacing: '0.04em',
                fontWeight:    500,
              }}>
                {r.studentId_display}
              </p>
            )}
          </div>

          <p style={{
            color:        'var(--text-muted)',
            fontSize:     'var(--text-xs)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {r.studentEmail ?? '—'}
          </p>

          <p style={{
            color:      'var(--text-muted)',
            fontSize:   'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
          }}>
            {r.marked_at ? format(new Date(r.marked_at), 'HH:mm:ss') : '—'}
          </p>

          <StatusPill status={r.status} showSweep={false} size="sm" />
        </motion.div>
      ))}
    </div>
  );
}