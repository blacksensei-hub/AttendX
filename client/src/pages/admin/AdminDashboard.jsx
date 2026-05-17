// client/src/pages/admin/AdminDashboard.jsx
import { useQuery }                                  from '@tanstack/react-query';
import { useNavigate }                               from 'react-router-dom';
import { motion }                                    from 'framer-motion';
import {
  Users, BookOpen, BarChart3, Radio,
  CheckCircle, TrendingUp, Shield, ArrowUpRight,
  UserCog, GraduationCap, AlertTriangle, Map,
}                                                    from 'lucide-react';

import { adminService }                              from '../../services/adminService';
import { useAuthStore }                              from '../../store/authStore';
import PageShell                                     from '../../components/layout/PageShell';
import { AnimatedList, AnimatedItem }                from '../../components/ui/AnimatedList';
import {
  SPRING, TAP, EASE, DURATION,
}                                                    from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AdminDashboard — system-wide state at a glance.
 *
 * First thing admins see. Must communicate immediately:
 *   1. Total platform users (people count)
 *   2. Platform-wide activity (sessions, attendance records)
 *   3. Health indicator (platform attendance rate)
 *
 * Uses the violet admin palette for accents, matching AdminLayout.
 * Stat cards have the ambient glow treatment used on the lecturer
 * and student dashboards — design language consistency across roles.
 * ═════════════════════════════════════════════════════════════════
 */
