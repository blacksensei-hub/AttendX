// client/src/components/classes/ClassCard.jsx
import { useState, memo }              from 'react';
import { useNavigate }                 from 'react-router-dom';
import { motion, AnimatePresence }     from 'framer-motion';
import {
  Users, MapPin, Copy, Trash2, Radio,
  CheckCircle, Calendar, X, Check, GraduationCap,
}                                       from 'lucide-react';
import { useQueryClient }               from '@tanstack/react-query';

import OpenSessionModal                 from '../sessions/OpenSessionModal';
import ScheduleManager                  from './ScheduleManager';
import StatusPill                       from '../ui/StatusPill';
import {
  EASE, DURATION, SPRING, TAP,
  overlayBackdrop, overlayContent,
}                                       from '../../lib/motion';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ClassCard({ cls, onDelete }) {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [showOpenSession, setShowOpenSession] = useState(false);
  const [showSchedule,    setShowSchedule]    = useState(false);
  const [codeCopied,      setCodeCopied]      = useState(false);

  const hasActiveSession = !!cls.activeSession;
  const hasGeofence      = !!(cls.geo_lat && cls.geo_lng);

  const schedules       = cls.schedules ?? [];
  const activeSchedules = schedules.filter(s => s.is_active);
  const pausedSchedules = schedules.filter(s => !s.is_active);
  const hasSchedule     = schedules.length > 0;
  const hasActive       = activeSchedules.length > 0;

  const slotLabels = activeSchedules.slice(0, 2).map(s =>
    `${DAY_NAMES[s.day_of_week]} ${s.start_time?.substring(0, 5)}`
  );
  const extraCount = activeSchedules.length - slotLabels.length;

  const copyCode = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cls.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const goToPerformance = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/lecturer/class/${cls.id}/performance`);
  };

  return (
    <>
      <motion.div
        layoutId={`class-morph-${cls.id}`}
        whileHover={{ y: -2, transition: SPRING.snappy }}
        whileTap={hasActiveSession ? TAP.card : undefined}
        transition={SPRING.gentle}
        onClick={() =>
          hasActiveSession &&
          navigate(`/lecturer/session/${cls.activeSession.id}`)
        }
        style={{
          background:    'var(--bg-card)',
          borderRadius:  'var(--radius-molecular)',
          padding:       'var(--space-3)',
          display:       'flex',
          flexDirection: 'column',
          gap:           'var(--space-3)',
          cursor:        hasActiveSession ? 'pointer' : 'default',
          boxShadow:     hasActiveSession ? 'var(--shadow-brand)' : 'var(--shadow-md)',
          willChange:    'transform, box-shadow',
          position:      'relative',
          overflow:      'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontWeight: 600,
              color: 'var(--text-primary)', fontSize: 'var(--text-md)',
              lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', marginBottom: cls.description ? '2px' : 0,
            }}>
              {cls.name}
            </h3>
            {cls.description && (
              <p style={{
                color: 'var(--text-muted)', fontSize: 'var(--text-xs)', lineHeight: 1.5,
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {cls.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, alignItems: 'flex-end' }}>
            {hasActiveSession && <StatusPill status="live" label="Live" showSweep={false} />}
            {!hasActiveSession && hasActive && <StatusPill status="scheduled" label="Scheduled" showSweep={false} />}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Stat icon={Users} label={`${cls.enrollmentCount ?? 0} students`} />
          {cls.location_name && <Stat icon={MapPin} label={cls.location_name} truncate />}
        </div>

        {/* Status chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <Chip
            active={hasGeofence}
            activeColor="var(--green)" activeBg="var(--green-bg)" activeBorder="var(--green-border)"
            label={hasGeofence ? `📍 Geofence · ${cls.geo_radius ?? 100}m` : '📍 No geofence'}
          />
          {hasSchedule ? (
            <Chip
              clickable
              onClick={e => { e.stopPropagation(); setShowSchedule(true); }}
              active={hasActive}
              activeColor="var(--brand)" activeBg="var(--brand-subtle)" activeBorder="var(--brand-border)"
              inactiveColor="var(--amber)" inactiveBg="var(--amber-bg)" inactiveBorder="var(--amber-border)"
              label={hasActive
                ? `📅 ${slotLabels.join(' · ')}${extraCount > 0 ? ` +${extraCount}` : ''}`
                : `📅 ${pausedSchedules.length} paused`}
              title="Click to manage schedule"
            />
          ) : (
            <Chip clickable onClick={e => { e.stopPropagation(); setShowSchedule(true); }} label="📅 No recurring schedule" title="Click to add a schedule" />
          )}
        </div>

        {/* Join code */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', background: 'var(--bg-raised)', borderRadius: 'var(--radius-atomic)', padding: '10px 14px' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '2px' }}>
              Join code
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brand-text)', fontSize: 'var(--text-base)', letterSpacing: '0.04em' }}>
              {cls.code}
            </p>
          </div>
          <button
            type="button"
            onClick={copyCode}
            title="Copy code"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: codeCopied ? 'var(--green)' : 'var(--text-muted)', padding: '6px', borderRadius: 'var(--radius-atomic)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={codeCopied ? 'copied' : 'copy'}
                initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
                animate={{ opacity: 1, scale: 1,   rotate: 0   }}
                exit={{    opacity: 0, scale: 0.6, rotate: 90  }}
                transition={{ duration: DURATION.fast, ease: EASE.state }}
                style={{ display: 'flex' }}
              >
                {codeCopied ? <Check size={15} /> : <Copy size={15} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>

          {/* Primary: open/view session */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              hasActiveSession
                ? navigate(`/lecturer/session/${cls.activeSession.id}`)
                : setShowOpenSession(true);
            }}
            className="btn-primary"
            style={{ flex: 1, padding: '10px var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', border: 'none', borderRadius: 'var(--radius-atomic)', fontFamily: 'inherit', fontWeight: 600, fontSize: 'var(--text-sm)' }}
          >
            <Radio size={14} />
            {hasActiveSession ? 'View live' : 'Open session'}
          </button>

          {/* Students performance — plain button to avoid Framer click swallowing */}
          <button
            type="button"
            onClick={goToPerformance}
            title="View student performance"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 14px', cursor: 'pointer',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-atomic)', color: 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background  = 'var(--brand-subtle)';
              e.currentTarget.style.color       = 'var(--brand-text)';
              e.currentTarget.style.borderColor = 'var(--brand-border)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background  = 'var(--bg-raised)';
              e.currentTarget.style.color       = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <GraduationCap size={15} />
          </button>

          {/* Schedule */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setShowSchedule(true); }}
            title={hasActive ? `Manage schedule (${activeSchedules.length} active)` : 'Manage schedule'}
            style={{
              position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 14px', cursor: 'pointer',
              background: hasActive ? 'var(--brand-subtle)' : 'var(--bg-raised)',
              border: `1px solid ${hasActive ? 'var(--brand-border)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-atomic)',
              color: hasActive ? 'var(--brand)' : 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            <Calendar size={15} />
            {hasActive && (
              <span className="scheduled-dot" style={{ position: 'absolute', top: '4px', right: '4px', boxShadow: '0 0 0 2px var(--bg-card)' }} />
            )}
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            title="Delete class"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 14px', cursor: 'pointer',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-atomic)', color: 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background  = 'rgba(239,68,68,0.08)';
              e.currentTarget.style.color       = 'var(--red)';
              e.currentTarget.style.borderColor = 'var(--red-border)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background  = 'var(--bg-raised)';
              e.currentTarget.style.color       = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </motion.div>

      {/* Open session modal */}
      <OpenSessionModal
        classData={cls}
        open={showOpenSession}
        onClose={() => setShowOpenSession(false)}
        onOpened={async () => {
          await qc.invalidateQueries({ queryKey: ['classes'] });
          await qc.refetchQueries({ queryKey: ['classes'] });
          navigate('/lecturer/sessions');
        }}
      />

      {/* Schedule manager modal */}
      <AnimatePresence>
        {showSchedule && (
          <motion.div
            variants={overlayBackdrop} initial="hidden" animate="visible" exit="exit"
            onClick={e => { if (e.target === e.currentTarget) { setShowSchedule(false); qc.invalidateQueries({ queryKey: ['classes'] }); } }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--bg-overlay)', backdropFilter: 'blur(6px) saturate(140%)' }}
          >
            <motion.div
              variants={overlayContent} initial="hidden" animate="visible" exit="exit"
              style={{ width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-organism)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-lg)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-lg)' }}>
                    Weekly schedule
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: '2px' }}>{cls.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowSchedule(false); qc.invalidateQueries({ queryKey: ['classes'] }); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-atomic)' }}
                >
                  <X size={18} />
                </button>
              </div>
              <ScheduleManager classId={cls.id} className={cls.name} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Stat({ icon: Icon, label, truncate }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', minWidth: 0, flexShrink: truncate ? 1 : 0 }}>
      <Icon size={13} style={{ flexShrink: 0 }} />
      <span style={{ overflow: truncate ? 'hidden' : 'visible', textOverflow: truncate ? 'ellipsis' : 'clip', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}

function Chip({ label, active, clickable, onClick, title, activeColor = 'var(--text-muted)', activeBg = 'var(--bg-raised)', activeBorder = 'var(--border)', inactiveColor = 'var(--text-muted)', inactiveBg = 'var(--bg-raised)', inactiveBorder = 'var(--border)' }) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 12px',
        background:   active ? activeBg      : inactiveBg,
        border:       `1px solid ${active ? activeBorder : inactiveBorder}`,
        borderRadius: 'var(--radius-pill)',
        fontSize:     'var(--text-xs)',
        fontWeight:   active ? 600 : 500,
        color:        active ? activeColor   : inactiveColor,
        cursor:       clickable ? 'pointer' : 'default',
        lineHeight:   1.4,
      }}
    >
      {label}
    </div>
  );
}

export default memo(ClassCard, (prev, next) => prev.cls === next.cls);