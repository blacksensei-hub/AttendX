// client/src/components/layout/AppShell.jsx
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  NavLink, Outlet, useLocation, useNavigate, ScrollRestoration,
}                                            from 'react-router-dom';
import { motion, AnimatePresence }           from 'framer-motion';
import { Menu, X, LogOut, Sun, Moon, ChevronDown, Search } from 'lucide-react';
import { useQuery }                          from '@tanstack/react-query';
import toast                                 from 'react-hot-toast';

import BrandMark                             from '../ui/BrandMark';
import NotificationPanel                     from '../ui/NotificationPanel';
import NetworkBanner                         from '../NetworkBanner';
import ImpersonationBanner                   from '../ImpersonationBanner';
import { useAuthStore }                      from '../../store/authStore';
import { useUIStore }                        from '../../store/uiStore';
import { prefetchRoute }                     from '../../router/prefetch';
import { useScrolledPast }                   from '../../hooks/useScrolledPast';
import { consoleApi }                        from '../../services/consoleService';
import { useCommandPaletteHotkey }           from '../console/format';
import { ADMIN_NAV }                         from './adminNav';
import { shortName }                         from '../../lib/names';
import '../console/console.css';
import '../teaching/teaching.css';

// cmdk and the palette only load the first time an admin opens it.
const CommandPalette = lazy(() => import('../console/CommandPalette'));
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
 * Once the page scrolls, the bar lifts into a centred floating pill,
 * the same move the landing nav makes (styles: .app-nav in App.css).
 *
 * Admins get the console (Look B, design-system/attendx/pages/
 * admin-console.md): its own theme, grouped nav menus from adminNav.js,
 * and a Ctrl/Cmd+K command palette.
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
    { label: 'Timetable', to: '/lecturer/timetable' },
    { label: 'Live',      to: '/lecturer/sessions' },
    { label: 'Requests',  to: '/lecturer/requests', badgeKey: 'requests' },
    { label: 'Alerts',    to: '/lecturer/alerts' },
    { label: 'Reports',   to: '/lecturer/reports' },
  ],
  student: [
    { label: 'Dashboard',  to: '/student' },
    { label: 'Scan',       to: '/student/scan' },
    { label: 'Classes',    to: '/student/classes' },
    { label: 'Timetable',  to: '/student/timetable' },
    { label: 'History',    to: '/student/history' },
    { label: 'Requests',   to: '/student/requests' },
  ],
  admin: ADMIN_NAV,
};

