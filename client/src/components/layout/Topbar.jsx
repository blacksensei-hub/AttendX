// client/src/components/layout/Topbar.jsx
import { useLocation }                 from 'react-router-dom';
import { motion, AnimatePresence }     from 'framer-motion';
import { Menu }                        from 'lucide-react';

import { useAuthStore }                from '../../store/authStore';
import { useIsMobile }                 from '../../hooks/useIsMobile';
import ThemeToggle                     from '../ui/ThemeToggle';
import NotificationPanel               from '../ui/NotificationPanel';
import { EASE, DURATION, SPRING, TAP } from '../../lib/motion';

const PAGE_TITLES = {
  '/lecturer':          'Dashboard',
  '/lecturer/classes':  'Classes',
  '/lecturer/sessions': 'Live Sessions',
  '/lecturer/appeals':  'Attendance Appeals',
  '/lecturer/alerts':   'At-Risk Alerts',
  '/lecturer/reports':  'Reports',
  '/student':           'Dashboard',
  '/student/classes':   'My Classes',
  '/student/history':   'Attendance History',
  '/student/scan':      'Scan QR',
  '/admin':             'Admin Dashboard',
  '/admin/users':       'Users',
  '/admin/classes':     'Classes',
  '/admin/sessions':    'Sessions',
};

function resolveTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.includes('/session/') && pathname.endsWith('/roster')) return 'Session Roster';
  if (pathname.includes('/session/')) return 'Live Session';
  return 'AttendX';
}

export default function Topbar({ onMenuToggle }) {
  const { user }     = useAuthStore();
  const { pathname } = useLocation();
  const isMobile     = useIsMobile();
  const title        = resolveTitle(pathname);
  const today        = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <header style={{
      height:          '64px',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'space-between',
      padding:         isMobile ? '0 var(--space-3)' : '0 var(--space-4)',
      borderBottom:    '1px solid var(--border)',
      backgroundColor: 'var(--topbar-bg)',
      flexShrink:      0,
      position:        'sticky',
      top:             0,
      zIndex:          20,
      gap:             'var(--space-2)',
      transition:      `background-color ${DURATION.medium}ms ${EASE.state}`,
      backdropFilter:  'blur(12px) saturate(180%)',
    }}>

      {/* Hamburger — mobile only */}
      {isMobile && (
        <motion.button
          whileTap={TAP.button}
          onClick={onMenuToggle}
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

      {/* Page title + date */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: 6  }}
            animate={{ opacity: 1, y: 0  }}
            exit={{    opacity: 0, y: -6 }}
            transition={{ duration: DURATION.base, ease: EASE.state }}
            style={{
              fontFamily: 'var(--font-display)', fontWeight: 600,
              fontSize: isMobile ? 'var(--text-base)' : 'var(--text-md)',
              color: 'var(--text-primary)', letterSpacing: '-0.01em',
              lineHeight: 1.2, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {title}
          </motion.h1>
        </AnimatePresence>
        {!isMobile && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: '2px' }}>
            {today}
          </p>
        )}
      </div>

      {/* Right controls */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: isMobile ? '4px' : 'var(--space-2)', flexShrink: 0,
      }}>
        {!isMobile && <ThemeToggle />}
        <NotificationPanel />

        {!isMobile && (
          <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
        )}

        {/* User identity chip */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={SPRING.snappy}
          style={{
            display: 'flex', alignItems: 'center',
            gap: 'var(--space-2)',
            padding: isMobile ? '4px' : '4px 10px 4px 4px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            cursor: 'default',
          }}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: 'var(--radius-pill)',
            background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 'var(--text-xs)',
            color: 'var(--brand-text)', flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          {!isMobile && (
            <div style={{ minWidth: 0 }}>
              <p style={{
                color: 'var(--text-primary)', fontSize: 'var(--text-xs)',
                fontWeight: 600, lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.name}
              </p>
              <p style={{
                color: 'var(--text-muted)', fontSize: '10px',
                textTransform: 'capitalize', letterSpacing: '0.04em', lineHeight: 1.2,
              }}>
                {user?.role}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </header>
  );
}