// client/src/pages/lecturer/SessionRosterPage.jsx
import { useState }                                  from 'react';
import { useParams, useNavigate }                    from 'react-router-dom';
import { useQuery }                                  from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import { format }                                    from 'date-fns';
import { ArrowLeft, Edit2, History, ArrowRight }     from 'lucide-react';

import api                                           from '../../services/api';
import AdjustmentModal                               from '../../components/sessions/AdjustmentModal';
import PageShell                                     from '../../components/layout/PageShell';
import StatusPill                                    from '../../components/ui/StatusPill';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import { useIsMobile }                               from '../../hooks/useIsMobile';
import { SPRING, TAP, EASE, DURATION }               from '../../lib/motion';

export default function SessionRosterPage() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const isMobile      = useIsMobile();
  const [adjusting, setAdjusting] = useState(null);
  const [showAudit, setShowAudit] = useState(false);

  const { data: rosterData, isLoading, refetch } = useQuery({
    queryKey: ['session-roster', sessionId],
    queryFn:  () => api.get(`/adjustments/${sessionId}/roster`).then(r => r.data),
  });

  const roster  = rosterData?.roster  ?? [];
  const session = rosterData?.session ?? {};

  const present = roster.filter(r => r.status === 'present').length;
  const late    = roster.filter(r => r.status === 'late').length;
  const absent  = roster.filter(r => r.status === 'absent').length;

  const { data: auditData, refetch: refetchAudit } = useQuery({
    queryKey: ['session-audit', sessionId],
    queryFn:  () => api.get(`/adjustments/${sessionId}/audit`).then(r => r.data),
    enabled:  showAudit,
  });
  const trail = auditData?.trail ?? [];

  const handleSuccess = () => {
    refetch();
    if (showAudit) refetchAudit();
  };

  return (
    <PageShell gap="var(--space-4)">

      {/* Back link */}
      <motion.button
        whileTap={TAP.button} whileHover={{ x: -2 }} transition={SPRING.snappy}
        onClick={() => navigate('/lecturer/reports')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: 0, alignSelf: 'flex-start', fontFamily: 'var(--font-body)' }}
      >
        <ArrowLeft size={14} />
        Back to reports
      </motion.button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 'var(--text-lg)' : 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {session.className ?? '…'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
            {session.title || 'Attendance session'}
            {session.openAt ? ` · ${format(new Date(session.openAt), 'dd MMM yyyy, HH:mm')}` : ''}
          </p>
        </div>

        {/* Audit trail toggle */}
        <motion.button
          whileTap={TAP.button} whileHover={{ y: -1 }} transition={SPRING.snappy}
          onClick={() => setShowAudit(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 12px',
            background: showAudit ? 'var(--brand-subtle)' : 'var(--bg-raised)',
            border: `1px solid ${showAudit ? 'var(--brand-border)' : 'var(--border)'}`,
            color: showAudit ? 'var(--brand-text)' : 'var(--text-muted)',
            borderRadius: 'var(--radius-atomic)', fontSize: 'var(--text-sm)',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
            transition: `all ${DURATION.base}ms ${EASE.state}`,
          }}
        >
          <History size={14} />
          {!isMobile && 'Audit trail'}
          {trail.length > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.bounce}
              style={{ background: 'var(--brand)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: 700, padding: '1px 7px', minWidth: '18px', textAlign: 'center' }}
            >
              {trail.length}
            </motion.span>
          )}
        </motion.button>
      </div>

      {/* Summary stats */}
      <AnimatedList style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <StatBlock label="Present" count={present} color="var(--green)" bg="var(--green-bg)" border="var(--green-border)" />
        <StatBlock label="Late"    count={late}    color="var(--amber)" bg="var(--amber-bg)" border="var(--amber-border)" />
        <StatBlock label="Absent"  count={absent}  color="var(--red)"   bg="var(--red-bg)"   border="var(--red-border)"   />
      </AnimatedList>

      {/* Audit trail */}
      <AnimatePresence initial={false}>
        {showAudit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.medium, ease: EASE.state }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-molecular)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)', background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={14} style={{ color: 'var(--brand-text)' }} />
                <p style={{ color: 'var(--brand-text)', fontWeight: 600, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-display)' }}>
                  Manual adjustment history
                </p>
              </div>
              {trail.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  No manual adjustments have been made for this session
                </div>
              ) : (
                trail.map((entry, i) => <AuditEntry key={entry.id} entry={entry} isLast={i === trail.length - 1} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeletons */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: '64px', borderRadius: 'var(--radius-atomic)' }} />
          ))}
        </div>
      )}

      {/* Roster */}
      {!isLoading && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>

          {/* Column headers — desktop only */}
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 'var(--space-3)', padding: '10px var(--space-3)', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
              {['Student', 'Marked at', 'Status', ''].map((h, i) => (
                <p key={i} style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i > 0 && i < 3 ? 'right' : 'left' }}>
                  {h}
                </p>
              ))}
            </div>
          )}

          {/* Mobile header */}
          {isMobile && (
            <div style={{ padding: '10px var(--space-3)', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {roster.length} student{roster.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {roster.map((row, i) => (
              <RosterRow
                key={row.studentId}
                row={row}
                isLast={i === roster.length - 1}
                isMobile={isMobile}
                onEdit={() => setAdjusting(row)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Adjustment modal */}
      <AnimatePresence>
        {adjusting && (
          <AdjustmentModal
            student={adjusting}
            sessionId={sessionId}
            onClose={() => setAdjusting(null)}
            onSuccess={handleSuccess}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Summary stat block ────────────────────────────────────────
function StatBlock({ label, count, color, bg, border }) {
  return (
    <AnimatedItem whileHover={{ y: -2 }} transition={SPRING.snappy}>
      <div style={{ position: 'relative', background: 'var(--bg-card)', border: `1px solid ${border}`, borderRadius: 'var(--radius-molecular)', padding: 'var(--space-3)', textAlign: 'center', overflow: 'hidden', height: '100%' }}>
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '100px', height: '100px', background: bg, filter: 'blur(35px)', opacity: 0.7, pointerEvents: 'none' }} />
        <AnimatePresence mode="wait">
          <motion.p
            key={count}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{    opacity: 0, y: -6, scale: 0.9 }}
            transition={SPRING.bounce}
            style={{ position: 'relative', color, fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, lineHeight: 1.1 }}
          >
            {count}
          </motion.p>
        </AnimatePresence>
        <p style={{ position: 'relative', color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          {label}
        </p>
      </div>
    </AnimatedItem>
  );
}

// ─── Audit entry ───────────────────────────────────────────────
function AuditEntry({ entry, isLast }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={SPRING.snappy}
      style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: isLast ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <StatusPill status={entry.oldStatus} showSweep={false} size="sm" />
        <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
        <StatusPill status={entry.newStatus} showSweep={false} size="sm" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
          {entry.student?.name}
          {entry.student?.studentId && (
            <span style={{ marginLeft: '6px', color: 'var(--brand-text)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
              · {entry.student.studentId}
            </span>
          )}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', marginTop: '4px', lineHeight: 1.6, fontStyle: 'italic' }}>
          "{entry.reason}"
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
          By {entry.adjustedBy?.name}{' · '}
          {entry.adjustedAt ? format(new Date(entry.adjustedAt), 'dd MMM yyyy, HH:mm') : '—'}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Roster row ────────────────────────────────────────────────
function RosterRow({ row, isLast, isMobile, onEdit }) {
  if (isMobile) {
    // Card layout on mobile — all info visible without squishing
    return (
      <motion.div
        layout
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: DURATION.base, ease: EASE.state }}
        style={{ padding: '12px var(--space-3)', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
      >
        {/* Top row: name + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.studentName}
              </p>
              {row.wasAdjusted && (
                <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber-border)', borderRadius: 'var(--radius-pill)', fontSize: '9px', fontWeight: 700, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                  Edited
                </span>
              )}
            </div>
            {row.studentIdDisplay && (
              <p style={{ color: 'var(--brand-text)', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '1px' }}>
                {row.studentIdDisplay}
              </p>
            )}
          </div>
          <StatusPill status={row.status} showSweep={false} />
        </div>

        {/* Bottom row: time + edit button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
            {row.markedAt ? format(new Date(row.markedAt), 'HH:mm:ss') : 'Not marked'}
          </p>
          <motion.button
            whileTap={TAP.button}
            onClick={onEdit}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius-atomic)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >
            <Edit2 size={11} />
            Edit
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Desktop: original grid layout
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE.state }}
      style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 'var(--space-3)', padding: '10px var(--space-3)', alignItems: 'center', borderBottom: isLast ? 'none' : '1px solid var(--border)', transition: `background ${DURATION.fast}ms ${EASE.state}` }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            {row.studentName}
          </p>
          {row.wasAdjusted && (
            <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber-border)', borderRadius: 'var(--radius-pill)', fontSize: '9px', fontWeight: 700, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Edited
            </span>
          )}
        </div>
        {row.studentIdDisplay && (
          <p style={{ color: 'var(--brand-text)', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.04em', marginTop: '1px' }}>
            {row.studentIdDisplay}
          </p>
        )}
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.studentEmail}
        </p>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {row.markedAt ? format(new Date(row.markedAt), 'HH:mm:ss') : '—'}
      </p>

      <StatusPill status={row.status} showSweep={false} />

      <motion.button
        whileTap={TAP.button} whileHover={{ y: -1 }} transition={SPRING.snappy}
        onClick={onEdit}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius-atomic)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', transition: `all ${DURATION.base}ms ${EASE.state}` }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-text)'; e.currentTarget.style.borderColor = 'var(--brand-border)'; e.currentTarget.style.background = 'var(--brand-subtle)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-raised)'; }}
      >
        <Edit2 size={12} />
        Edit
      </motion.button>
    </motion.div>
  );
}