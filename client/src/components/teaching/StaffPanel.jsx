// client/src/components/teaching/StaffPanel.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { UserPlus, Loader2, LogOut, Trash2, Crown } from 'lucide-react';
import toast from 'react-hot-toast';

import { Panel, Empty } from '../console/Panel';
import { Field, Select } from '../console/controls';
import { ConfirmDialog } from '../console/overlays';
import { teachingApi, ROLE_LABEL } from '../../services/teachingService';
import { useAuthStore } from '../../store/authStore';
import { SPRING } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Teaching staff on a class.
 *
 * The owner adds a co-lecturer or teaching assistant by the email on
 * their AttendX lecturer account, changes their role, or removes them.
 * A co-lecturer or TA sees the list and can leave the class.
 *
 *   Co-lecturer         everything except deleting the class, deleting
 *                       session reports and managing staff
 *   Teaching assistant  runs sessions and sees the register; can't
 *                       change attendance or review requests
 * ═════════════════════════════════════════════════════════════════
 */

const ROLE_HELP = {
  co_lecturer: 'Runs sessions, changes attendance, reviews appeals and excuse requests, edits the timetable.',
  ta: 'Runs sessions and shows the QR code, sees the register. Can\'t change attendance or review requests.',
};

export default function StaffPanel({ classId, owner, staff = [], myRole }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useAuthStore(s => s.user);
  const isOwner = myRole === 'owner';
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ta');
  const [confirm, setConfirm] = useState(null);   // { userId, name, leaving }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['class-hub', classId] });
    qc.invalidateQueries({ queryKey: ['classes'] });
  };
  const add = useMutation({
    mutationFn: () => teachingApi.addStaff(classId, { email: email.trim(), role }),
    onSuccess: (r) => { toast.success(r.message); setEmail(''); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not add them'),
  });
  const change = useMutation({
    mutationFn: ({ userId, role: r }) => teachingApi.updateStaff(classId, userId, r),
    onSuccess: (r) => { toast.success(r.message); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not change the role'),
  });
  const remove = useMutation({
    mutationFn: ({ userId }) => teachingApi.removeStaff(classId, userId),
    onSuccess: (r, vars) => {
      toast.success(r.message);
      setConfirm(null);
      refresh();
      if (vars.leaving) navigate('/lecturer/classes', { replace: true });
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not remove them'),
  });

  return (
    <div className="split">
      <Panel flush label="Teaching staff" title={`${staff.length + 1} ${staff.length ? 'people' : 'person'} teach this class`}>
        <ul style={{ listStyle: 'none' }}>
          <StaffRow name={owner?.name} email={owner?.email} badge={<span className="chip brand"><Crown size={12} /> Owner</span>} />
          <AnimatePresence initial={false}>
            {staff.map(s => (
              <motion.li key={s.userId} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={SPRING.snappy}>
                <StaffRow
                  name={s.name} email={s.email}
                  badge={isOwner
                    ? <Select label={`Role for ${s.name}`} value={s.role} onChange={r => change.mutate({ userId: s.userId, role: r })}
                              options={[{ value: 'co_lecturer', label: 'Co-lecturer' }, { value: 'ta', label: 'Teaching assistant' }]} />
                    : <span className="role-chip">{ROLE_LABEL[s.role]}</span>}
                  action={isOwner
                    ? <button type="button" className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => setConfirm({ userId: s.userId, name: s.name })}><Trash2 size={15} /></button>
                    : s.userId === me?.id
                      ? <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm({ userId: s.userId, name: s.name, leaving: true })}><LogOut size={14} /> Leave</button>
                      : null}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {staff.length === 0 && (
          <Empty title="Just you so far">Add a co-lecturer or teaching assistant to share the class.</Empty>
        )}
      </Panel>

      {isOwner ? (
        <Panel label="Share this class" title="Add a co-lecturer or TA">
          <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                onSubmit={e => { e.preventDefault(); if (email.trim()) add.mutate(); }}>
            <Field label="Their AttendX email" hint="They need a lecturer account. An administrator can create one.">
              <input className="c-input" type="email" required value={email} onChange={e => setEmail(e.target.value)}
                     placeholder="colleague@university.edu" autoComplete="off" />
            </Field>
            <Field label="Role" hint={ROLE_HELP[role]}>
              <Select label="Role" value={role} onChange={setRole} style={{ width: '100%' }}
                      options={[{ value: 'ta', label: 'Teaching assistant' }, { value: 'co_lecturer', label: 'Co-lecturer' }]} />
            </Field>
            <button type="submit" className="btn-accent btn-sm" disabled={add.isPending || !email.trim()} style={{ alignSelf: 'flex-start' }}>
              {add.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Add to class
            </button>
          </form>
        </Panel>
      ) : (
        <Panel label="Your role" title={ROLE_LABEL[myRole]}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', lineHeight: 1.55 }}>{ROLE_HELP[myRole]}</p>
        </Panel>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        busy={remove.isPending}
        danger
        title={confirm?.leaving ? 'Leave this class?' : `Remove ${confirm?.name}?`}
        confirmLabel={confirm?.leaving ? 'Leave class' : 'Remove'}
        onConfirm={() => remove.mutate(confirm)}
      >
        {confirm?.leaving
          ? 'It disappears from your classes. The owner can add you again.'
          : 'They lose access to the class straight away. Attendance they recorded stays.'}
      </ConfirmDialog>
    </div>
  );
}

function StaffRow({ name, email, badge, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
      <span aria-hidden="true" style={{
        width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
        background: 'var(--bg-raised)', color: 'var(--text-subtle)', fontWeight: 700, fontSize: 12,
      }}>
        {String(name ?? '?').split(/\s+/).filter(Boolean).slice(-2).map(p => p[0]).join('').toUpperCase()}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span>
      </span>
      {badge}
      {action}
    </div>
  );
}
