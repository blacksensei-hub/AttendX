// client/src/pages/admin/Users.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Eye, Smartphone, Trash2, UserPlus, Users as UsersIcon, Power, Copy, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  listUsers, toggleUserStatus, updateUserRole, deleteUser, startImpersonation, resetUserDevice,
} from '../../services/adminService';
import { consoleApi } from '../../services/consoleService';
import { useAuthStore } from '../../store/authStore';
import { ConsoleHead, Panel, Sig, Empty } from '../../components/console/Panel';
import DataTable from '../../components/console/DataTable';
import { Drawer, ConfirmDialog } from '../../components/console/overlays';
import { Segmented, SearchInput, Select, Field } from '../../components/console/controls';
import { timeAgo, fmtDateTime } from '../../components/console/format';

/**
 * ═════════════════════════════════════════════════════════════════
 * Users: every account, filterable by role and status, with bulk
 * actions for the selection and a drawer per person for everything
 * else (role, access, phone, "view as", invite, delete).
 *
 * ?focus=<id> opens that person's drawer (the command palette links
 * here); ?status=invited lists accounts still waiting on an invite.
 * ═════════════════════════════════════════════════════════════════
 */

const ROLES = [
  { value: '', label: 'All' },
  { value: 'student', label: 'Students' },
  { value: 'lecturer', label: 'Lecturers' },
  { value: 'admin', label: 'Admins' },
];
const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Deactivated' },
  { value: 'invited', label: 'Invite pending' },
];

const invitePending = (u) => Boolean(u.invite_expires_at);
function statusOf(u) {
  if (!u.is_active) return <Sig tone="bad">Deactivated</Sig>;
  if (invitePending(u)) {
    return new Date(u.invite_expires_at) < new Date()
      ? <Sig tone="warn">Invite expired</Sig>
      : <Sig tone="warn">Invite pending</Sig>;
  }
  return <Sig tone="live">Active</Sig>;
}

