import { useState, memo }              from 'react';
import { useNavigate }                 from 'react-router-dom';
import { motion, AnimatePresence }     from 'framer-motion';
import {
  Users, MapPin, Copy, Trash2, Radio, CalendarClock, X, Check, ArrowUpRight, LocateOff,
}                                       from 'lucide-react';
import { useQueryClient }               from '@tanstack/react-query';

import OpenSessionModal                 from '../sessions/OpenSessionModal';
import ScheduleManager                  from './ScheduleManager';
import StatusPill                       from '../ui/StatusPill';
import { ConfirmDialog }                from '../console/overlays';
import { ROLE_LABEL }                   from '../../services/teachingService';
import {
  EASE, DURATION, SPRING, TAP,
  overlayBackdrop, overlayContent,
}                                       from '../../lib/motion';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * ═════════════════════════════════════════════════════════════════
 * ClassCard — one class in the lecturer's grid.
 *
 * The whole card opens the class page (register, students, staff,
 * grades). The buttons follow the lecturer's role on the class:
 * everyone on it can open a session, the owner and co-lecturers edit
 * the weekly schedule, and only the owner can delete it, after a
 * confirmation. A class shared with you says so, and whose it is.
 *
 * Memoized on `cls` so a grid of classes doesn't re-render as one.
 * ═════════════════════════════════════════════════════════════════
 */
