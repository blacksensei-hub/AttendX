import { useState }          from 'react';
import { useMutation,
         useQueryClient }    from '@tanstack/react-query';
import { motion }            from 'framer-motion';
import { X, AlertTriangle }  from 'lucide-react';
import api                   from '../../services/api';
import toast                 from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  { value: 'late',    label: 'Late',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  { value: 'absent',  label: 'Absent',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
];

// Props:
//   student      — { studentId, studentName, attendanceId, currentStatus }
//   sessionId    — used when creating a record for an absent student
//   onClose      — close the modal
//   onSuccess    — called after a successful save to refetch the roster
export default function AdjustmentModal({ student, sessionId, onClose, onSuccess }) {
  const [newStatus, setNewStatus] = useState(student.status === 'absent'
    ? 'present'
    : student.status
  );
  const [reason, setReason]       = useState('');

  const isAbsent = !student.attendanceId;

  // For students with an existing record — update it
  const updateMut = useMutation({
    mutationFn: () =>
      api.put(`/adjustments/record/${student.attendanceId}`, {
        newStatus,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success(`Updated to ${newStatus}`);
      onSuccess();
      onClose();
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to update'),
  });

  // For absent students with no record — create one
  const createMut = useMutation({
    mutationFn: () =>
      api.post(`/adjustments/${sessionId}/absent/${student.studentId}`, {
        newStatus,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success(`Marked as ${newStatus}`);
      onSuccess();
      onClose();
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const isPending = updateMut.isPending || createMut.isPending;

  const handleSave = () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for this adjustment');
      return;
    }
    isAbsent ? createMut.mutate() : updateMut.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      style={{
        position:        'fixed', inset: 0, zIndex: 50,
        display:         'flex', alignItems: 'center', justifyContent: 'center',
        padding:         '1rem',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter:  'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{    opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.2 }}
        style={{
          width:        '100%', maxWidth: '480px',
          background:   'var(--bg-card)',
          border:       '1px solid var(--border)',
          borderRadius: '1.25rem',
          overflow:     'hidden',
          boxShadow:    'var(--shadow)',
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding:        '1.125rem 1.5rem',
          borderBottom:   '1px solid var(--border)',
          background:     'var(--bg-raised)',
        }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600,
                         fontSize: '1rem' }}>
              Adjust attendance
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem',
                         marginTop: '2px' }}>
              {student.studentName}
              {student.studentIdDisplay
                ? ` · ${student.studentIdDisplay}`
                : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '0.25rem',
              display: 'flex', alignItems: 'center', borderRadius: '0.5rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex',
                      flexDirection: 'column', gap: '1.25rem' }}>

          {/* Current status */}
          <div style={{
            display:      'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding:      '0.75rem 1rem',
            background:   'var(--bg-raised)',
            border:       '1px solid var(--border)',
            borderRadius: '0.75rem',
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Current status
            </p>
            <span style={{
              padding:      '0.2rem 0.75rem',
              borderRadius: '99px',
              fontSize:     '0.8rem',
              fontWeight:   600,
              background:   STATUS_OPTIONS.find(s => s.value === student.status)?.bg
                ?? 'var(--bg-raised)',
              color:        STATUS_OPTIONS.find(s => s.value === student.status)?.color
                ?? 'var(--text-muted)',
              textTransform: 'capitalize',
            }}>
              {student.status}
            </span>
          </div>

          {/* New status picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem',
                             fontWeight: 500 }}>
              Change to *
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {STATUS_OPTIONS.filter(s => s.value !== student.status).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNewStatus(opt.value)}
                  style={{
                    flex:           1,
                    padding:        '0.625rem',
                    borderRadius:   '0.75rem',
                    border:         '1px solid',
                    borderColor:    newStatus === opt.value ? opt.color : 'var(--border)',
                    background:     newStatus === opt.value ? opt.bg : 'var(--bg-raised)',
                    color:          newStatus === opt.value ? opt.color : 'var(--text-muted)',
                    fontWeight:     newStatus === opt.value ? 700 : 400,
                    fontSize:       '0.875rem',
                    cursor:         'pointer',
                    transition:     'all 0.15s',
                    textTransform:  'capitalize',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason — required */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem',
                             fontWeight: 500 }}>
              Reason for adjustment *
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="Explain why this attendance record is being changed. This is permanently recorded in the audit trail."
              className="input-base"
              style={{ resize: 'none', lineHeight: 1.6 }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
              {reason.length} characters — this note is permanently stored and
              cannot be edited after saving.
            </p>
          </div>

          {/* Audit trail notice */}
          <div style={{
            display:      'flex', alignItems: 'flex-start', gap: '0.625rem',
            padding:      '0.75rem 0.875rem',
            background:   'rgba(245,158,11,0.08)',
            border:       '1px solid rgba(245,158,11,0.2)',
            borderRadius: '0.75rem',
          }}>
            <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0,
                                              marginTop: '1px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.775rem',
                         lineHeight: 1.5 }}>
              This adjustment will be permanently logged. The student's
              attendance history will reflect the new status immediately.
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || !reason.trim()}
              className="btn-primary"
              style={{
                flex:    2,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.5rem',
                opacity: (isPending || !reason.trim()) ? 0.7 : 1,
              }}
            >
              {isPending ? 'Saving…' : `Save — mark as ${newStatus}`}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}