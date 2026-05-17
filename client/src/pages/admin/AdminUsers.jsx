import { useState }                                  from 'react';
import { useQuery, useMutation, useQueryClient }     from '@tanstack/react-query';
import { motion, AnimatePresence }                   from 'framer-motion';
import {
  Search, UserX, UserCheck, Trash2, Filter,
  ChevronLeft, ChevronRight, Users as UsersIcon,
}                                                    from 'lucide-react';
import toast                                         from 'react-hot-toast';

import { adminService }                              from '../../services/adminService';
import PageShell, { PageHeader }                     from '../../components/layout/PageShell';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AdminUsers — platform-wide user management.
 *
 * Admin-only page for searching, filtering, role-changing,
 * activating/deactivating, and deleting any user on the platform.
 *
 * Role is displayed as a dropdown that doubles as a pill badge —
 * its background/colour animates when changed, giving the admin
 * confirmation their change was applied.
 * ═════════════════════════════════════════════════════════════════
 */

// Role → colour mapping using semantic tokens
const ROLE_STYLES = {
  admin:    {
    bg:     'var(--violet-bg)',
    border: 'var(--violet-border)',
    color:  'var(--violet)',
  },
  lecturer: {
    bg:     'var(--brand-subtle)',
    border: 'var(--brand-border)',
    color:  'var(--brand-text)',
  },
  student:  {
    bg:     'var(--green-bg)',
    border: 'var(--green-border)',
    color:  'var(--green)',
  },
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [role,   setRole]   = useState('');
  const [page,   setPage]   = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, role, page],
    queryFn:  () => adminService.getUsers({ search, role, page, limit: 20 }),
    keepPreviousData: true,
  });

  const users      = data?.users      ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total      = data?.total      ?? 0;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-users'] });

  // ── Mutations ────────────────────────────────────────────────
  const toggleMut = useMutation({
    mutationFn: adminService.toggleUser,
    onSuccess:  (d) => { toast.success(d.message); invalidate(); },
    onError:    (e) => toast.error(e.response?.data?.message || 'Error'),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }) => adminService.changeRole(id, role),
    onSuccess:  () => { toast.success('Role updated'); invalidate(); },
    onError:    (e) => toast.error(e.response?.data?.message || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: adminService.deleteUser,
    onSuccess:  () => { toast.success('User deleted'); invalidate(); },
    onError:    (e) => toast.error(e.response?.data?.message || 'Error'),
  });

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Header ──────────────────────────────────────────── */}
      <PageHeader
        title="User management"
        subtitle={`${total} user${total !== 1 ? 's' : ''} registered on the platform`}
      />

      {/* ── Search + filter bar ─────────────────────────────── */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           'var(--space-2)',
        background:    'var(--bg-card)',
        borderRadius:  'var(--radius-molecular)',
        padding:       'var(--space-3)',
        boxShadow:     'var(--shadow-sm)',
      }}>
        <div style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '6px',
        }}>
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{
            color:      'var(--text-secondary)',
            fontSize:   'var(--text-sm)',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
          }}>
            Filters
          </span>
        </div>

        <div style={{
          display:  'flex',
          gap:      '8px',
          flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={13} style={{
              position:  'absolute',
              left:      '12px',
              top:       '50%',
              transform: 'translateY(-50%)',
              color:     'var(--text-muted)',
              pointerEvents: 'none',
            }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email…"
              className="input-base"
              style={{ paddingLeft: '34px' }}
            />
          </div>

          {/* Role filter */}
          <select
            value={role}
            onChange={e => { setRole(e.target.value); setPage(1); }}
            className="input-base"
            style={{
              width:     'auto',
              minWidth:  '160px',
              cursor:    'pointer',
            }}
          >
            <option value="">All roles</option>
            <option value="student">Students</option>
            <option value="lecturer">Lecturers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* ── Users table ─────────────────────────────────────── */}
      <div style={{
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-molecular)',
        overflow:     'hidden',
        boxShadow:    'var(--shadow-md)',
      }}>

        {/* Column headers */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: '1.5fr 1.5fr auto auto auto',
          gap:                 'var(--space-3)',
          padding:             '10px var(--space-3)',
          borderBottom:        '1px solid var(--border)',
          background:          'var(--bg-raised)',
        }}>
          {['User', 'Email', 'Role', 'Status', 'Actions'].map(h => (
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

        {/* Body */}
        {isLoading ? (
          <div style={{ padding: 'var(--space-2)' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="shimmer"
                style={{
                  height:       '56px',
                  borderRadius: 'var(--radius-atomic)',
                  margin:       '6px 0',
                }}
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState />
        ) : (
          <AnimatedList>
            <AnimatePresence initial={false}>
              {users.map((u, i) => (
                <AnimatedItem key={u.id} layout>
                  <UserRow
                    user={u}
                    isLast={i === users.length - 1}
                    onToggle={() => toggleMut.mutate(u.id)}
                    onRoleChange={(newRole) =>
                      roleMut.mutate({ id: u.id, role: newRole })
                    }
                    onDelete={() => {
                      if (confirm(`Permanently delete ${u.name}?\n\nThis removes all their enrolments, attendance records, and appeals. This cannot be undone.`)) {
                        deleteMut.mutate(u.id);
                      }
                    }}
                    isToggling={toggleMut.isPending}
                    isDeleting={deleteMut.isPending}
                  />
                </AnimatedItem>
              ))}
            </AnimatePresence>
          </AnimatedList>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          onGoTo={setPage}
        />
      )}
    </PageShell>
  );
}

// ─── User row ──────────────────────────────────────────────────
function UserRow({
  user: u, isLast,
  onToggle, onRoleChange, onDelete,
  isToggling, isDeleting,
}) {
  const roleStyle = ROLE_STYLES[u.role] ?? ROLE_STYLES.student;

  return (
    <motion.div
      animate={{
        backgroundColor: u.is_active ? 'transparent' : 'var(--red-bg)',
      }}
      transition={{ duration: DURATION.medium, ease: EASE.state }}
      style={{
        display:             'grid',
        gridTemplateColumns: '1.5fr 1.5fr auto auto auto',
        gap:                 'var(--space-3)',
        padding:             '10px var(--space-3)',
        alignItems:          'center',
        borderBottom:        isLast ? 'none' : '1px solid var(--border)',
        opacity:             u.is_active ? 1 : 0.75,
      }}
    >
      {/* Name + avatar */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        'var(--space-2)',
        minWidth:   0,
      }}>
        <motion.div
          animate={{
            backgroundColor: roleStyle.bg,
            borderColor:     roleStyle.border,
            color:           roleStyle.color,
          }}
          transition={{ duration: DURATION.base, ease: EASE.state }}
          style={{
            width:          '34px',
            height:         '34px',
            borderRadius:   'var(--radius-atomic)',
            border:         '1px solid',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontFamily:     'var(--font-display)',
            fontWeight:     700,
            fontSize:       'var(--text-sm)',
            flexShrink:     0,
          }}
        >
          {u.name?.[0]?.toUpperCase() ?? '?'}
        </motion.div>
        <p style={{
          color:        'var(--text-primary)',
          fontWeight:   600,
          fontSize:     'var(--text-sm)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {u.name}
        </p>
      </div>

      {/* Email */}
      <p style={{
        color:        'var(--text-muted)',
        fontSize:     'var(--text-xs)',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
        fontFamily:   'var(--font-mono)',
      }}>
        {u.email}
      </p>

      {/* Role selector (doubles as coloured pill) */}
      <motion.select
        value={u.role}
        onChange={e => onRoleChange(e.target.value)}
        animate={{
          backgroundColor: roleStyle.bg,
          borderColor:     roleStyle.border,
          color:           roleStyle.color,
        }}
        transition={{ duration: DURATION.base, ease: EASE.state }}
        style={{
          border:        '1px solid',
          borderRadius:  'var(--radius-pill)',
          padding:       '4px 12px',
          fontSize:      'var(--text-xs)',
          fontWeight:    700,
          cursor:        'pointer',
          outline:       'none',
          textTransform: 'capitalize',
          fontFamily:    'var(--font-body)',
        }}
      >
        <option value="student">Student</option>
        <option value="lecturer">Lecturer</option>
        <option value="admin">Admin</option>
      </motion.select>

      {/* Active status */}
      <motion.span
        animate={{
          backgroundColor: u.is_active ? 'var(--green-bg)'     : 'var(--red-bg)',
          borderColor:     u.is_active ? 'var(--green-border)' : 'var(--red-border)',
          color:           u.is_active ? 'var(--green)'        : 'var(--red)',
        }}
        transition={{ duration: DURATION.base, ease: EASE.state }}
        style={{
          padding:      '3px 10px',
          borderRadius: 'var(--radius-pill)',
          border:       '1px solid',
          fontSize:     '10px',
          fontWeight:   700,
          textTransform:'uppercase',
          letterSpacing:'0.06em',
          whiteSpace:   'nowrap',
        }}
      >
        {u.is_active ? 'Active' : 'Inactive'}
      </motion.span>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <IconButton
          icon={u.is_active ? UserX : UserCheck}
          title={u.is_active ? 'Deactivate user' : 'Activate user'}
          onClick={onToggle}
          disabled={isToggling}
          tone={u.is_active ? 'danger' : 'success'}
        />
        <IconButton
          icon={Trash2}
          title="Delete user permanently"
          onClick={onDelete}
          disabled={isDeleting}
          tone="danger"
        />
      </div>
    </motion.div>
  );
}

// ─── Icon button with tone variants ───────────────────────────
function IconButton({ icon: Icon, title, onClick, disabled, tone }) {
  const toneStyles = {
    success: {
      bg:         'var(--green-bg)',
      border:     'var(--green-border)',
      color:      'var(--green)',
      hoverBg:    'rgba(16,185,129,0.22)',
    },
    danger: {
      bg:         'var(--red-bg)',
      border:     'var(--red-border)',
      color:      'var(--red)',
      hoverBg:    'rgba(239,68,68,0.22)',
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
      aria-label={title}
      style={{
        width:          '32px',
        height:         '32px',
        borderRadius:   'var(--radius-atomic)',
        background:     toneStyles.bg,
        border:         `1px solid ${toneStyles.border}`,
        cursor:         disabled ? 'not-allowed' : 'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        color:          toneStyles.color,
        opacity:        disabled ? 0.5 : 1,
        transition:     `background ${DURATION.base}ms ${EASE.state}`,
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = toneStyles.hoverBg;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = toneStyles.bg;
      }}
    >
      <Icon size={13} strokeWidth={2.2} />
    </motion.button>
  );
}

// ─── Empty state ───────────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.snappy}
      style={{
        padding:        'var(--space-6) var(--space-3)',
        textAlign:      'center',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: DURATION.slow, ease: EASE.bounce, delay: 0.1 }}
        style={{
          width:          '56px',
          height:         '56px',
          borderRadius:   'var(--radius-molecular)',
          background:     'var(--bg-raised)',
          border:         '1px solid var(--border)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          marginBottom:   'var(--space-2)',
        }}
      >
        <UsersIcon size={22} style={{ color: 'var(--text-muted)' }} />
      </motion.div>
      <p style={{
        color:      'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize:   'var(--text-md)',
      }}>
        No users found
      </p>
      <p style={{
        color:     'var(--text-muted)',
        fontSize:  'var(--text-sm)',
        marginTop: '4px',
        maxWidth:  '320px',
      }}>
        Try adjusting your search or clearing the role filter.
      </p>
    </motion.div>
  );
}

// ─── Pagination ────────────────────────────────────────────────
function Pagination({ page, totalPages, total, onPrev, onNext, onGoTo }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1))
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '6px',
      paddingTop:     'var(--space-2)',
      flexWrap:       'wrap',
    }}>
      <motion.button
        whileTap={TAP.button}
        onClick={onPrev}
        disabled={page === 1}
        className="btn-ghost"
        style={{
          padding: '8px 10px',
          opacity: page === 1 ? 0.4 : 1,
        }}
      >
        <ChevronLeft size={15} />
      </motion.button>

      <div style={{ display: 'flex', gap: '4px', position: 'relative' }}>
        {pages.map((p, i) =>
          p === '...' ? (
            <span
              key={`e-${i}`}
              style={{
                padding:  '8px 4px',
                color:    'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              …
            </span>
          ) : (
            <motion.button
              key={p}
              whileTap={TAP.button}
              onClick={() => onGoTo(p)}
              style={{
                position:     'relative',
                width:        '36px',
                height:       '36px',
                borderRadius: 'var(--radius-atomic)',
                border:       'none',
                background:   'transparent',
                color:        p === page ? 'var(--violet)' : 'var(--text-secondary)',
                fontWeight:   p === page ? 700 : 500,
                fontSize:     'var(--text-sm)',
                fontFamily:   'var(--font-mono)',
                cursor:       'pointer',
              }}
            >
              {p === page && (
                <motion.div
                  layoutId="users-page-active"
                  transition={SPRING.gentle}
                  style={{
                    position:     'absolute',
                    inset:        0,
                    background:   'var(--violet-bg)',
                    border:       '1px solid var(--violet-border)',
                    borderRadius: 'var(--radius-atomic)',
                    zIndex:       0,
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{p}</span>
            </motion.button>
          )
        )}
      </div>

      <motion.button
        whileTap={TAP.button}
        onClick={onNext}
        disabled={page === totalPages}
        className="btn-ghost"
        style={{
          padding: '8px 10px',
          opacity: page === totalPages ? 0.4 : 1,
        }}
      >
        <ChevronRight size={15} />
      </motion.button>

      <span style={{
        color:      'var(--text-muted)',
        fontSize:   'var(--text-xs)',
        marginLeft: 'var(--space-2)',
        fontFamily: 'var(--font-mono)',
      }}>
        Page {page} of {totalPages} · {total} total
      </span>
    </div>
  );
}