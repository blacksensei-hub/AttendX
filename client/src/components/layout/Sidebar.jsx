// client/src/components/layout/Sidebar.jsx
import { useEffect, useState }       from 'react';
import { NavLink, useNavigate,
         useLocation }               from 'react-router-dom';
import { motion, AnimatePresence }   from 'framer-motion';
import {
  LayoutDashboard, BookOpen, BarChart3,
  LogOut, Radio, MessageSquare, AlertTriangle,
  PanelLeftClose, PanelLeftOpen, X, GraduationCap,
}                                    from 'lucide-react';
import { useQuery }                  from '@tanstack/react-query';
import toast                         from 'react-hot-toast';

import { useAuthStore }              from '../../store/authStore';
import { useIsMobile }               from '../../hooks/useIsMobile';
import api                           from '../../services/api';
import ThemeToggle                   from '../ui/ThemeToggle';
import { prefetchRoute }             from '../../router/prefetch';
import { EASE, DURATION, SPRING, TAP } from '../../lib/motion';

const SIDEBAR_WIDTH_EXPANDED  = 240;
const SIDEBAR_WIDTH_COLLAPSED = 72;

const LECTURER_NAV = [
  { label: 'Dashboard',    to: '/lecturer',             icon: LayoutDashboard },
  { label: 'Classes',      to: '/lecturer/classes',     icon: BookOpen        },
  { label: 'Live Sessions',to: '/lecturer/sessions',    icon: Radio           },
  { label: 'Performance',  to: '/lecturer/performance', icon: GraduationCap   },
  { label: 'Appeals',      to: '/lecturer/appeals',     icon: MessageSquare, badgeKey: 'appeals' },
  { label: 'Alerts',       to: '/lecturer/alerts',      icon: AlertTriangle   },
  { label: 'Reports',      to: '/lecturer/reports',     icon: BarChart3       },
];

const STUDENT_NAV = [
  { label: 'Dashboard',  to: '/student',         icon: LayoutDashboard },
  { label: 'My Classes', to: '/student/classes', icon: BookOpen        },
  { label: 'History',    to: '/student/history', icon: BarChart3       },
];

function SidebarContent({ collapsed, onToggleCollapse, onClose, isMobile, navItems, badges, user, onLogout }) {
  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 'var(--space-2)', padding: '0 var(--space-3)',
        height: '64px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: DURATION.fast, ease: EASE.state }}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}
            >
              <div style={{ width: '32px', height: '32px', background: 'var(--brand)', borderRadius: 'var(--radius-atomic)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)', flexShrink: 0 }}>A</div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>AttendX</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isMobile ? (
          <motion.button whileTap={TAP.button} onClick={onClose} aria-label="Close menu"
            style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-atomic)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <X size={18} />
          </motion.button>
        ) : (
          <motion.button whileTap={TAP.button} whileHover={{ backgroundColor: 'var(--bg-hover)' }} transition={{ duration: DURATION.base, ease: EASE.state }} onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-atomic)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={collapsed ? 'open' : 'close'} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: DURATION.fast, ease: EASE.state }} style={{ display: 'flex', alignItems: 'center' }}>
                {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </motion.div>
            </AnimatePresence>
          </motion.button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'visible' }}>
        {navItems.map(({ label, to, icon: Icon, badgeKey }) => {
          const badgeCount = badgeKey ? (badges[badgeKey] || 0) : 0;
          return <NavItem key={to} to={to} icon={Icon} label={label} badgeCount={badgeCount} collapsed={!isMobile && collapsed} />;
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: 'var(--space-2)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {(!isMobile && collapsed)
          ? <CollapsedFooter user={user} onLogout={onLogout} />
          : <ExpandedFooter  user={user} onLogout={onLogout} />
        }
      </div>
    </>
  );
}

export default function Sidebar({ mobileOpen = false, onClose }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout, isLecturer } = useAuthStore();
  const navigate = useNavigate();
  const lecturer = isLecturer();
  const navItems = lecturer ? LECTURER_NAV : STUDENT_NAV;

  useEffect(() => { if (isMobile && mobileOpen) onClose?.(); }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && mobileOpen) onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen, onClose]);

  const { data: appealsData } = useQuery({
    queryKey: ['lecturer-appeals-count'],
    queryFn:  () => api.get('/appeals/lecturer').then(r => r.data),
    refetchInterval: 60_000,
    enabled: lecturer,
  });
  const pendingAppeals = appealsData?.pendingCount ?? 0;
  const badges = { appeals: pendingAppeals };

  const handleLogout = () => { logout(); toast.success('Signed out'); navigate('/login', { replace: true }); };

  const contentProps = { collapsed, isMobile, navItems, badges, user, onToggleCollapse: () => setCollapsed(c => !c), onClose, onLogout: handleLogout };

  if (isMobile) {
    return (
      <>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div key="sidebar-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DURATION.fast }} onClick={onClose}
              style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 49, backdropFilter: 'blur(4px)' }} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {mobileOpen && (
            <motion.aside key="mobile-sidebar" initial={{ x: -SIDEBAR_WIDTH_EXPANDED }} animate={{ x: 0 }} exit={{ x: -SIDEBAR_WIDTH_EXPANDED }} transition={SPRING.gentle}
              style={{ position: 'fixed', top: 0, left: 0, height: '100dvh', width: SIDEBAR_WIDTH_EXPANDED, zIndex: 50, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
              <SidebarContent {...contentProps} />
            </motion.aside>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1, width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      transition={{ x: { duration: DURATION.slow, ease: EASE.entry }, opacity: { duration: DURATION.slow, ease: EASE.entry }, width: SPRING.gentle }}
      style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', overflow: 'hidden', transition: `background-color ${DURATION.medium}ms ${EASE.state}` }}
    >
      <SidebarContent {...contentProps} />
    </motion.aside>
  );
}

function ExpandedFooter({ user, onLogout }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '10px 12px', borderRadius: 'var(--radius-atomic)' }}>
        <div style={{ width: '28px', height: '28px', background: 'var(--brand-subtle)', borderRadius: 'var(--radius-atomic)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--brand-text)', flexShrink: 0 }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{user?.name}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'capitalize', letterSpacing: '0.04em' }}>{user?.role}</p>
        </div>
        <ThemeToggle />
      </div>
      <motion.button whileTap={TAP.button} whileHover={{ backgroundColor: 'var(--red-bg)', color: 'var(--red)' }} transition={{ duration: DURATION.base, ease: EASE.state }} onClick={onLogout}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '10px 12px', borderRadius: 'var(--radius-atomic)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', fontFamily: 'var(--font-body)' }}>
        <LogOut size={16} />
        Sign out
      </motion.button>
    </>
  );
}