export default function AdminDashboard() {
  const user     = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const { data: statsData, isLoading } = useQuery({
    queryKey:             ['admin-stats'],
    queryFn:              adminService.getStats,
    staleTime:            0,               // always re-fetch on mount
    refetchOnWindowFocus: true,            // refresh when tab regains focus
    refetchInterval:      30_000,          // auto-refresh every 30 seconds
  });

  const stats = statsData ?? {};

  const STAT_CARDS = [
    {
      label: 'Total users',
      value: stats.totalUsers ?? 0,
      icon:  Users,
      color: 'var(--violet)',
      bg:    'var(--violet-bg)',
      border:'var(--violet-border)',
    },
    {
      label: 'Lecturers',
      value: stats.totalLecturers ?? 0,
      icon:  UserCog,
      color: 'var(--brand)',
      bg:    'var(--brand-subtle)',
      border:'var(--brand-border)',
    },
    {
      label: 'Students',
      value: stats.totalStudents ?? 0,
      icon:  GraduationCap,
      color: 'var(--violet)',
      bg:    'var(--violet-bg)',
      border:'var(--violet-border)',
    },
    {
      label: 'Classes',
      value: stats.totalClasses ?? 0,
      icon:  BookOpen,
      color: 'var(--green)',
      bg:    'var(--green-bg)',
      border:'var(--green-border)',
    },
    {
      label: 'Total sessions',
      value: stats.totalSessions ?? 0,
      icon:  BarChart3,
      color: 'var(--amber)',
      bg:    'var(--amber-bg)',
      border:'var(--amber-border)',
    },
    {
      label: 'Active now',
      value: stats.activeSessions ?? 0,
      icon:  Radio,
      color: 'var(--red)',
      bg:    'var(--red-bg)',
      border:'var(--red-border)',
      pulse: true,
    },
    {
      label: 'Attendance records',
      value: stats.totalAttendance ?? 0,
      icon:  CheckCircle,
      color: 'var(--brand)',
      bg:    'var(--brand-subtle)',
      border:'var(--brand-border)',
    },
    {
      label: 'Platform rate',
      value: `${stats.attendanceRate ?? 0}%`,
      icon:  TrendingUp,
      color: 'var(--green)',
      bg:    'var(--green-bg)',
      border:'var(--green-border)',
    },
  ];

  const QUICK_LINKS = [
    {
      label: 'Manage users',
      desc:  'Search, deactivate, or change roles',
      href:  '/admin/users',
      icon:  Users,
      color: 'var(--violet)',
      bg:    'var(--violet-bg)',
      border:'var(--violet-border)',
    },
    {
      label: 'View all classes',
      desc:  'Browse every class on the platform',
      href:  '/admin/classes',
      icon:  BookOpen,
      color: 'var(--brand)',
      bg:    'var(--brand-subtle)',
      border:'var(--brand-border)',
    },
    {
      label: 'Live sessions',
      desc:  'See and force-close active sessions',
      href:  '/admin/sessions',
      icon:  Radio,
      color: 'var(--red)',
      bg:    'var(--red-bg)',
      border:'var(--red-border)',
    },
    {
      label: 'At-risk students',
      desc:  'Flag and notify students below threshold',
      href:  '/admin/at-risk',
      icon:  AlertTriangle,
      color: 'var(--amber)',
      bg:    'var(--amber-bg)',
      border:'var(--amber-border)',
    },
    {
      label: 'Campus heatmap',
      desc:  'Live map of sessions across both campuses',
      href:  '/admin/heatmap',
      icon:  Map,
      color: 'var(--green)',
      bg:    'var(--green-bg)',
      border:'var(--green-border)',
    },
  ];

  return (
    <PageShell gap="var(--space-4)">

      {/* ── Welcome header ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.gentle}
      >
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '8px',
          marginBottom: '8px',
        }}>
          <div style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '6px',
            padding:      '3px 10px',
            background:   'var(--violet-bg)',
            border:       '1px solid var(--violet-border)',
            borderRadius: 'var(--radius-pill)',
          }}>
            <Shield size={11} style={{ color: 'var(--violet)' }} strokeWidth={2.5} />
            <span style={{
              color:         'var(--violet)',
              fontSize:      '10px',
              fontWeight:    700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily:    'var(--font-mono)',
            }}>
              System overview
            </span>
          </div>
        </div>

        <h1 style={{
          fontFamily:    'var(--font-display)',
          fontSize:      'var(--text-2xl)',
          fontWeight:    700,
          color:         'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight:    1.15,
        }}>
          Welcome back,{' '}
          <span style={{
            background:              'linear-gradient(135deg, var(--violet), #a78bfa)',
            WebkitBackgroundClip:    'text',
            WebkitTextFillColor:     'transparent',
            backgroundClip:          'text',
          }}>
            {user?.name?.split(' ')[0] ?? user?.full_name?.split(' ')[0] ?? 'Admin'}
          </span>
        </h1>
        <p style={{
          color:     'var(--text-muted)',
          fontSize:  'var(--text-md)',
          marginTop: '6px',
        }}>
          Here's the state of the entire platform at a glance.
        </p>
      </motion.div>

      {/* ── Stats grid ──────────────────────────────────────── */}
      <AnimatedList
        style={{
          display:             'grid',
          gap:                 'var(--space-3)',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        {STAT_CARDS.map(card => (
          <AnimatedItem
            key={card.label}
            whileHover={{ y: -3 }}
            transition={SPRING.snappy}
          >
            <StatCard isLoading={isLoading} {...card} />
          </AnimatedItem>
        ))}
      </AnimatedList>

      {/* ── Quick actions ───────────────────────────────────── */}
      <div>
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   'var(--space-3)',
        }}>
          <h3 style={{
            fontFamily:    'var(--font-display)',
            fontWeight:    600,
            fontSize:      'var(--text-md)',
            color:         'var(--text-primary)',
            letterSpacing: '-0.01em',
          }}>
            Quick actions
          </h3>
          <span style={{
            color:         'var(--text-muted)',
            fontSize:      '10px',
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily:    'var(--font-mono)',
          }}>
            Most-used routes
          </span>
        </div>

        <AnimatedList
          style={{
            display:             'grid',
            gap:                 'var(--space-3)',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          }}
        >
          {QUICK_LINKS.map(link => (
            <AnimatedItem
              key={link.href}
              whileHover={{ y: -3 }}
              transition={SPRING.snappy}
            >
              <QuickLinkCard
                {...link}
                onClick={() => navigate(link.href)}
              />
            </AnimatedItem>
          ))}
        </AnimatedList>
      </div>
    </PageShell>
  );
}

