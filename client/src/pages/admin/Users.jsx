// client/src/pages/admin/Users.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, UserCheck, UserX, Trash2, Eye, Shield,
  Loader2, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listUsers, toggleUserStatus, updateUserRole,
  deleteUser, startImpersonation,
} from '../../services/adminService';
import { useAuthStore }  from '../../store/authStore';
import { useIsMobile }   from '../../hooks/useIsMobile';

const ROLE_OPTIONS = [
  { value: '',         label: 'All roles' },
  { value: 'student',  label: 'Students'  },
  { value: 'lecturer', label: 'Lecturers' },
  { value: 'admin',    label: 'Admins'    },
];

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const navigate     = useNavigate();
  const isMobile     = useIsMobile();
  const currentUser  = useAuthStore(s => s.user);
  const startImpersonatingStore = useAuthStore(s => s.startImpersonating);

  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [search,  setSearch]  = useState('');
  const [role,    setRole]    = useState('');
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId,  setBusyId]  = useState(null);
  const [confirmDelete,      setConfirmDelete]      = useState(null);
  const [confirmImpersonate, setConfirmImpersonate] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ─── Load ─────────────────────────────────────────────────
  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await listUsers({
          page, limit: PAGE_SIZE,
          search: search.trim() || undefined,
          role:   role || undefined,
        });
        setUsers(data.users || data.rows || []);
        setTotal(data.total || data.count || 0);
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to load users');
      } finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(handle);
  }, [search, role, page]);

  useEffect(() => { setPage(1); }, [search, role]);

  // ─── Actions ──────────────────────────────────────────────
  async function handleToggleStatus(user) {
    if (user.id === currentUser?.id) { toast.error("Can't deactivate yourself"); return; }
    setBusyId(user.id);
    try {
      const updated = await toggleUserStatus(user.id);
      setUsers(rows => rows.map(u => u.id === user.id ? { ...u, ...updated } : u));
      toast.success(updated.is_active ? 'User activated' : 'User deactivated');
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setBusyId(null); }
  }

  async function handleChangeRole(user, newRole) {
    if (newRole === user.role) return;
    if (user.id === currentUser?.id) { toast.error("Can't change your own role"); return; }
    setBusyId(user.id);
    try {
      const updated = await updateUserRole(user.id, newRole);
      setUsers(rows => rows.map(u => u.id === user.id ? { ...u, ...updated } : u));
      toast.success(`Role updated to ${newRole}`);
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setBusyId(null); }
  }

  async function handleDelete(user) {
    setBusyId(user.id);
    try {
      await deleteUser(user.id);
      setUsers(rows => rows.filter(u => u.id !== user.id));
      setTotal(t => Math.max(0, t - 1));
      toast.success('User deleted');
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setBusyId(null); setConfirmDelete(null); }
  }

  async function handleImpersonate(user, reason) {
    setBusyId(user.id);
    try {
      const result = await startImpersonation(user.id, reason);
      startImpersonatingStore({ token: result.token, user: result.user, originalUser: currentUser });
      toast.success(`Now viewing as ${user.name}`);
      setConfirmImpersonate(null);
      if (user.role === 'lecturer') navigate('/lecturer');
      else if (user.role === 'student') navigate('/student');
      else navigate('/');
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setBusyId(null); }
  }

  const visibleUsers = useMemo(() => users || [], [users]);

  return (
    <div style={{ padding: isMobile ? 'var(--space-3)' : 'var(--space-6)', maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font-display)' }}>

      {/* Header */}
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--text-xl)' : 'clamp(20px,2.5vw,28px)', fontWeight: 700, color: 'var(--text-primary)' }}>
          User management
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          {total.toLocaleString()} {total === 1 ? 'user' : 'users'}
          {role   ? ` · filtered by ${role}` : ''}
          {search ? ` · matching "${search}"` : ''}
        </p>
      </header>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} aria-hidden />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or student ID…"
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', minWidth: isMobile ? '100%' : 140, fontFamily: 'inherit' }}
        >
          {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading && visibleUsers.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 20px', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="admSpin" />
          <span>Loading users…</span>
        </div>
      ) : visibleUsers.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg, 14px)', border: '1px solid var(--border)' }}>
          No users match these filters.
        </div>
      ) : isMobile ? (
        /* ── Mobile: card list ────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleUsers.map(user => (
            <UserCard
              key={user.id}
              user={user}
              isSelf={user.id === currentUser?.id}
              isBusy={busyId === user.id}
              onToggle={() => handleToggleStatus(user)}
              onChangeRole={r => handleChangeRole(user, r)}
              onDelete={() => setConfirmDelete(user)}
              onImpersonate={() => setConfirmImpersonate(user)}
            />
          ))}
        </div>
      ) : (
        /* ── Desktop: table ───────────────────────────────── */
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg, 14px)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: h === '' ? 'right' : 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(user => {
                const isSelf  = user.id === currentUser?.id;
                const isBusy  = busyId === user.id;
                const canImp  = user.role !== 'admin' && user.is_active && !isSelf;
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {(user.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
                          {user.student_id && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{user.student_id}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{user.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={user.role}
                        disabled={isBusy || isSelf}
                        onChange={e => handleChangeRole(user, e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: isSelf ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                      >
                        <option value="student">Student</option>
                        <option value="lecturer">Lecturer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: user.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.16)', color: user.is_active ? '#059669' : 'var(--text-muted)' }}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <IconBtn disabled={!canImp || isBusy} onClick={() => setConfirmImpersonate(user)} title={canImp ? 'View as' : 'Cannot impersonate'} icon={Eye} />
                        <IconBtn disabled={isSelf || isBusy} onClick={() => handleToggleStatus(user)} title={user.is_active ? 'Deactivate' : 'Activate'} icon={user.is_active ? UserX : UserCheck} />
                        <IconBtn disabled={isSelf || isBusy} onClick={() => setConfirmDelete(user)} title="Delete" icon={Trash2} danger />
                        {isBusy && <Loader2 size={16} className="admSpin" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))} style={pageBtnStyle(page > 1 && !loading)}>
          <ChevronLeft size={16} /> {isMobile ? '' : 'Previous'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
        <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={pageBtnStyle(page < totalPages && !loading)}>
          {isMobile ? '' : 'Next'} <ChevronRight size={16} />
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmModal
            icon={<Trash2 size={22} />} tone="danger"
            title="Delete this user?"
            message={<>This permanently removes <strong>{confirmDelete.name}</strong> and all related records. This cannot be undone.</>}
            confirmLabel="Delete user"
            onConfirm={() => handleDelete(confirmDelete)}
            onCancel={() => setConfirmDelete(null)}
            loading={busyId === confirmDelete.id}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmImpersonate && (
          <ImpersonateModal
            user={confirmImpersonate}
            loading={busyId === confirmImpersonate.id}
            onConfirm={reason => handleImpersonate(confirmImpersonate, reason)}
            onCancel={() => setConfirmImpersonate(null)}
          />
        )}
      </AnimatePresence>

      <style>{`.admSpin{animation:admSpinK 0.9s linear infinite}@keyframes admSpinK{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Mobile user card ─────────────────────────────────────────
function UserCard({ user, isSelf, isBusy, onToggle, onChangeRole, onDelete, onImpersonate }) {
  const canImp = user.role !== 'admin' && user.is_active && !isSelf;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-3)' }}>
      {/* Top row: avatar + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
          {(user.name || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          {user.student_id && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{user.student_id}</div>}
        </div>
        <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: user.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.16)', color: user.is_active ? '#059669' : 'var(--text-muted)' }}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Bottom row: role select + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select
          value={user.role}
          disabled={isBusy || isSelf}
          onChange={e => onChangeRole(e.target.value)}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, cursor: isSelf ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          <option value="student">Student</option>
          <option value="lecturer">Lecturer</option>
          <option value="admin">Admin</option>
        </select>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <IconBtn disabled={!canImp || isBusy} onClick={onImpersonate} title={canImp ? 'View as' : 'Cannot'} icon={Eye} />
          <IconBtn disabled={isSelf || isBusy} onClick={onToggle} title={user.is_active ? 'Deactivate' : 'Activate'} icon={user.is_active ? UserX : UserCheck} />
          <IconBtn disabled={isSelf || isBusy} onClick={onDelete} title="Delete" icon={Trash2} danger />
          {isBusy && <Loader2 size={16} className="admSpin" />}
        </div>
      </div>
    </div>
  );
}

// ─── Icon button ──────────────────────────────────────────────
function IconBtn({ icon: Icon, onClick, disabled, title, danger }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{
        width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8,
        border: danger && !disabled ? '1px solid rgba(220,38,38,0.3)' : '1px solid var(--border)',
        background: 'var(--bg-card)',
        color: disabled ? 'var(--text-disabled)' : danger ? 'var(--red)' : 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon size={15} />
    </button>
  );
}

// ─── Confirm modal ────────────────────────────────────────────
function ConfirmModal({ icon, tone, title, message, confirmLabel, onConfirm, onCancel, loading }) {
  const accent = tone === 'danger' ? 'var(--red)' : 'var(--brand)';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={loading ? undefined : onCancel}
    >
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-4)', maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}1a`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>{icon}</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={loading} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
            {loading ? <Loader2 size={16} className="admSpin" /> : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Impersonate modal ────────────────────────────────────────
function ImpersonateModal({ user, loading, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={loading ? undefined : onCancel}
    >
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-4)', maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(220,38,38,0.1)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Shield size={22} />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>View as {user.name}?</h3>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          You'll see AttendX through this user's account. Click "Stop impersonating" in the red banner to return. This action is logged.
        </p>
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>Reason (required)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Investigating a reported attendance bug"
            rows={3}
            disabled={loading}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
          />
          <div style={{ marginTop: 4, fontSize: 12, color: valid ? 'var(--green)' : 'var(--text-muted)' }}>
            {valid ? 'Looks good.' : 'At least 5 characters.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={loading} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button type="button" onClick={() => onConfirm(reason.trim())} disabled={loading || !valid}
            style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: (loading || !valid) ? 'not-allowed' : 'pointer', opacity: (loading || !valid) ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
          >
            {loading ? <Loader2 size={16} className="admSpin" /> : <><Eye size={14} /> Start viewing</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────
const pageBtnStyle = (enabled) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 'var(--radius-atomic)',
  border: '1px solid var(--border)',
  background: enabled ? 'var(--bg-card)' : 'var(--bg-raised)',
  color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
  cursor: enabled ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 500,
});