export default function Users() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useAuthStore(s => s.user);
  const startImpersonatingStore = useAuthStore(s => s.startImpersonating);
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [bulkRole, setBulkRole] = useState('lecturer');
  const [busy, setBusy] = useState(false);
  const focusId = params.get('focus');

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isPending } = useQuery({
    queryKey: ['admin-users', { page, debounced, role, status }],
    queryFn: () => listUsers({ page, limit: 25, search: debounced, role, status }),
    placeholderData: keepPreviousData,
  });
  const users = data?.users ?? [];

  // The drawer's person: from the current page, or fetched by id.
  const { data: focused } = useQuery({
    queryKey: ['admin-user', focusId],
    queryFn: () => listUsers({ id: focusId, limit: 1 }).then(r => r.users?.[0] ?? null),
    enabled: Boolean(focusId),
  });
  const openUser = (u) => setParams(p => { p.set('focus', u.id); return p; }, { replace: true });
  const closeUser = () => setParams(p => { p.delete('focus'); return p; }, { replace: true });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['admin-user'] });
    qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const bulk = async (action, extra) => {
    setBusy(true);
    try {
      const r = await consoleApi.bulkUsers([...selected], action, extra);
      toast.success(r.message);
      setSelected(new Set());
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Bulk update failed');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'name', header: 'Name', sort: u => u.name.toLowerCase(), render: u => (
      <span><span className="cell-main">{u.name}</span><span className="cell-sub">{u.email}</span></span>
    ) },
    { key: 'role', header: 'Role', sort: u => u.role, render: u => <span className={`chip${u.role === 'admin' ? ' brand' : ''}`}>{u.role}</span> },
    { key: 'dept', header: 'ID / department', render: u => (
      <span><span className="tabular">{u.student_id ?? '—'}</span><span className="cell-sub">{u.department ?? 'No department'}</span></span>
    ) },
    { key: 'phone', header: 'Phone', render: u => (u.role === 'student'
      ? (u.bound_mobile_device_id ? <span className="c-subtle">Registered</span> : <span className="c-muted">None yet</span>)
      : <span className="c-muted">n/a</span>) },
    { key: 'seen', header: 'Last sign-in', sort: u => (u.last_login_at ? new Date(u.last_login_at).getTime() : 0), render: u => (
      <span className="c-subtle" title={fmtDateTime(u.last_login_at)}>{u.last_login_at ? timeAgo(u.last_login_at) : invitePending(u) ? 'Not yet' : 'Never'}</span>
    ) },
    { key: 'status', header: 'Status', render: statusOf },
  ];

  const current = users.find(u => u.id === focusId) ?? focused ?? null;

  return (
    <div className="c-page">
      <ConsoleHead
        kicker="People / Users"
        title="Users"
        lede="Every account on AttendX. Select rows for bulk changes, or open a person for everything else."
        actions={<Link to="/admin/users/import" className="btn-accent btn-sm"><UserPlus size={15} /> Import from CSV</Link>}
      />

      <Panel flush>
        <div className="c-toolbar" style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, email or student ID" label="Search users" />
          <Segmented label="Role" options={ROLES} value={role} onChange={v => { setRole(v); setPage(1); setSelected(new Set()); }} />
          <Select label="Status" value={status} onChange={v => { setStatus(v); setPage(1); setSelected(new Set()); }} options={STATUSES} />
        </div>
        <DataTable
          caption="Users"
          columns={columns}
          rows={users}
          loading={isPending}
          onRowClick={openUser}
          selected={selected}
          onSelect={setSelected}
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          total={data?.total}
          onPage={setPage}
          empty={<Empty icon={UsersIcon} title="No one matches">Try a different search or filter.</Empty>}
          bulk={(
            <>
              <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => bulk('activate')}>Activate</button>
              <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => bulk('deactivate')}>Deactivate</button>
              <select className="c-select" style={{ width: 'auto', padding: '6px 10px' }} value={bulkRole} onChange={e => setBulkRole(e.target.value)} aria-label="Role for selected">
                <option value="student">Student</option>
                <option value="lecturer">Lecturer</option>
                <option value="admin">Admin</option>
              </select>
              <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => bulk('role', bulkRole)}>Set role</button>
              <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => bulk('reset_device')}>Reset phones</button>
              {busy && <Loader2 size={15} className="animate-spin" />}
            </>
          )}
        />
      </Panel>

      <UserDrawer
        user={current}
        open={Boolean(focusId && current)}
        onClose={closeUser}
        isSelf={current?.id === me?.id}
        onChanged={refresh}
        onViewAs={async (u, reason) => {
          const result = await startImpersonation(u.id, reason);
          startImpersonatingStore(result.user, result.token);
          toast.success(`Now viewing as ${u.name}`);
          navigate(u.role === 'lecturer' ? '/lecturer' : u.role === 'student' ? '/student' : '/');
        }}
      />
    </div>
  );
}

