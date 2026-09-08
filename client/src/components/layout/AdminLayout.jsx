// client/src/components/layout/AdminLayout.jsx
import { Suspense, useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate,
         useLocation }                   from 'react-router-dom';
import { motion, AnimatePresence }       from 'framer-motion';
import {
  LayoutDashboard, Users, BookOpen, Radio,
  LogOut, Shield, AlertTriangle, Map, Menu, X,
}                                        from 'lucide-react';
import toast                             from 'react-hot-toast';

import { useAuthStore }                  from '../../store/authStore';
import { useIsMobile }                   from '../../hooks/useIsMobile';
import ThemeToggle                       from '../ui/ThemeToggle';
import { EASE, DURATION, SPRING, TAP }   from '../../lib/motion';

const SIDEBAR_WIDTH = 240;

const NAV = [
  { label: 'Overview',   to: '/admin',          icon: LayoutDashboard },
  { label: 'Users',      to: '/admin/users',    icon: Users           },
  { label: 'Classes',    to: '/admin/classes',  icon: BookOpen        },
  { label: 'Sessions',   to: '/admin/sessions', icon: Radio           },
  { label: 'At-risk',    to: '/admin/at-risk',  icon: AlertTriangle   },
  { label: 'Heatmap',    to: '/admin/heatmap',  icon: Map             },
];

const TITLES = {
  '/admin':          'Overview',
  '/admin/users':    'User management',
  '/admin/classes':  'Class management',
  '/admin/sessions': 'Session management',
  '/admin/at-risk':  'At-risk students',
  '/admin/heatmap':  'Campus heatmap',
};

