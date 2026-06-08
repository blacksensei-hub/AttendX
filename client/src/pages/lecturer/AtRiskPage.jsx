import { useState }                                  from 'react';
import { useQuery }                                  from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  AlertTriangle, Mail, ChevronDown,
  Settings, CheckCircle, X, FileText, PenLine,
}                                                    from 'lucide-react';
import toast                                         from 'react-hot-toast';

import api                                           from '../../services/api';
import PageShell, { PageHeader }                     from '../../components/layout/PageShell';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AtRiskPage — students below their class attendance threshold.
 *
 * Grouped per class. Each class card:
 *   • Shows how many students are at risk and the current threshold
 *   • Lets the lecturer edit the threshold inline
 *   • Lets the lecturer email all at-risk students — choosing between
 *     the standard template or a personal message they write
 *   • Expands to show each student's rate with a colour-coded pill
 * ═════════════════════════════════════════════════════════════════
 */
export default function AtRiskPage() {
  const [expanded,       setExpanded]       = useState(null);
  const [sending,        setSending]        = useState(null);
  const [editThreshold,  setEditThreshold]  = useState(null);
  const [newThreshold,   setNewThreshold]   = useState('');
  const [emailFor,       setEmailFor]       = useState(null); // class the email modal is open for

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['at-risk-students'],
    queryFn:  () => api.get('/thresholds/at-risk').then(r => r.data),
  });

  const classes     = data?.classes     ?? [];
  const totalAtRisk = data?.totalAtRisk ?? 0;

  // ── Send warnings to all at-risk students in a class ────────
  // customMessage is optional — when blank the backend uses the template.
  const sendWarnings = async (classId, customMessage) => {
    setSending(classId);
    try {
      const body = { classId };
      if (customMessage) body.customMessage = customMessage;
      const { data } = await api.post('/thresholds/send-warnings', body);
      toast.success(data.message ?? 'Warnings sent');
      setEmailFor(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send warnings');
    } finally {
      setSending(null);
    }
  };

  // ── Update class attendance threshold ───────────────────────
  const updateThreshold = async (classId) => {
    const val = parseInt(newThreshold);
    if (!val || val < 1 || val > 100) {
      toast.error('Threshold must be between 1 and 100');
      return;
    }
    try {
      await api.put(`/thresholds/class/${classId}`, { threshold: val });
      toast.success('Threshold updated');
      setEditThreshold(null);
      setNewThreshold('');
      refetch();
    } catch {
      toast.error('Failed to update threshold');
    }
  };

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Attendance Alerts" subtitle="Loading…" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="shimmer"
              style={{
                height:       '120px',
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
        title="Attendance Alerts"
        subtitle={
          totalAtRisk > 0
            ? `${totalAtRisk} student${totalAtRisk !== 1 ? 's are' : ' is'} below their class attendance threshold`
            : 'All students are meeting their attendance requirements'
        }
      />

      {/* ── All-clear state ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {classes.length === 0 ? (
          <motion.div
            key="all-clear"
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
              border:         '1px solid var(--green-border)',
              borderRadius:   'var(--radius-molecular)',
              textAlign:      'center',
              position:       'relative',
              overflow:       'hidden',
            }}
          >
            {/* Subtle success glow */}
            <div style={{
              position:      'absolute',
              inset:         0,
              background:    'radial-gradient(ellipse 60% 80% at center, var(--green-bg) 0%, transparent 60%)',
              pointerEvents: 'none',
              opacity:       0.7,
            }} />

            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: DURATION.slow,
                ease:     EASE.bounce,
                delay:    0.1,
              }}
              style={{
                position:       'relative',
                width:          '64px',
                height:         '64px',
                borderRadius:   'var(--radius-molecular)',
                background:     'var(--green-bg)',
                border:         '1px solid var(--green-border)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                marginBottom:   'var(--space-3)',
              }}
            >
              <CheckCircle size={28} style={{ color: 'var(--green)' }} />
            </motion.div>

            <p style={{
              position:   'relative',
              color:      'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize:   'var(--text-md)',
            }}>
              All clear
            </p>
            <p style={{
              position:   'relative',
              color:      'var(--text-muted)',
              fontSize:   'var(--text-sm)',
              marginTop:  '6px',
              maxWidth:   '320px',
            }}>
              Every enrolled student is meeting their class attendance threshold.
            </p>
          </motion.div>
        ) : (
          /* ── Per-class cards ──────────────────────────────── */
          <AnimatedList
            key="classes"
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
          >
            {classes.map(cls => (
              <AnimatedItem key={cls.classId} layout>
                <ClassRiskCard
                  cls={cls}
                  expanded={expanded === cls.classId}
                  onToggle={() =>
                    setExpanded(expanded === cls.classId ? null : cls.classId)
                  }
                  editing={editThreshold === cls.classId}
                  newThreshold={newThreshold}
                  onStartEdit={() => {
                    setEditThreshold(cls.classId);
                    setNewThreshold(String(cls.threshold));
                  }}
                  onCancelEdit={() => {
                    setEditThreshold(null);
                    setNewThreshold('');
                  }}
                  onThresholdChange={setNewThreshold}
                  onSaveThreshold={() => updateThreshold(cls.classId)}
                  onRequestEmail={() => setEmailFor(cls)}
                />
              </AnimatedItem>
            ))}
          </AnimatedList>
        )}
      </AnimatePresence>

      {/* ── Email choice modal ──────────────────────────────── */}
      <AnimatePresence>
        {emailFor && (
          <EmailWarningModal
            cls={emailFor}
            sending={sending === emailFor.classId}
            onClose={() => setEmailFor(null)}
            onSend={(customMessage) => sendWarnings(emailFor.classId, customMessage)}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Email choice modal ───────────────────────────────────────
function EmailWarningModal({ cls, sending, onClose, onSend }) {
  const [mode, setMode]       = useState('template'); // 'template' | 'custom'
  const [message, setMessage] = useState('');

  const count   = cls.students.length;
  const canSend = mode === 'template' || message.trim().length > 0;

  const handleSend = () => {
    if (!canSend || sending) return;
    onSend(mode === 'custom' ? message.trim() : null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: DURATION.fast }}
      onClick={e => { if (e.target === e.currentTarget && !sending) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-3)',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.92, opacity: 0, y: 16 }}
        transition={SPRING.gentle}
        style={{
          background: 'var(--bg-card)', borderRadius: 'var(--radius-organism)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: '100%', maxWidth: 480, overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--red-bg)', border: '1px solid var(--red-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Mail size={18} color="var(--red)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Email at-risk students</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.className}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={sending}
            style={{ background: 'none', border: 'none', cursor: sending ? 'default' : 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', opacity: sending ? 0.4 : 1 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{count}</strong> student{count !== 1 ? 's' : ''} below the {cls.threshold}% threshold will receive this email.
          </p>

          {/* Two option cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <OptionCard
              selected={mode === 'template'}
              icon={FileText}
              title="Standard template"
              desc="The default warning email"
              onClick={() => setMode('template')}
            />
            <OptionCard
              selected={mode === 'custom'}
              icon={PenLine}
              title="Personal message"
              desc="Write your own note"
              onClick={() => setMode('custom')}
            />
          </div>

          {/* Textarea — only when writing a personal message */}
          <AnimatePresence initial={false}>
            {mode === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{    opacity: 0, height: 0 }}
                transition={{ duration: DURATION.medium, ease: EASE.state }}
                style={{ overflow: 'hidden' }}
              >
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={1000}
                  rows={5}
                  autoFocus
                  placeholder="Write a message to your at-risk students — e.g. encourage them to attend, mention office hours, or how to catch up…"
                  style={{
                    width:        '100%',
                    resize:       'vertical',
                    minHeight:    '110px',
                    padding:      '12px 14px',
                    background:   'var(--bg-raised)',
                    border:       '1px solid var(--border)',
                    borderRadius: 'var(--radius-atomic)',
                    color:        'var(--text-primary)',
                    fontSize:     'var(--text-sm)',
                    fontFamily:   'var(--font-body)',
                    lineHeight:   1.6,
                    boxSizing:    'border-box',
                  }}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>The attendance stats are still added automatically.</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{message.length}/1000</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <motion.button
              whileTap={TAP.button}
              type="button"
              onClick={onClose}
              disabled={sending}
              className="btn-ghost"
              style={{ flex: 1, opacity: sending ? 0.6 : 1 }}
            >
              Cancel
            </motion.button>
            <motion.button
              whileTap={TAP.button}
              whileHover={canSend && !sending ? { y: -1 } : undefined}
              transition={SPRING.snappy}
              type="button"
              onClick={handleSend}
              disabled={!canSend || sending}
              className="btn-danger"
              style={{ flex: 2, opacity: (!canSend || sending) ? 0.6 : 1 }}
            >
              <Mail size={15} />
              {sending ? 'Sending…' : `Send to ${count}`}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Selectable option card (template vs personal) ────────────
function OptionCard({ selected, icon: Icon, title, desc, onClick }) {
  return (
    <motion.button
      type="button"
      whileTap={TAP.button}
      whileHover={!selected ? { y: -1 } : undefined}
      transition={SPRING.snappy}
      onClick={onClick}
      animate={{
        borderColor:     selected ? 'var(--brand)'        : 'var(--border)',
        backgroundColor: selected ? 'var(--brand-subtle)' : 'var(--bg-raised)',
      }}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-start',
        gap:           8,
        padding:       12,
        borderRadius:  'var(--radius-atomic)',
        border:        '1px solid',
        cursor:        'pointer',
        textAlign:     'left',
        fontFamily:    'var(--font-body)',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 'var(--radius-atomic)',
        background: selected ? 'var(--brand)' : 'var(--bg-card)',
        border: `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} style={{ color: selected ? '#fff' : 'var(--text-muted)' }} />
      </div>
      <div>
        <p style={{ color: selected ? 'var(--brand-text)' : 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: 2 }}>
          {title}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.4 }}>
          {desc}
        </p>
      </div>
    </motion.button>
  );
}

// ─── Class risk card ──────────────────────────────────────────
function ClassRiskCard({
  cls, expanded, onToggle,
  editing, newThreshold, onStartEdit, onCancelEdit,
  onThresholdChange, onSaveThreshold,
  onRequestEmail,
}) {
  return (
    <motion.div
      whileHover={!expanded ? { y: -2 } : undefined}
      transition={SPRING.snappy}
      style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--red-border)',
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
        flexWrap:       'wrap',
        gap:            'var(--space-2)',
        padding:        'var(--space-3)',
        borderBottom:   expanded ? '1px solid var(--border)' : 'none',
        background:     'var(--bg-raised)',
        position:       'relative',
      }}>
        {/* Subtle red glow corner */}
        <div style={{
          position:      'absolute',
          top:           '-40px',
          left:          '-40px',
          width:         '160px',
          height:        '160px',
          background:    'var(--red-bg)',
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
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{
              duration:     2.5,
              ease:         EASE.state,
              repeat:       Infinity,
              repeatDelay:  0.5,
            }}
            style={{
              width:          '40px',
              height:         '40px',
              borderRadius:   'var(--radius-atomic)',
              background:     'var(--red-bg)',
              border:         '1px solid var(--red-border)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}
          >
            <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
          </motion.div>

          <div style={{ minWidth: 0 }}>
            <p style={{
              color:        'var(--text-primary)',
              fontWeight:   600,
              fontFamily:   'var(--font-display)',
              fontSize:     'var(--text-sm)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
              {cls.className}
            </p>
            <p style={{
              color:     'var(--text-muted)',
              fontSize:  'var(--text-xs)',
              marginTop: '2px',
            }}>
              {cls.students.length} student{cls.students.length !== 1 ? 's' : ''} below {cls.threshold}% threshold
            </p>
          </div>
        </div>

        <div style={{
          position:   'relative',
          display:    'flex',
          gap:        '6px',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          {/* Threshold edit — inline form or button */}
          <AnimatePresence mode="wait" initial={false}>
            {editing ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{    opacity: 0, scale: 0.95 }}
                transition={SPRING.snappy}
                style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
              >
                <input
                  type="number"
                  value={newThreshold}
                  onChange={e => onThresholdChange(e.target.value)}
                  placeholder={cls.threshold}
                  min="1"
                  max="100"
                  autoFocus
                  style={{
                    width:        '72px',
                    padding:      '6px 10px',
                    background:   'var(--bg-card)',
                    border:       '1px solid var(--border)',
                    borderRadius: 'var(--radius-atomic)',
                    color:        'var(--text-primary)',
                    fontSize:     'var(--text-xs)',
                    fontFamily:   'var(--font-mono)',
                    textAlign:    'center',
                    fontWeight:   600,
                  }}
                />
                <motion.button
                  whileTap={TAP.button}
                  onClick={onSaveThreshold}
                  className="btn-primary"
                  style={{ padding: '6px 10px', fontSize: 'var(--text-xs)' }}
                >
                  Save
                </motion.button>
                <motion.button
                  whileTap={TAP.button}
                  onClick={onCancelEdit}
                  className="btn-ghost"
                  style={{ padding: '6px 10px', fontSize: 'var(--text-xs)' }}
                >
                  Cancel
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                key="button"
                whileTap={TAP.button}
                whileHover={{ y: -1 }}
                transition={SPRING.snappy}
                onClick={onStartEdit}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '6px',
                  padding:      '8px 12px',
                  background:   'var(--bg-raised)',
                  border:       '1px solid var(--border)',
                  color:        'var(--text-muted)',
                  borderRadius: 'var(--radius-atomic)',
                  fontSize:     'var(--text-xs)',
                  cursor:       'pointer',
                  fontFamily:   'var(--font-body)',
                  fontWeight:   500,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.color       = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color       = 'var(--text-muted)';
                }}
              >
                <Settings size={12} />
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                }}>
                  {cls.threshold}%
                </span>
                threshold
              </motion.button>
            )}
          </AnimatePresence>

          {/* Email all button — opens the choice modal */}
          <motion.button
            whileTap={TAP.button}
            whileHover={{ y: -1 }}
            transition={SPRING.snappy}
            onClick={onRequestEmail}
            className="btn-danger"
            style={{
              padding:  '8px 12px',
              fontSize: 'var(--text-xs)',
            }}
          >
            <Mail size={13} />
            Email all
          </motion.button>

          {/* Expand toggle */}
          <motion.button
            whileTap={TAP.button}
            onClick={onToggle}
            style={{
              background:   'none',
              border:       'none',
              cursor:       'pointer',
              color:        'var(--text-muted)',
              padding:      '6px',
              display:      'flex',
              alignItems:   'center',
              borderRadius: 'var(--radius-atomic)',
            }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={SPRING.snappy}
              style={{ display: 'flex' }}
            >
              <ChevronDown size={16} />
            </motion.span>
          </motion.button>
        </div>
      </div>

      {/* ── Expandable student list ─────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ duration: DURATION.medium, ease: EASE.state }}
            style={{ overflow: 'hidden' }}
          >
            {/* Column headers */}
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'auto 1fr auto auto',
              gap:                 'var(--space-3)',
              padding:             '10px var(--space-3)',
              background:          'var(--bg-raised)',
              borderBottom:        '1px solid var(--border)',
            }}>
              {['#', 'Student', 'Rate', 'Sessions'].map((h, i) => (
                <p key={h} style={{
                  color:         'var(--text-muted)',
                  fontSize:      '10px',
                  fontWeight:    600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  textAlign:     i >= 2 ? 'right' : 'left',
                }}>
                  {h}
                </p>
              ))}
            </div>

            {/* Student rows */}
            {cls.students.map((student, idx) => (
              <StudentRiskRow
                key={student.studentId}
                student={student}
                index={idx}
                threshold={cls.threshold}
                isLast={idx === cls.students.length - 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Student risk row ──────────────────────────────────────────
function StudentRiskRow({ student, index, threshold, isLast }) {
  // Three-tier colour logic:
  //   above threshold          → green (shouldn't hit this page but safe fallback)
  //   within 10% of threshold  → amber warning
  //   below that               → red danger
  const diff  = student.attendanceRate - threshold;
  const color = diff >= 0 ? 'var(--green)'
             : diff >= -10 ? 'var(--amber)'
             : 'var(--red)';
  const bg    = diff >= 0 ? 'var(--green-bg)'
             : diff >= -10 ? 'var(--amber-bg)'
             : 'var(--red-bg)';
  const borderColor = diff >= 0 ? 'var(--green-border)'
             : diff >= -10 ? 'var(--amber-border)'
             : 'var(--red-border)';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        ...SPRING.snappy,
        delay: Math.min(index * 0.03, 0.3),
      }}
      style={{
        display:             'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        gap:                 'var(--space-3)',
        padding:             '10px var(--space-3)',
        alignItems:          'center',
        borderBottom:        isLast ? 'none' : '1px solid var(--border)',
      }}
    >
      {/* Row number */}
      <p style={{
        color:      'var(--text-muted)',
        fontSize:   'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        minWidth:   '24px',
        fontWeight: 500,
      }}>
        {index + 1}
      </p>

      {/* Student info */}
      <div style={{ minWidth: 0 }}>
        <p style={{
          color:        'var(--text-primary)',
          fontWeight:   600,
          fontSize:     'var(--text-sm)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {student.studentName}
        </p>
        {student.studentIdDisplay && (
          <p style={{
            color:         'var(--brand-text)',
            fontSize:      '10px',
            fontFamily:    'var(--font-mono)',
            fontWeight:    600,
            letterSpacing: '0.04em',
            marginTop:     '1px',
          }}>
            {student.studentIdDisplay}
          </p>
        )}
        <p style={{
          color:        'var(--text-muted)',
          fontSize:     'var(--text-xs)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          marginTop:    '1px',
        }}>
          {student.studentEmail}
        </p>
      </div>

      {/* Rate badge */}
      <span style={{
        padding:      '4px 12px',
        borderRadius: 'var(--radius-pill)',
        fontSize:     'var(--text-sm)',
        fontWeight:   700,
        background:   bg,
        color,
        border:       `1px solid ${borderColor}`,
        fontFamily:   'var(--font-mono)',
        minWidth:     '60px',
        textAlign:    'center',
      }}>
        {student.attendanceRate}%
      </span>

      {/* Sessions attended */}
      <p style={{
        color:      'var(--text-muted)',
        fontSize:   'var(--text-xs)',
        textAlign:  'right',
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap',
        fontWeight: 500,
      }}>
        {student.attended}/{student.totalSessions}
      </p>
    </motion.div>
  );
}