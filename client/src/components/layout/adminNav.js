// client/src/components/layout/adminNav.js
import {
  LayoutDashboard, Users, UserPlus, BookOpen, Radio, CalendarDays,
  BarChart3, TriangleAlert, Map, MonitorPlay, ShieldAlert, ScrollText,
  Megaphone, SlidersHorizontal, HeartPulse,
} from 'lucide-react';

/**
 * The admin console's pages, grouped the way the pill nav shows them.
 * One list feeds the nav menus, the full-screen phone menu and the
 * Ctrl/Cmd+K palette, so a page added here shows up everywhere.
 */
export const ADMIN_NAV = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, desc: 'Today across the institution' },
  { label: 'People', items: [
    { label: 'Users',         to: '/admin/users',        icon: Users,    desc: 'Accounts, roles, phones, invites' },
    { label: 'Import users',  to: '/admin/users/import', icon: UserPlus, desc: 'Create accounts from a CSV' },
  ] },
  { label: 'Teaching', items: [
    { label: 'Classes',  to: '/admin/classes',  icon: BookOpen,     desc: 'Every class and its lecturer' },
    { label: 'Sessions', to: '/admin/sessions', icon: Radio,        desc: 'Live sessions, force close' },
    { label: 'Calendar', to: '/admin/calendar', icon: CalendarDays, desc: 'Semesters, holidays, exams' },
  ] },
  { label: 'Insight', items: [
    { label: 'Analytics', to: '/admin/analytics', icon: BarChart3,     desc: 'Departments, timetable, trends' },
    { label: 'At-risk',   to: '/admin/at-risk',   icon: TriangleAlert, desc: 'Students below the minimum' },
    { label: 'Heatmap',   to: '/admin/heatmap',   icon: Map,           desc: 'Sessions across both campuses' },
    { label: 'Ops wall',  to: '/admin/ops',       icon: MonitorPlay,   desc: 'Full-screen live view' },
  ] },
  { label: 'Trust', items: [
    { label: 'Fraud review', to: '/admin/fraud', icon: ShieldAlert, desc: 'Flagged scans and sign-ins', badgeKey: 'flags' },
    { label: 'Audit trail',  to: '/admin/audit', icon: ScrollText,  desc: 'Who changed what, and when' },
  ] },
  { label: 'Comms', items: [
    { label: 'Announcements', to: '/admin/announcements', icon: Megaphone, desc: 'Messages to any group' },
  ] },
  { label: 'System', items: [
    { label: 'Policy settings', to: '/admin/settings', icon: SlidersHorizontal, desc: 'Institution-wide defaults' },
    { label: 'Health',          to: '/admin/health',   icon: HeartPulse,        desc: 'Server, database, jobs, email' },
  ] },
];

export const ADMIN_PAGES = ADMIN_NAV.flatMap(g => (g.items ? g.items.map(i => ({ ...i, group: g.label })) : [{ ...g, group: 'Overview' }]));
