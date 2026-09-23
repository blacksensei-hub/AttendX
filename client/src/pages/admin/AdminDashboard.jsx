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
import PageShell, { PageHeader }                     from '../../components/layout/PageShell';
import StatTile, { SectionTitle }                    from '../../components/ui/StatTile';
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

  const n = v => (isLoading ? '...' : Number(v ?? 0).toLocaleString('en-GB'));
  const STAT_CARDS = [
    { label: 'Platform rate',      value: isLoading ? '...' : `${stats.attendanceRate ?? 0}%`, tone: 'green', featured: true, framed: true, hint: 'Present or late, across every session' },
    { label: 'Live now',           value: n(stats.activeSessions),  tone: 'red',    hint: 'Sessions taking attendance' },
    { label: 'Students',           value: n(stats.totalStudents),   tone: 'violet', hint: 'Registered student accounts' },
    { label: 'Lecturers',          value: n(stats.totalLecturers),  tone: 'brand',  hint: 'Registered lecturer accounts' },
    { label: 'Classes',            value: n(stats.totalClasses),    tone: 'amber',  hint: 'Across both campuses' },
    { label: 'Sessions held',      value: n(stats.totalSessions),   tone: 'brand',  hint: 'All time' },
    { label: 'Attendance records', value: n(stats.totalAttendance), tone: 'green',  hint: 'Every scan, late mark and absence' },
    { label: 'All users',          value: n(stats.totalUsers),      tone: 'muted',  hint: 'Students, lecturers and admins' },
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
      <PageHeader
        kicker={`Admin / ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        title="Welcome back,"
        accent={`${user?.name?.split(' ')[0] ?? user?.full_name?.split(' ')[0] ?? 'Admin'}.`}
        subtitle="The whole campus at a glance. Numbers refresh every 30 seconds."
      />

      {/* ── Stats grid ──────────────────────────────────────── */}
      <AnimatedList className="grid-4">
        {STAT_CARDS.map((card, i) => (
          <AnimatedItem
            key={card.label}
            whileHover={{ y: -3 }}
            transition={SPRING.snappy}
          >
            <StatTile {...card} index={i + 1} />
          </AnimatedItem>
        ))}
      </AnimatedList>

      {/* ── Quick actions ───────────────────────────────────── */}
      <div>
        <SectionTitle kicker="Most-used routes" title="Quick actions" style={{ marginBottom: 'var(--space-3)' }} />

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

// ─── Quick link card ───────────────────────────────────────────
function QuickLinkCard({ label, desc, icon: Icon, color, onClick }) {
  return (
    <motion.button
      whileTap={TAP.card}
      onClick={onClick}
      className="quick-link"
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           'var(--space-4)',
        textAlign:     'left',
        background:    'var(--bg-card)',
        border:        'none',
        borderRadius:  'var(--radius-molecular)',
        padding:       '20px',
        boxShadow:     'var(--shadow-md)',
        cursor:        'pointer',
        width:         '100%',
        height:        '100%',
        fontFamily:    'var(--font-body)',
        color:         'var(--text-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span style={{
          width:          38,
          height:         38,
          borderRadius:   'var(--radius-atomic)',
          background:     'var(--bg-raised)',
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}>
          <Icon size={17} style={{ color }} strokeWidth={2.2} />
        </span>
        <ArrowUpRight size={16} className="quick-link-arrow" style={{ color: 'var(--text-muted)', transition: `transform ${DURATION.base}s ${EASE.state}` }} />
      </div>
      <div>
        <p style={{
          fontWeight:    650,
          fontSize:      'var(--text-md)',
          fontFamily:    'var(--font-display)',
          letterSpacing: '-0.02em',
          marginBottom:  4,
        }}>
          {label}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
          {desc}
        </p>
      </div>
    </motion.button>
  );
}
