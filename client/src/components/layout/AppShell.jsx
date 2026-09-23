// client/src/components/layout/AppShell.jsx
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  NavLink, Outlet, useLocation, useNavigate, ScrollRestoration,
}                                            from 'react-router-dom';
import { motion, AnimatePresence }           from 'framer-motion';
import { Menu, X, LogOut, Sun, Moon, ChevronDown } from 'lucide-react';
import { useQuery }                          from '@tanstack/react-query';
import toast                                 from 'react-hot-toast';

import BrandMark                             from '../ui/BrandMark';
import NotificationPanel                     from '../ui/NotificationPanel';
import NetworkBanner                         from '../NetworkBanner';
import ImpersonationBanner                   from '../ImpersonationBanner';
import { useAuthStore }                      from '../../store/authStore';
import { useUIStore }                        from '../../store/uiStore';
import { prefetchRoute }                     from '../../router/prefetch';
import api                                   from '../../services/api';
import { EASE, SPRING, TAP }                 from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AppShell — the Roll Call chrome shared by every signed-in role.
 *
 * A single sticky top bar replaces the old sidebar + topbar pair:
 *   left    the vector BrandMark
 *   centre  the role's nav as a segmented rail (≥ 1100px)
 *   right   notifications, theme, and a user menu with sign out
 *
 * Under 1100px the rail folds into a full-screen menu set in big
 * numbered display type ("01 Dashboard").
 *
 * The page scrolls with the window (not an inner overflow box), so
 * ScrollRestoration puts every new route back at the top.
 * ═════════════════════════════════════════════════════════════════
 */

const NAV = {
  lecturer: [
    { label: 'Dashboard', to: '/lecturer' },
    { label: 'Classes',   to: '/lecturer/classes' },
    { label: 'Live',      to: '/lecturer/sessions' },
    { label: 'Appeals',   to: '/lecturer/appeals', badgeKey: 'appeals' },
    { label: 'Alerts',    to: '/lecturer/alerts' },
    { label: 'Reports',   to: '/lecturer/reports' },
  ],
  student: [
    { label: 'Dashboard',  to: '/student' },
    { label: 'Scan',       to: '/student/scan' },
    { label: 'My classes', to: '/student/classes' },
    { label: 'History',    to: '/student/history' },
  ],
  admin: [
    { label: 'Overview', to: '/admin' },
    { label: 'Users',    to: '/admin/users' },
    { label: 'Classes',  to: '/admin/classes' },
    { label: 'Sessions', to: '/admin/sessions' },
    { label: 'At-risk',  to: '/admin/at-risk' },
    { label: 'Heatmap',  to: '/admin/heatmap' },
    { label: 'Audit',    to: '/admin/audit' },
  ],
};

const RAIL_BREAKPOINT = '(min-width: 1100px)';

