import { useState }                                  from 'react';
import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  Plus, Trash2, Clock, Calendar, Play, Pause,
}                                                    from 'lucide-react';
import api                                           from '../../services/api';
import toast                                         from 'react-hot-toast';
import {
  EASE, DURATION, SPRING, TAP,
  listContainer, listItem,
}                                                    from '../../lib/motion';

const DAYS = [
  { value: 0, label: 'Sunday',    short: 'Sun' },
  { value: 1, label: 'Monday',    short: 'Mon' },
  { value: 2, label: 'Tuesday',   short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday',  short: 'Thu' },
  { value: 5, label: 'Friday',    short: 'Fri' },
  { value: 6, label: 'Saturday',  short: 'Sat' },
];

/**
 * ═════════════════════════════════════════════════════════════════
 * ScheduleManager — manage weekly recurring sessions for a class.
 *
 * Rendered inside the ClassCard modal. Displays existing schedule
 * entries, provides an inline add-form, and lets the lecturer pause,
 * resume, or delete any schedule entry.
 *
 * Uses design-system tokens + motion primitives throughout.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ScheduleManager({ classId, className }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [newDay,      setNewDay]      = useState(1);
  const [newTime,     setNewTime]     = useState('10:00');
  const [newDuration, setNewDuration] = useState(90);
  const [newInterval, setNewInterval] = useState(10);
  const [newLate,     setNewLate]     = useState(5);

  // ── Fetch schedules ───────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['class-schedules', classId],
    queryFn:  () => api.get(`/schedules/class/${classId}`).then(r => r.data),
  });
  const schedules = data?.schedules ?? [];

  // ── Mutations ─────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (body) => api.post(`/schedules/class/${classId}`, body),
    onSuccess: () => {
      toast.success('Schedule added');
      qc.invalidateQueries({ queryKey: ['class-schedules', classId] });
      qc.invalidateQueries({ queryKey: ['classes'] });
      setShowAdd(false);
      setNewTime('10:00');
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to add schedule'),
  });

  const toggleMut = useMutation({
    mutationFn: (scheduleId) => api.put(`/schedules/${scheduleId}/toggle`),
    onSuccess: (res) => {
      toast.success(res.data?.message ?? 'Toggled');
      qc.invalidateQueries({ queryKey: ['class-schedules', classId] });
      qc.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (scheduleId) => api.delete(`/schedules/${scheduleId}`),
    onSuccess: () => {
      toast.success('Schedule removed');
      qc.invalidateQueries({ queryKey: ['class-schedules', classId] });
      qc.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           'var(--space-3)',
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            'var(--space-2)',
      }}>
        <div>
          <p style={{
            color:      'var(--text-primary)',
            fontWeight: 600,
            fontSize:   'var(--text-md)',
            fontFamily: 'var(--font-display)',
          }}>
            Weekly schedule
          </p>
          <p style={{
            color:     'var(--text-muted)',
            fontSize:  'var(--text-sm)',
            marginTop: '2px',
          }}>
            Sessions for {className} open automatically at these times
          </p>
        </div>

        <AnimatePresence>
          {!showAdd && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{    opacity: 0, scale: 0.9 }}
              transition={SPRING.snappy}
              whileTap={TAP.button}
              onClick={() => setShowAdd(true)}
              className="btn-primary"
              style={{ padding: '8px 14px' }}
            >
              <Plus size={14} />
              Add time slot
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Add form ───────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{    opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: DURATION.medium, ease: EASE.state }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background:    'var(--bg-raised)',
              border:        '1px solid var(--brand-border)',
              borderRadius:  'var(--radius-molecular)',
              padding:       'var(--space-3)',
              display:       'flex',
              flexDirection: 'column',
              gap:           'var(--space-3)',
            }}>
              <p style={{
                color:         'var(--brand-text)',
                fontSize:      'var(--text-xs)',
                fontWeight:    700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                New time slot
              </p>

              {/* Day picker — pills for each weekday */}
              <div>
                <label style={{
                  color:     'var(--text-subtle)',
                  fontSize:  'var(--text-xs)',
                  fontWeight:500,
                  display:   'block',
                  marginBottom: '6px',
                }}>
                  Day of the week
                </label>
                <div style={{
                  display:  'flex',
                  gap:      '4px',
                  flexWrap: 'wrap',
                }}>
                  {DAYS.map(d => {
                    const selected = newDay === d.value;
                    return (
                      <motion.button
                        key={d.value}
                        onClick={() => setNewDay(d.value)}
                        whileTap={TAP.button}
                        animate={{
                          borderColor:     selected ? 'var(--brand)'         : 'var(--border)',
                          backgroundColor: selected ? 'var(--brand-subtle)'  : 'var(--bg-card)',
                          color:           selected ? 'var(--brand-text)'    : 'var(--text-muted)',
                        }}
                        transition={{ duration: DURATION.base, ease: EASE.state }}
                        style={{
                          flex:         '1 0 auto',
                          minWidth:     '52px',
                          padding:      '8px',
                          borderRadius: 'var(--radius-atomic)',
                          border:       '1px solid',
                          fontSize:     'var(--text-xs)',
                          fontWeight:   selected ? 700 : 500,
                          cursor:       'pointer',
                        }}
                      >
                        {d.short}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Time + duration */}
              <div style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:                 'var(--space-2)',
              }}>
                <Field label="Start time">
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="input-base"
                  />
                </Field>
                <Field label="Duration (minutes)">
                  <input
                    type="number"
                    value={newDuration}
                    onChange={e => setNewDuration(parseInt(e.target.value) || 90)}
                    min={5}
                    max={600}
                    className="input-base"
                  />
                </Field>
              </div>

              {/* QR interval + late threshold */}
              <div style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:                 'var(--space-2)',
              }}>
                <Field label="QR rotate every (seconds)">
                  <input
                    type="number"
                    value={newInterval}
                    onChange={e => setNewInterval(parseInt(e.target.value) || 10)}
                    min={3}
                    max={120}
                    className="input-base"
                  />
                </Field>
                <Field label="Late threshold (minutes)">
                  <input
                    type="number"
                    value={newLate}
                    onChange={e => setNewLate(parseInt(e.target.value) || 5)}
                    min={0}
                    max={60}
                    className="input-base"
                  />
                </Field>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <motion.button
                  whileTap={TAP.button}
                  onClick={() => setShowAdd(false)}
                  className="btn-ghost"
                  style={{ flex: 1 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={TAP.button}
                  onClick={() => createMut.mutate({
                    day_of_week:    newDay,
                    start_time:     newTime,
                    duration_mins:  newDuration,
                    qr_interval:    newInterval,
                    late_threshold: newLate,
                  })}
                  disabled={createMut.isPending}
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  {createMut.isPending ? 'Adding…' : 'Add schedule'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading state ──────────────────────────────────── */}
      {isLoading && (
        <div
          className="shimmer"
          style={{ height: '68px' }}
        />
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {!isLoading && schedules.length === 0 && !showAdd && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.snappy}
          style={{
            background:   'var(--bg-raised)',
            border:       '1px dashed var(--border-hover)',
            borderRadius: 'var(--radius-molecular)',
            padding:      'var(--space-4) var(--space-3)',
            textAlign:    'center',
          }}
        >
          <Calendar
            size={28}
            style={{
              color:        'var(--text-muted)',
              marginBottom: '10px',
            }}
          />
          <p style={{
            color:      'var(--text-secondary)',
            fontWeight: 500,
            fontSize:   'var(--text-sm)',
          }}>
            No recurring sessions yet
          </p>
          <p style={{
            color:     'var(--text-muted)',
            fontSize:  'var(--text-xs)',
            marginTop: '4px',
          }}>
            Add a time slot to enable automatic session opening
          </p>
        </motion.div>
      )}

      {/* ── Schedule list — staggered entrance ─────────────── */}
      {schedules.length > 0 && (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           '6px',
          }}
        >
          <AnimatePresence initial={false}>
            {schedules.map(sched => (
              <ScheduleRow
                key={sched.id}
                sched={sched}
                onToggle={() => toggleMut.mutate(sched.id)}
                onDelete={() => {
                  const day  = DAYS.find(d => d.value === sched.day_of_week);
                  const time = sched.start_time?.substring(0, 5) ?? '';
                  if (confirm(`Delete this ${day?.label} ${time} schedule?`)) {
                    deleteMut.mutate(sched.id);
                  }
                }}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

// ─── Sub-component: single schedule row ────────────────────────
function ScheduleRow({ sched, onToggle, onDelete }) {
  const day  = DAYS.find(d => d.value === sched.day_of_week);
  const time = sched.start_time?.substring(0, 5) ?? '';

  return (
    <motion.div
      layout
      variants={listItem}
      exit="exit"
      animate={{
        opacity: sched.is_active ? 1 : 0.6,
      }}
      transition={{ duration: DURATION.base, ease: EASE.state }}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            'var(--space-3)',
        padding:        'var(--space-2) var(--space-3)',
        background:     sched.is_active ? 'var(--bg-raised)' : 'var(--bg-card)',
        border:         '1px solid var(--border)',
        borderRadius:   'var(--radius-atomic)',
        flexWrap:       'wrap',
      }}
    >
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        'var(--space-2)',
        minWidth:   0,
      }}>
        <div style={{
          width:          '36px',
          height:         '36px',
          borderRadius:   'var(--radius-atomic)',
          background:     'var(--brand-subtle)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          'var(--brand-text)',
          flexShrink:     0,
        }}>
          <Clock size={15} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{
            color:      'var(--text-primary)',
            fontWeight: 600,
            fontSize:   'var(--text-sm)',
          }}>
            Every {day?.label} at {time}
          </p>
          <p style={{
            color:     'var(--text-muted)',
            fontSize:  'var(--text-xs)',
            marginTop: '2px',
          }}>
            {sched.duration_mins} min · QR rotates every {sched.qr_interval}s · Late after {sched.late_threshold} min
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        {/* Toggle active — amber pause / green play */}
        <motion.button
          whileTap={TAP.button}
          onClick={onToggle}
          title={sched.is_active ? 'Pause this schedule' : 'Resume this schedule'}
          animate={{
            backgroundColor: sched.is_active ? 'var(--amber-bg)' : 'var(--green-bg)',
            borderColor:     sched.is_active ? 'var(--amber-border)' : 'var(--green-border)',
            color:           sched.is_active ? 'var(--amber)' : 'var(--green)',
          }}
          transition={{ duration: DURATION.base, ease: EASE.state }}
          style={{
            display:      'flex',
            alignItems:   'center',
            padding:      '8px',
            border:       '1px solid',
            borderRadius: 'var(--radius-atomic)',
            cursor:       'pointer',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={sched.is_active ? 'pause' : 'play'}
              initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{    opacity: 0, rotate: 90, scale: 0.6 }}
              transition={{ duration: DURATION.fast, ease: EASE.state }}
              style={{ display: 'flex' }}
            >
              {sched.is_active ? <Pause size={13} /> : <Play size={13} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        {/* Delete */}
        <motion.button
          whileTap={TAP.button}
          whileHover={{ backgroundColor: 'rgba(239,68,68,0.18)' }}
          transition={{ duration: DURATION.base, ease: EASE.state }}
          onClick={onDelete}
          title="Delete this schedule"
          style={{
            display:      'flex',
            alignItems:   'center',
            padding:      '8px',
            background:   'var(--red-bg)',
            border:       '1px solid var(--red-border)',
            color:        'var(--red)',
            borderRadius: 'var(--radius-atomic)',
            cursor:       'pointer',
          }}
        >
          <Trash2 size={13} />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Helper: form field with label ──────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label style={{
        color:        'var(--text-subtle)',
        fontSize:     'var(--text-xs)',
        fontWeight:   500,
        display:      'block',
        marginBottom: '6px',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}