export default function AdminLayout() {
  const { user, logout }                 = useAuthStore();
  const navigate                         = useNavigate();
  const location                         = useLocation();
  const isMobile                         = useIsMobile();
  const [sidebarOpen, setSidebarOpen]    = useState(false);
  const pageTitle                        = TITLES[location.pathname] || 'Admin';

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname]);

  // Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  // Sidebar content shared between mobile overlay and desktop
  const sidebarContent = (
    <>
      {/* Brand header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-2)', padding: '0 var(--space-3)',
        height: '64px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
          <div style={{
            width: '36px', height: '36px', background: 'var(--violet)',
            borderRadius: 'var(--radius-atomic)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 8px 20px rgba(139, 92, 246, 0.35)',
          }}>
            <Shield size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
              letterSpacing: '-0.01em', lineHeight: 1.1,
            }}>AttendX</p>
            <p style={{
              color: 'var(--violet)', fontSize: '10px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginTop: '2px', fontFamily: 'var(--font-mono)',
            }}>Admin panel</p>
          </div>
        </div>
        {/* Close button on mobile */}
        {isMobile && (
          <motion.button
            whileTap={TAP.button}
            onClick={() => setSidebarOpen(false)}
            style={{
              width: '32px', height: '32px', borderRadius: 'var(--radius-atomic)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', flexShrink: 0,
            }}
          >
            <X size={18} />
          </motion.button>
        )}
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1, padding: 'var(--space-2)',
        display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        {NAV.map(({ label, to, icon: Icon }) => (
          <AdminNavItem key={to} to={to} icon={Icon} label={label} />
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: 'var(--space-2)', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: '10px 12px', borderRadius: 'var(--radius-atomic)',
        }}>
          <div style={{
            width: '28px', height: '28px', background: 'var(--violet-bg)',
            border: '1px solid var(--violet-border)', borderRadius: 'var(--radius-atomic)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--violet)', fontWeight: 700, fontSize: 'var(--text-xs)', flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              color: 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
            }}>
              {user?.name}
            </p>
            <p style={{ color: 'var(--violet)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Administrator
            </p>
          </div>
          <ThemeToggle />
        </div>
        <motion.button
          whileTap={TAP.button}
          whileHover={{ backgroundColor: 'var(--red-bg)', color: 'var(--red)' }}
          transition={{ duration: DURATION.base, ease: EASE.state }}
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: '10px 12px', borderRadius: 'var(--radius-atomic)',
            fontSize: 'var(--text-sm)', color: 'var(--text-muted)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            width: '100%', fontFamily: 'var(--font-body)',
          }}
        >
          <LogOut size={16} />
          Sign out
        </motion.button>
      </div>
    </>
  );

  return (
    <div style={{
      display: 'flex', height: '100dvh',
      overflow: 'hidden', backgroundColor: 'var(--bg)',
    }}>

      {/* ── Mobile: overlay sidebar ──────────────────────── */}
      {isMobile ? (
        <>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                key="admin-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: DURATION.fast }}
                onClick={() => setSidebarOpen(false)}
                style={{
                  position: 'fixed', inset: 0,
                  background: 'var(--bg-overlay)',
                  zIndex: 49, backdropFilter: 'blur(4px)',
                }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.aside
                key="admin-sidebar"
                initial={{ x: -SIDEBAR_WIDTH }}
                animate={{ x: 0 }}
                exit={{    x: -SIDEBAR_WIDTH }}
                transition={SPRING.gentle}
                style={{
                  position: 'fixed', top: 0, left: 0, height: '100dvh',
                  width: SIDEBAR_WIDTH, zIndex: 50,
                  display: 'flex', flexDirection: 'column',
                  backgroundColor: 'var(--sidebar-bg)',
                  borderRight: '1px solid var(--border)', overflow: 'hidden',
                }}
              >
                {sidebarContent}
              </motion.aside>
            )}
          </AnimatePresence>
        </>
      ) : (
        /* ── Desktop: static sidebar ────────────────────── */
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: DURATION.slow, ease: EASE.entry }}
          style={{
            display: 'flex', flexDirection: 'column',
            width: SIDEBAR_WIDTH, flexShrink: 0,
            backgroundColor: 'var(--sidebar-bg)',
            borderRight: '1px solid var(--border)',
            transition: `background-color ${DURATION.medium}ms ${EASE.state}`,
          }}
        >
          {sidebarContent}
        </motion.aside>
      )}

      {/* ── Main content ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{
          height: '64px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '0 var(--space-3)' : '0 var(--space-4)',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--topbar-bg)',
          position: 'sticky', top: 0, zIndex: 20,
          backdropFilter: 'blur(12px) saturate(180%)',
          gap: 'var(--space-2)',
          transition: `background-color ${DURATION.medium}ms ${EASE.state}`,
        }}>

          {/* Hamburger — mobile only */}
          {isMobile && (
            <motion.button
              whileTap={TAP.button}
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Open menu"
              style={{
                width: '36px', height: '36px', flexShrink: 0,
                borderRadius: 'var(--radius-atomic)',
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              <Menu size={18} />
            </motion.button>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={pageTitle}
                initial={{ opacity: 0, y: 6  }}
                animate={{ opacity: 1, y: 0  }}
                exit={{    opacity: 0, y: -6 }}
                transition={{ duration: DURATION.base, ease: EASE.state }}
                style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: isMobile ? 'var(--text-base)' : 'var(--text-md)',
                  color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2,
                }}
              >
                {pageTitle}
              </motion.h1>
            </AnimatePresence>
            {!isMobile && (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                System administration ·{' '}
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Admin mode badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px 4px 4px',
            background: 'var(--violet-bg)', border: '1px solid var(--violet-border)',
            borderRadius: 'var(--radius-pill)', flexShrink: 0,
          }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: 'var(--radius-pill)',
              background: 'var(--violet)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={11} color="#fff" strokeWidth={2.5} />
            </div>
            {!isMobile && (
              <span style={{
                color: 'var(--violet)', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
              }}>
                Admin mode
              </span>
            )}
          </div>
        </header>

        <main style={{
          flex: 1, overflowY: 'auto',
          padding: isMobile ? 'var(--space-3)' : 'var(--space-4)',
          backgroundColor: 'var(--bg)', position: 'relative',
        }}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

// ─── Admin nav item ───────────────────────────────────────────
function AdminNavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: '10px 12px', borderRadius: 'var(--radius-atomic)',
        fontSize: 'var(--text-sm)', textDecoration: 'none', position: 'relative',
        transition: `color ${DURATION.base}ms ${EASE.state}`,
        color: 'var(--text-secondary)',
      }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="admin-sidebar-active"
              transition={SPRING.gentle}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: 'var(--radius-atomic)',
                background: 'var(--violet-bg)',
                borderLeft: '2px solid var(--violet)',
                zIndex: 0,
              }}
            />
          )}
          <span style={{
            display: 'flex', alignItems: 'center',
            color: isActive ? 'var(--violet)' : 'var(--text-muted)',
            position: 'relative', zIndex: 1,
            transition: `color ${DURATION.base}ms ${EASE.state}`,
          }}>
            <Icon size={17} />
          </span>
          <span style={{
            position: 'relative', zIndex: 1,
            color: isActive ? 'var(--violet)' : 'var(--text-secondary)',
            fontWeight: isActive ? 600 : 500,
            transition: `color ${DURATION.base}ms ${EASE.state}`,
          }}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}