function useWideRail() {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(RAIL_BREAKPOINT).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(RAIL_BREAKPOINT);
    const on = e => setWide(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

// Pause every CSS loop while the tab is hidden (see App.css).
function usePauseWhenHidden() {
  useEffect(() => {
    const on = () => document.body.classList.toggle('paused', document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
}

export default function AppShell({ role }) {
  const wide          = useWideRail();
  const { pathname }  = useLocation();
  // The menu remembers the path it was opened on, so navigating
  // anywhere closes it without an effect.
  const [openAt, setOpenAt] = useState(null);
  const open          = openAt === pathname && !wide;
  const setOpen       = next => setOpenAt(prev => {
    const isOpen = prev === pathname;
    const want   = typeof next === 'function' ? next(isOpen) : next;
    return want ? pathname : null;
  });
  const { user, logout } = useAuthStore();
  const navigate      = useNavigate();
  const items         = NAV[role] ?? NAV.student;

  usePauseWhenHidden();

  // Lock page scroll behind the open menu
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setOpenAt(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { data: appealsData } = useQuery({
    queryKey:        ['lecturer-appeals-count'],
    queryFn:         () => api.get('/appeals/lecturer').then(r => r.data),
    refetchInterval: 60_000,
    enabled:         role === 'lecturer',
  });
  const badges = { appeals: appealsData?.pendingCount ?? 0 };

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', width: '100%' }}>
      <div className="env-layer" aria-hidden="true" />
      <NetworkBanner />
      <ImpersonationBanner />
      <ScrollRestoration />

      <a href="#main" className="skip-link" style={skipLinkStyle}
         onFocus={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
         onBlur={e  => { e.currentTarget.style.transform = 'translateY(-150%)'; }}>
        Skip to content
      </a>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header style={{
        position:             'sticky',
        top:                  0,
        zIndex:               40,
        height:               68,
        display:              'flex',
        alignItems:           'center',
        gap:                  16,
        padding:              '0 clamp(16px, 3vw, 40px)',
        background:           'var(--topbar-bg)',
        backdropFilter:       'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        borderBottom:         '1px solid var(--border)',
      }}>
        <NavLink
          to={items[0].to}
          aria-label="AttendX home"
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', minWidth: 0 }}
        >
          <BrandMark size={30} suffix={role === 'admin' ? 'Admin' : undefined} />
        </NavLink>

        {wide && (
          <nav aria-label="Main" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <Rail items={items} badges={badges} />
          </nav>
        )}

        <div style={{
          marginLeft: wide ? 0 : 'auto',
          display:    'flex',
          alignItems: 'center',
          gap:        8,
          flexShrink: 0,
        }}>
          {role !== 'admin' && <NotificationPanel />}
          <UserMenu user={user} role={role} onLogout={handleLogout} compact={!wide} />
          {!wide && (
            <motion.button
              whileTap={TAP.button}
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-controls="app-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              style={iconButtonStyle}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </motion.button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {open && !wide && (
          <FullMenu
            items={items}
            badges={badges}
            user={user}
            role={role}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>

      {/* ── Page ────────────────────────────────────────────── */}
      <main
        id="main"
        tabIndex={-1}
        style={{
          position: 'relative',
          zIndex:   1,
          width:    '100%',
          maxWidth: 1360,
          margin:   '0 auto',
          padding:  'clamp(20px, 3.2vw, 44px) clamp(16px, 3vw, 40px) 80px',
          outline:  'none',
        }}
      >
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

// ─── Segmented rail ────────────────────────────────────────────
function Rail({ items, badges }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          2,
      padding:      4,
      borderRadius: 'var(--radius-pill)',
      background:   'var(--bg-raised)',
      boxShadow:    'inset 0 0 0 1px var(--border)',
    }}>
      {items.map(item => {
        const count = item.badgeKey ? badges[item.badgeKey] || 0 : 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onMouseEnter={() => prefetchRoute(item.to)}
            onFocus={() => prefetchRoute(item.to)}
            style={{
              position:       'relative',
              display:        'inline-flex',
              alignItems:     'center',
              gap:            6,
              padding:        '8px 16px',
              borderRadius:   'var(--radius-pill)',
              fontSize:       'var(--text-sm)',
              fontWeight:     600,
              textDecoration: 'none',
              whiteSpace:     'nowrap',
            }}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="rail-active"
                    transition={SPRING.gentle}
                    style={{
                      position:     'absolute',
                      inset:        0,
                      borderRadius: 'var(--radius-pill)',
                      background:   'var(--bg-card)',
                      boxShadow:    'var(--shadow-sm)',
                    }}
                  />
                )}
                <span style={{
                  position:   'relative',
                  color:      isActive ? 'var(--text-primary)' : 'var(--text-subtle)',
                  transition: 'color var(--duration-base) var(--ease-state)',
                }}>
                  {item.label}
                </span>
                {count > 0 && <CountBadge n={count} />}
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

function CountBadge({ n }) {
  return (
    <span style={{
      position:      'relative',
      minWidth:      18,
      height:        18,
      padding:       '0 5px',
      borderRadius:  'var(--radius-pill)',
      background:    'var(--red-fill)',
      color:         '#fff',
      fontFamily:    'var(--font-mono)',
      fontSize:      10,
      fontWeight:    600,
      lineHeight:    '18px',
      textAlign:     'center',
    }}>
      {n > 9 ? '9+' : n}
    </span>
  );
}

// ─── Full-screen menu (under 1100px) ───────────────────────────
function FullMenu({ items, badges, user, role, onLogout }) {
  return (
    <motion.div
      id="app-menu"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.24, ease: EASE.state }}
      style={{
        position:      'fixed',
        inset:         '68px 0 0 0',
        zIndex:        39,
        background:    'var(--bg)',
        display:       'flex',
        flexDirection: 'column',
        padding:       '28px clamp(16px, 5vw, 40px) 32px',
        overflowY:     'auto',
      }}
    >
      <p className="kicker" style={{ marginBottom: 18 }}>
        <span className="dot" /> Menu / {role}
      </p>
      <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, i) => {
          const count = item.badgeKey ? badges[item.badgeKey] || 0 : 0;
          return (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING.gentle, delay: 0.04 + i * 0.05 }}
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <NavLink
                to={item.to}
                end
                style={{
                  display:        'flex',
                  alignItems:     'baseline',
                  gap:            16,
                  padding:        '14px 0',
                  textDecoration: 'none',
                }}
              >
                {({ isActive }) => (
                  <>
                    <span className="kicker" style={{ width: 22 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{
                      fontFamily:    'var(--font-display)',
                      fontWeight:    650,
                      fontSize:      'clamp(30px, 8vw, 44px)',
                      letterSpacing: 'var(--tracking-display)',
                      lineHeight:    1,
                      color:         isActive ? 'var(--brand-text)' : 'var(--text-primary)',
                    }}>
                      {item.label}
                    </span>
                    {count > 0 && <CountBadge n={count} />}
                  </>
                )}
              </NavLink>
            </motion.div>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={user?.name} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name}
          </p>
          <p className="kicker" style={{ marginTop: 4 }}>{role}</p>
        </div>
        <ThemeButton />
        <button className="btn-ghost" onClick={onLogout}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </motion.div>
  );
}

// ─── User menu ─────────────────────────────────────────────────
function UserMenu({ user, role, onLogout, compact }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey  = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // On narrow screens the full menu carries identity and sign out,
  // so the chip shrinks to the theme switch alone.
  if (compact) return <ThemeButton />;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <motion.button
        whileTap={TAP.button}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          10,
          padding:      '4px 10px 4px 4px',
          borderRadius: 'var(--radius-pill)',
          background:   open ? 'var(--bg-card)' : 'transparent',
          border:       '1px solid var(--border)',
          cursor:       'pointer',
          color:        'var(--text-primary)',
          transition:   'background var(--duration-base) var(--ease-state)',
        }}
      >
        <Avatar name={user?.name} />
        <span style={{ textAlign: 'left', lineHeight: 1.15 }}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name?.split(' ')[0]}
          </span>
          <span className="kicker" style={{ fontSize: 9.5 }}>{role}</span>
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--duration-base) var(--ease-state)' }} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={SPRING.snappy}
            style={{
              position:        'absolute',
              right:           0,
              top:             'calc(100% + 10px)',
              width:           260,
              padding:         8,
              borderRadius:    'var(--radius-molecular)',
              background:      'var(--bg-card)',
              boxShadow:       'var(--shadow-lg)',
              transformOrigin: 'top right',
              zIndex:          50,
            }}
          >
            <div style={{ padding: '10px 10px 12px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </p>
            </div>
            <ThemeRow />
            <button
              role="menuitem"
              onClick={onLogout}
              style={menuItemStyle}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-bg)'; e.currentTarget.style.color = 'var(--red)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <LogOut size={15} /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeRow() {
  const { theme, toggleTheme } = useUIStore();
  const dark = theme === 'dark';
  return (
    <button
      role="menuitem"
      onClick={toggleTheme}
      style={menuItemStyle}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

function ThemeButton() {
  const { theme, toggleTheme } = useUIStore();
  const dark = theme === 'dark';
  return (
    <motion.button
      whileTap={TAP.button}
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      style={iconButtonStyle}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0,   scale: 1   }}
          exit={{    opacity: 0, rotate: 60,  scale: 0.6 }}
          transition={{ duration: 0.18, ease: EASE.state }}
          style={{ display: 'flex' }}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function Avatar({ name, size = 30 }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');
  return (
    <span style={{
      width:          size,
      height:         size,
      flexShrink:     0,
      borderRadius:   'var(--radius-pill)',
      background:     'var(--bg-inverse)',
      color:          'var(--text-inverse)',
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontFamily:     'var(--font-display)',
      fontWeight:     700,
      fontSize:       size * 0.38,
      letterSpacing:  '-0.02em',
    }}>
      {initials}
    </span>
  );
}

const iconButtonStyle = {
  width:          38,
  height:         38,
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  borderRadius:   'var(--radius-pill)',
  border:         '1px solid var(--border)',
  background:     'transparent',
  color:          'var(--text-secondary)',
  cursor:         'pointer',
  flexShrink:     0,
};

const menuItemStyle = {
  width:        '100%',
  display:      'flex',
  alignItems:   'center',
  gap:          10,
  padding:      '10px',
  borderRadius: 'var(--radius-atomic)',
  border:       'none',
  background:   'transparent',
  color:        'var(--text-secondary)',
  fontFamily:   'var(--font-body)',
  fontSize:     'var(--text-sm)',
  fontWeight:   500,
  cursor:       'pointer',
  textAlign:    'left',
};

const skipLinkStyle = {
  position:     'fixed',
  top:          8,
  left:         8,
  zIndex:       100,
  padding:      '10px 14px',
  borderRadius: 'var(--radius-atomic)',
  background:   'var(--bg-inverse)',
  color:        'var(--text-inverse)',
  fontWeight:   600,
  transform:    'translateY(-150%)',
  transition:   'transform var(--duration-base) var(--ease-entry)',
};