function CollapsedFooter({ user, onLogout }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div title={user?.name} style={{ width: '32px', height: '32px', background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-atomic)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--brand-text)', fontFamily: 'var(--font-display)' }}>
        {user?.name?.[0]?.toUpperCase()}
      </div>
      <ThemeToggle />
      <CollapsedActionButton onClick={onLogout} icon={LogOut} label="Sign out" tone="danger" />
    </div>
  );
}

function CollapsedActionButton({ onClick, icon: Icon, label, tone }) {
  const [hovered, setHovered] = useState(false);
  const danger = tone === 'danger';
  return (
    <div style={{ position: 'relative', display: 'flex' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <motion.button whileTap={TAP.button} onClick={onClick} aria-label={label}
        style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-atomic)', background: hovered && danger ? 'var(--red-bg)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hovered && danger ? 'var(--red)' : 'var(--text-muted)', transition: `background ${DURATION.fast}ms ${EASE.state}, color ${DURATION.fast}ms ${EASE.state}` }}>
        <Icon size={16} />
      </motion.button>
      <AnimatePresence>{hovered && <Tooltip label={label} />}</AnimatePresence>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, badgeCount, collapsed }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <NavLink to={to} end
        onMouseEnter={() => { setHovered(true); prefetchRoute(to); }}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => prefetchRoute(to)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 'var(--space-2)', padding: collapsed ? '10px 0' : '10px 12px', borderRadius: 'var(--radius-atomic)', fontSize: 'var(--text-sm)', textDecoration: 'none', position: 'relative', transition: `color ${DURATION.base}ms ${EASE.state}`, color: 'var(--text-secondary)' }}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.div layoutId="sidebar-active" transition={SPRING.gentle}
                style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-atomic)', background: 'var(--brand-subtle)', borderLeft: '2px solid var(--brand)', zIndex: 0 }} />
            )}
            <span style={{ display: 'flex', alignItems: 'center', color: isActive ? 'var(--brand-text)' : 'var(--text-muted)', position: 'relative', zIndex: 1, flexShrink: 0, transition: `color ${DURATION.base}ms ${EASE.state}` }}>
              <Icon size={17} />
            </span>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: DURATION.fast, ease: EASE.state }}
                  style={{ flex: 1, position: 'relative', zIndex: 1, color: isActive ? 'var(--brand-text)' : 'var(--text-secondary)', fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap', transition: `color ${DURATION.base}ms ${EASE.state}` }}>
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
            {badgeCount > 0 && (collapsed ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.bounce}
                style={{ position: 'absolute', top: '6px', right: '10px', width: '8px', height: '8px', background: 'var(--red)', borderRadius: 'var(--radius-pill)', boxShadow: '0 0 0 2px var(--sidebar-bg)', zIndex: 2 }} />
            ) : (
              <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.bounce}
                style={{ position: 'relative', zIndex: 1, background: 'var(--red)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '10px', fontWeight: 700, padding: '1px 7px', minWidth: '20px', textAlign: 'center', lineHeight: '18px', boxShadow: '0 0 0 2px var(--sidebar-bg)' }}>
                {badgeCount > 9 ? '9+' : badgeCount}
              </motion.span>
            ))}
          </>
        )}
      </NavLink>
      <AnimatePresence>{collapsed && hovered && <Tooltip label={label} badgeCount={badgeCount} />}</AnimatePresence>
    </div>
  );
}

function Tooltip({ label, badgeCount }) {
  return (
    <motion.div initial={{ opacity: 0, x: -6, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -6, scale: 0.95 }} transition={{ duration: DURATION.fast, ease: EASE.state }}
      style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-atomic)', padding: '6px 12px', boxShadow: 'var(--shadow-md)', whiteSpace: 'nowrap', zIndex: 100, fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-primary)', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {label}
      {badgeCount > 0 && (
        <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 'var(--radius-pill)', fontSize: '9px', fontWeight: 700, padding: '1px 6px', minWidth: '16px', textAlign: 'center', lineHeight: '14px' }}>
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </motion.div>
  );
}