// ─── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg, border, pulse, isLoading }) {
  return (
    <div style={{
      position:     'relative',
      background:   'var(--bg-card)',
      borderRadius: 'var(--radius-molecular)',
      padding:      'var(--space-3)',
      boxShadow:    'var(--shadow-md)',
      overflow:     'hidden',
      height:       '100%',
    }}>
      {/* Ambient glow in the corner */}
      <div style={{
        position:      'absolute',
        top:           '-40px',
        right:         '-40px',
        width:         '120px',
        height:        '120px',
        background:    bg,
        filter:        'blur(40px)',
        opacity:       0.7,
        pointerEvents: 'none',
      }} />

      {/* Icon tile */}
      <div style={{
        position:       'relative',
        width:          '36px',
        height:         '36px',
        borderRadius:   'var(--radius-atomic)',
        background:     bg,
        border:         `1px solid ${border}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        marginBottom:   'var(--space-2)',
      }}>
        <Icon size={17} style={{ color }} strokeWidth={2.2} />
        {pulse && (
          <span
            className="live-dot"
            style={{
              position:  'absolute',
              top:       '-3px',
              right:     '-3px',
              boxShadow: '0 0 0 2px var(--bg-card)',
            }}
          />
        )}
      </div>

      {/* Value */}
      <p style={{
        position:   'relative',
        fontFamily: 'var(--font-display)',
        fontSize:   'var(--text-2xl)',
        fontWeight: 700,
        color,
        lineHeight: 1.1,
      }}>
        {isLoading ? (
          <span
            className="shimmer"
            style={{
              display:      'inline-block',
              width:        '60px',
              height:       '30px',
              borderRadius: 'var(--radius-atomic)',
            }}
          />
        ) : value}
      </p>
      <p style={{
        position:  'relative',
        color:     'var(--text-muted)',
        fontSize:  'var(--text-sm)',
        marginTop: '4px',
      }}>
        {label}
      </p>
    </div>
  );
}

// ─── Quick link card ───────────────────────────────────────────
function QuickLinkCard({ label, desc, icon: Icon, color, bg, border, onClick }) {
  return (
    <motion.button
      whileTap={TAP.card}
      onClick={onClick}
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           'var(--space-2)',
        textAlign:     'left',
        background:    'var(--bg-card)',
        border:        `1px solid ${border}`,
        borderRadius:  'var(--radius-molecular)',
        padding:       'var(--space-3)',
        boxShadow:     'var(--shadow-md)',
        cursor:        'pointer',
        position:      'relative',
        overflow:      'hidden',
        width:         '100%',
        fontFamily:    'var(--font-body)',
        transition:    `border-color ${DURATION.base}ms ${EASE.state}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color;   }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = border;  }}
    >
      {/* Ambient glow */}
      <div style={{
        position:      'absolute',
        top:           '-50px',
        right:         '-50px',
        width:         '140px',
        height:        '140px',
        background:    bg,
        filter:        'blur(50px)',
        opacity:       0.6,
        pointerEvents: 'none',
      }} />

      {/* Header: icon + arrow */}
      <div style={{
        position:       'relative',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          width:          '40px',
          height:         '40px',
          borderRadius:   'var(--radius-atomic)',
          background:     bg,
          border:         `1px solid ${border}`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color }} strokeWidth={2.2} />
        </div>

        <motion.div
          whileHover={{ x: 3 }}
          transition={SPRING.snappy}
          style={{
            width:          '28px',
            height:         '28px',
            borderRadius:   'var(--radius-pill)',
            background:     'var(--bg-raised)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          'var(--text-muted)',
          }}
        >
          <ArrowUpRight size={14} />
        </motion.div>
      </div>

      {/* Label + desc */}
      <div style={{ position: 'relative' }}>
        <p style={{
          color,
          fontWeight:    700,
          fontSize:      'var(--text-sm)',
          fontFamily:    'var(--font-display)',
          letterSpacing: '-0.005em',
          marginBottom:  '4px',
        }}>
          {label}
        </p>
        <p style={{
          color:      'var(--text-muted)',
          fontSize:   'var(--text-xs)',
          lineHeight: 1.5,
        }}>
          {desc}
        </p>
      </div>
    </motion.button>
  );
}