function ClassCard({ cls, onDelete }) {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [showOpenSession, setShowOpenSession] = useState(false);
  const [showSchedule,    setShowSchedule]    = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const [codeCopied,      setCodeCopied]      = useState(false);

  const role             = cls.myRole ?? 'owner';
  const canEdit          = role !== 'ta';
  const isOwner          = role === 'owner';
  const hasActiveSession = !!cls.activeSession;
  const hasGeofence      = !!(cls.geo_lat && cls.geo_lng);

  const activeSchedules = (cls.schedules ?? []).filter(s => s.is_active)
    .sort((a, b) => ((a.day_of_week + 6) % 7) - ((b.day_of_week + 6) % 7) || a.start_time.localeCompare(b.start_time));
  const slotLabels = activeSchedules.slice(0, 2).map(s => `${DAY_NAMES[s.day_of_week]} ${s.start_time?.substring(0, 5)}`);
  const extraCount = activeSchedules.length - slotLabels.length;

  const copyCode = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(cls.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };
  const open = () => navigate(`/lecturer/classes/${cls.id}`);

  return (
    <>
      <motion.article
        layoutId={`class-morph-${cls.id}`}
        whileHover={{ y: -2, transition: SPRING.snappy }}
        transition={SPRING.gentle}
        onClick={open}
        onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) open(); }}
        tabIndex={0}
        aria-label={`${cls.name}, ${cls.enrollmentCount ?? 0} students${hasActiveSession ? ', session live' : ''}`}
        className={hasActiveSession ? 'scanframe is-teal is-live' : undefined}
        style={{
          background:    'var(--bg-card)',
          borderRadius:  'var(--radius-molecular)',
          padding:       'var(--space-3)',
          display:       'flex',
          flexDirection: 'column',
          gap:           14,
          cursor:        'pointer',
          boxShadow:     'var(--shadow-md)',
          position:      'relative',
          height:        '100%',
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p className="kicker" style={{ marginBottom: 6 }}>{cls.code}{cls.department ? ` / ${cls.department}` : ''}</p>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontWeight: 650, fontSize: 'var(--text-md)',
              letterSpacing: '-0.02em', lineHeight: 1.25, color: 'var(--text-primary)',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {cls.name}
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
            {hasActiveSession
              ? <StatusPill status="live" label="Live" showSweep={false} />
              : activeSchedules.length > 0 && <StatusPill status="scheduled" label="Timetabled" showSweep={false} />}
          </div>
        </div>

        {!isOwner && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: -6 }}>
            <span className="role-chip">{ROLE_LABEL[role]}</span>
            {cls.lecturer?.name && <span style={{ marginLeft: 8 }}>Owner: {cls.lecturer.name}</span>}
          </p>
        )}

        {/* ── Facts ──────────────────────────────────────────── */}
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 'var(--text-sm)', color: 'var(--text-subtle)' }}>
          <Fact icon={Users}>{cls.enrollmentCount ?? 0} student{cls.enrollmentCount === 1 ? '' : 's'}</Fact>
          <Fact icon={hasGeofence ? MapPin : LocateOff}>
            {hasGeofence ? `${cls.location_name ?? 'Classroom'} · ${cls.geo_radius ?? 100} m check` : 'No location check'}
          </Fact>
          <Fact icon={CalendarClock}>
            {activeSchedules.length
              ? `${slotLabels.join(' · ')}${extraCount > 0 ? ` +${extraCount} more` : ''}`
              : 'No weekly timetable'}
          </Fact>
        </ul>

        {/* ── Join code ──────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          background: 'var(--bg-raised)', borderRadius: 'var(--radius-atomic)', padding: '8px 8px 8px 14px', marginTop: 'auto',
        }}>
          <div style={{ minWidth: 0 }}>
            <p className="c-label">Join code</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brand-text)', letterSpacing: '0.06em', marginTop: 2 }}>{cls.code}</p>
          </div>
          <motion.button type="button" onClick={copyCode} whileTap={TAP.button} className="icon-btn"
                         aria-label={codeCopied ? 'Copied' : `Copy join code ${cls.code}`}
                         style={{ color: codeCopied ? 'var(--green)' : undefined }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={codeCopied ? 'ok' : 'copy'} style={{ display: 'flex' }}
                initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: DURATION.fast, ease: EASE.state }}>
                {codeCopied ? <Check size={15} /> : <Copy size={15} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* ── Actions ────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <motion.button type="button" whileTap={TAP.button} className="btn-primary" style={{ flex: 1, padding: '10px 14px' }}
            onClick={() => (hasActiveSession ? navigate(`/lecturer/session/${cls.activeSession.id}`) : setShowOpenSession(true))}>
            <Radio size={14} /> {hasActiveSession ? 'View live' : 'Open session'}
          </motion.button>
          {canEdit && (
            <motion.button type="button" whileTap={TAP.button} className="icon-btn" style={{ width: 42, height: 42 }}
              onClick={() => setShowSchedule(true)} aria-label="Weekly timetable" title="Weekly timetable">
              <CalendarClock size={16} />
            </motion.button>
          )}
          {isOwner && (
            <motion.button type="button" whileTap={TAP.button} className="icon-btn" style={{ width: 42, height: 42 }}
              onClick={() => setConfirmDelete(true)} aria-label={`Delete ${cls.name}`} title="Delete class">
              <Trash2 size={16} />
            </motion.button>
          )}
          <motion.button type="button" whileTap={TAP.button} className="icon-btn" style={{ width: 42, height: 42 }}
            onClick={open} aria-label="Open class page" title="Register, students and staff">
            <ArrowUpRight size={16} />
          </motion.button>
        </div>
      </motion.article>

      <OpenSessionModal
        classData={cls}
        open={showOpenSession}
        onClose={() => setShowOpenSession(false)}
        onOpened={(session) => {
          setShowOpenSession(false);
          qc.invalidateQueries({ queryKey: ['classes'] });
          navigate(`/lecturer/session/${session.id}`);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        title={`Delete ${cls.name}?`}
        confirmLabel="Delete class"
        danger
      >
        Students are removed from it and its timetable stops. Past sessions and their attendance stay in Reports.
        {hasActiveSession && ' The session running now is closed first, and anyone who hasn\'t scanned is marked absent.'}
      </ConfirmDialog>

      <AnimatePresence>
        {showSchedule && (
          <ScheduleSheet cls={cls} onClose={() => { setShowSchedule(false); qc.invalidateQueries({ queryKey: ['classes'] }); }} />
        )}
      </AnimatePresence>
    </>
  );
}

function Fact({ icon: Icon, children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Icon size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} aria-hidden="true" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </li>
  );
}

// The weekly timetable editor, as a centred sheet.
export function ScheduleSheet({ cls, onClose }) {
  return (
    <motion.div
      variants={overlayBackdrop} initial="hidden" animate="visible" exit="exit"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      // Escape closes the sheet, unless it was meant for a confirm dialog open on top of it.
      onKeyDown={e => { if (e.key === 'Escape' && !document.querySelector('.c-dialog')) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-3)', backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(6px) saturate(140%)',
      }}
    >
      <motion.div
        variants={overlayContent} initial="hidden" animate="visible" exit="exit"
        role="dialog" aria-modal="true" aria-label={`Weekly timetable, ${cls.name}`}
        style={{
          width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)',
          borderRadius: 'var(--radius-organism)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-3)', gap: 12 }}>
          <div>
            <p className="kicker">{cls.code} / Weekly timetable</p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 650, color: 'var(--text-primary)', fontSize: 'var(--text-lg)', marginTop: 8 }}>
              {cls.name}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
              Sessions open on their own at these times, except on holidays and exam days.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" autoFocus><X size={16} /></button>
        </div>
        <ScheduleManager classId={cls.id} className={cls.name} />
      </motion.div>
    </motion.div>
  );
}

export default memo(ClassCard, (prev, next) => prev.cls === next.cls);