const RAIL_BREAKPOINT = '(min-width: 1100px)';
const noop = () => {};

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
  const isConsole     = role === 'admin';
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Stays mounted after the first open so its exit animation can play.
  const [paletteMounted, setPaletteMounted] = useState(false);
  const setPalette = (next) => { setPaletteMounted(true); setPaletteOpen(next); };
  const setInConsole  = useUIStore(s => s.setInConsole);
  // Pill once scrolled, but never under the open full-screen menu,
  // whose panel starts right below the bar.
  const pill          = useScrolledPast(16) && !open;

  usePauseWhenHidden();

  // While the admin console is mounted, App.jsx applies its theme.
  useEffect(() => {
    if (!isConsole) return undefined;
    setInConsole(true);
    return () => setInConsole(false);
  }, [isConsole, setInConsole]);

  useCommandPaletteHotkey(isConsole ? setPalette : noop);

  // Lock page scroll behind the open menu. On <html>, not <body>: html
  // carries overflow-x: clip, so an overflow on body would make body its
  // own scroll box and the sticky top bar (with the close button) would
  // scroll away with the page.
  useEffect(() => {
    const root = document.documentElement;
    root.style.overflow = open ? 'hidden' : '';
    return () => { root.style.overflow = ''; };
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
  const { data: excuseData } = useQuery({
    queryKey:        ['lecturer-excuse-count'],
    queryFn:         () => api.get('/teaching/excuses', { params: { status: 'pending' } }).then(r => r.data),
    refetchInterval: 60_000,
    enabled:         role === 'lecturer',
  });
  const { data: flagData } = useQuery({
    queryKey:        ['admin-flag-count'],
    queryFn:         () => consoleApi.fraud({ summary: 1 }),
    refetchInterval: 60_000,
    enabled:         isConsole,
  });
  const badges = {
    requests: (appealsData?.pendingCount ?? 0) + (excuseData?.counts?.pending ?? 0),
    flags:    flagData?.counts?.open ?? 0,
  };

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  return (
    <div className={isConsole ? 'console' : undefined}
         style={{ position: 'relative', minHeight: '100dvh', width: '100%', ...(isConsole ? { background: 'var(--bg)' } : null) }}>
      {isConsole
        ? <div className="console-grid" aria-hidden="true" />
        : <div className="env-layer" aria-hidden="true" />}
      <NetworkBanner />
      <ImpersonationBanner />
      <ScrollRestoration />

      <a href="#main" className="skip-link" style={skipLinkStyle}
         onFocus={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
         onBlur={e  => { e.currentTarget.style.transform = 'translateY(-150%)'; }}>
        Skip to content
      </a>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className={`app-nav${pill ? ' is-compact' : ''}`}>
        <div className="app-nav-bar">
          <NavLink to={items[0].to} aria-label="AttendX home" className="app-nav-logo">
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
            {isConsole && (
              <button type="button" className="icon-btn" onClick={() => setPalette(true)}
                      aria-label="Search and commands (Ctrl+K)" title="Search and commands (Ctrl+K)"
                      style={wide ? { width: 'auto', padding: '0 8px 0 10px', gap: 8, borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center' } : { borderRadius: 'var(--radius-pill)', width: 38, height: 38 }}>
                <Search size={15} />
                {wide && <span className="kbd">Ctrl K</span>}
              </button>
            )}
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

      {isConsole && paletteMounted && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </Suspense>
      )}

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
      {items.map(item => (item.items
        ? <NavGroup key={item.label} group={item} badges={badges} />
        : <RailLink key={item.to} item={item} badges={badges} />))}
    </div>
  );
}

const railActive = {
  position:     'absolute',
  inset:        0,
  borderRadius: 'var(--radius-pill)',
  background:   'var(--bg-card)',
  boxShadow:    'var(--shadow-sm)',
};
const railItem = {
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
  cursor:         'pointer',
};

function RailLink({ item, badges }) {
  const count = item.badgeKey ? badges[item.badgeKey] || 0 : 0;
  return (
    <NavLink
      to={item.to}
      end
      onMouseEnter={() => prefetchRoute(item.to)}
      onFocus={() => prefetchRoute(item.to)}
      style={railItem}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="rail-active" transition={SPRING.gentle} style={railActive} />
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
}

/**
 * A nav group (People, Teaching, ...) with a menu of its pages. Opens
 * on hover after a short intent delay, on click, or on Enter/Space;
 * closes on Escape, outside click, leaving it, or navigating. The
 * sliding highlight is shared with plain links, so it moves to the
 * group whenever one of its pages is open.
 */
function NavGroup({ group, badges }) {
  const { pathname } = useLocation();
  // Remembers the path it opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState(null);
  const open   = openAt === pathname;
  const ref    = useRef(null);
  const timer  = useRef(null);
  const active = group.items.some(i => pathname === i.to || pathname.startsWith(`${i.to}/`));
  const count  = group.items.reduce((n, i) => n + (i.badgeKey ? badges[i.badgeKey] || 0 : 0), 0);

  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpenAt(pathname), 90); };
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpenAt(null), 160); };
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = e => { if (!ref.current?.contains(e.target)) setOpenAt(null); };
    const onKey  = e => { if (e.key === 'Escape') setOpenAt(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }} onPointerEnter={e => e.pointerType === 'mouse' && show()} onPointerLeave={e => e.pointerType === 'mouse' && hide()}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpenAt(o => (o === pathname ? null : pathname))}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpenAt(pathname);
            requestAnimationFrame(() => ref.current?.querySelector('.navmenu a')?.focus());
          }
        }}
        style={{ ...railItem, background: 'transparent', border: 0, fontFamily: 'inherit' }}
      >
        {active && <motion.span layoutId="rail-active" transition={SPRING.gentle} style={railActive} />}
        <span style={{ position: 'relative', color: active || open ? 'var(--text-primary)' : 'var(--text-subtle)', transition: 'color var(--duration-base) var(--ease-state)' }}>
          {group.label}
        </span>
        {count > 0 && <CountBadge n={count} />}
        <ChevronDown size={13} style={{ position: 'relative', color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--duration-base) var(--ease-state)' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="navmenu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={SPRING.snappy}
            style={{ transformOrigin: 'top center' }}
          >
            {group.items.map(i => {
              const n = i.badgeKey ? badges[i.badgeKey] || 0 : 0;
              return (
                <NavLink key={i.to} to={i.to} end className={({ isActive }) => (isActive ? 'active' : undefined)}
                         onMouseEnter={() => prefetchRoute(i.to)} onFocus={() => prefetchRoute(i.to)}>
                  <span className="nm-icon"><i.icon size={15} aria-hidden="true" /></span>
                  <span className="nm-label">
                    {i.label}
                    {n > 0 && <span style={{ marginLeft: 8, verticalAlign: 'middle' }}><CountBadge n={n} /></span>}
                  </span>
                  <span className="nm-desc">{i.desc}</span>
                </NavLink>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
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

// Groups become a heading followed by their pages, numbered straight
// through, for the full-screen menu.
function flattenNav(items) {
  let n = 0;
  return items.flatMap(item => (item.items
    ? [{ heading: item.label }, ...item.items.map(i => ({ ...i, n: ++n }))]
    : [{ ...item, n: ++n }]));
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
        {flattenNav(items).map((item, i) => {
          if (item.heading) {
            return (
              <p key={`h-${item.heading}`} className="kicker" style={{ marginTop: i ? 22 : 0, marginBottom: 2 }}>
                {item.heading}
              </p>
            );
          }
          const count = item.badgeKey ? badges[item.badgeKey] || 0 : 0;
          const grouped = items.some(it => it.items);
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
                      {String(item.n).padStart(2, '0')}
                    </span>
                    <span style={{
                      fontFamily:    'var(--font-display)',
                      fontWeight:    650,
                      fontSize:      grouped ? 'clamp(22px, 6vw, 30px)' : 'clamp(30px, 8vw, 44px)',
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
            {shortName(user?.name)}
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

// The theme in effect here: the console's own inside the admin console.
function useActiveTheme() {
  const inConsole = useUIStore(s => s.inConsole);
  const theme     = useUIStore(s => (s.inConsole ? s.consoleTheme : s.theme));
  const toggle    = useUIStore(s => s.toggleTheme);
  const toggleC   = useUIStore(s => s.toggleConsoleTheme);
  return { theme, toggleTheme: inConsole ? toggleC : toggle };
}

function ThemeRow() {
  const { theme, toggleTheme } = useActiveTheme();
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
  const { theme, toggleTheme } = useActiveTheme();
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