function UserDrawer({ user, open, onClose, isSelf, onChanged, onViewAs }) {
  const [role, setRole] = useState(user?.role ?? 'student');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(null);
  const [confirm, setConfirm] = useState(null);   // 'delete' | 'reset'
  const [link, setLink] = useState(null);

  // A different person resets the drawer's local state.
  const [shownId, setShownId] = useState(user?.id);
  if (user && user.id !== shownId) {
    setShownId(user.id);
    setRole(user.role);
    setReason('');
    setLink(null);
  }

  const act = async (name, fn, success) => {
    setWorking(name);
    try {
      const r = await fn();
      if (success) toast.success(typeof success === 'function' ? success(r) : success);
      onChanged();
      return r;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'That did not work');
      return null;
    } finally {
      setWorking(null);
    }
  };

  if (!user) return null;
  const pending = invitePending(user);

  return (
    <>
      <Drawer open={open} onClose={onClose} label={user.role} title={user.name}
        footer={!isSelf && (
          <button type="button" className="btn-danger btn-sm" onClick={() => setConfirm('delete')}><Trash2 size={14} /> Delete account</button>
        )}>
        <dl className="dl">
          <dt>Email</dt><dd>{user.email}</dd>
          {user.student_id && (<><dt>Student ID</dt><dd className="tabular">{user.student_id}</dd></>)}
          <dt>Department</dt><dd>{user.department ?? '—'}</dd>
          <dt>Status</dt><dd>{statusOf(user)}</dd>
          <dt>Joined</dt><dd>{fmtDateTime(user.createdAt)}</dd>
          <dt>Last sign-in</dt><dd>{user.last_login_at ? fmtDateTime(user.last_login_at) : 'Never'}</dd>
          {user.role === 'student' && (<><dt>Phone</dt><dd>{user.bound_mobile_device_id ? `Registered ${timeAgo(user.mobile_device_bound_at)}` : 'Not registered yet'}</dd></>)}
        </dl>

        {isSelf ? (
          <p className="c-muted" style={{ fontSize: 13 }}>This is your own account. Role and access changes have to come from another admin.</p>
        ) : (
          <>
            <Field label="Role">
              <div className="c-actions">
                <select className="c-select" style={{ width: 'auto' }} value={role} onChange={e => setRole(e.target.value)}>
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="button" className="btn-ghost btn-sm" disabled={role === user.role || working === 'role'}
                        onClick={() => act('role', () => updateUserRole(user.id, role), `Role set to ${role}`)}>Save role</button>
              </div>
            </Field>

            <div className="c-actions">
              <button type="button" className="btn-ghost btn-sm" disabled={working === 'toggle'}
                      onClick={() => act('toggle', () => toggleUserStatus(user.id), user.is_active ? 'Account deactivated' : 'Account activated')}>
                <Power size={14} /> {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
              {user.role === 'student' && user.bound_mobile_device_id && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm('reset')}><Smartphone size={14} /> Reset phone</button>
              )}
            </div>

            {pending && (
              <Panel label="Invite" title={new Date(user.invite_expires_at) < new Date() ? 'The invite link has expired' : 'Waiting for them to set a password'}>
                <div className="c-actions">
                  <button type="button" className="btn-ghost btn-sm" disabled={working === 'invite'}
                          onClick={async () => { const r = await act('invite', () => consoleApi.resendInvite(user.id), r2 => r2.message); if (r) setLink(r.inviteLink); }}>
                    <Send size={14} /> Send a new invite
                  </button>
                  {link && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success('Invite link copied'))}>
                      <Copy size={14} /> Copy link
                    </button>
                  )}
                </div>
                {link && <p className="c-muted" style={{ fontSize: 12, marginTop: 10, overflowWrap: 'anywhere' }}>{link}</p>}
              </Panel>
            )}

            {user.role !== 'admin' && user.is_active && !pending && (
              <Panel label="View as" title={`See AttendX as ${user.name.split(' ')[0]} does`}>
                <p className="c-muted" style={{ fontSize: 13, marginBottom: 12 }}>Everything you do is recorded in the audit trail against your own account.</p>
                <Field label="Reason (optional)">
                  <input className="c-input" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="e.g. Checking an attendance dispute" />
                </Field>
                <button type="button" className="btn-accent btn-sm" style={{ marginTop: 12 }} disabled={working === 'view'}
                        onClick={() => act('view', () => onViewAs(user, reason.trim() || undefined))}>
                  <Eye size={14} /> View as {user.name.split(' ')[0]}
                </button>
              </Panel>
            )}
          </>
        )}
      </Drawer>

      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} danger busy={working === 'delete'}
        title={`Delete ${user.name}?`} confirmLabel="Delete account"
        onConfirm={async () => { const r = await act('delete', () => deleteUser(user.id), 'Account deleted'); setConfirm(null); if (r) onClose(); }}>
        This permanently removes the account and its attendance records. It cannot be undone. Deactivating keeps the history instead.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'reset'} onClose={() => setConfirm(null)} busy={working === 'reset'}
        title={`Reset ${user.name.split(' ')[0]}'s phone?`} confirmLabel="Reset phone"
        onConfirm={async () => { await act('reset', () => resetUserDevice(user.id), `${user.name.split(' ')[0]} can sign in on a new phone`); setConfirm(null); }}>
        They are signed out everywhere, and the next phone they sign in on becomes their registered one. Frequent resets are flagged for fraud review.
      </ConfirmDialog>
    </>
  );
}
