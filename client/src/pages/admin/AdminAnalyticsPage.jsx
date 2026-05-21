// client/src/pages/admin/AdminAnalyticsPage.jsx
import { useState }                       from 'react';
import { useQuery }                       from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie,
  Cell, Legend,
}                                         from 'recharts';
import {
  TrendingUp, Users, BarChart3, Activity,
  RefreshCw, Calendar,
}                                         from 'lucide-react';
import { motion }                         from 'framer-motion';

import api                                from '../../services/api';
import { useIsMobile }                    from '../../hooks/useIsMobile';
import { SPRING }                         from '../../lib/motion';

const DAY_OPTIONS = [
  { value: 7,  label: 'Last 7 days'  },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
];

export default function AdminAnalyticsPage() {
  const isMobile  = useIsMobile();
  const [days, setDays] = useState(14);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-analytics', days],
    queryFn:  () => api.get(`/admin/analytics?days=${days}`).then(r => r.data?.data ?? r.data),
  });

  const sessionsOverTime  = data?.sessionsOverTime  ?? [];
  const attendanceByClass = data?.attendanceByClass ?? [];
  const statusBreakdown   = data?.statusBreakdown   ?? [];
  const userBreakdown     = data?.userBreakdown     ?? [];
  const summary           = data?.summary           ?? {};

  // Thin out x-axis labels on mobile / small ranges
  const xAxisInterval = isMobile ? Math.floor(sessionsOverTime.length / 4) : days <= 7 ? 0 : 2;

  return (
    <div style={{ padding: isMobile ? 'var(--space-3)' : 'var(--space-6)', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-display)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={18} color="var(--brand-text)" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 'var(--text-xl)' : 'clamp(20px,2.5vw,28px)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Analytics
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Platform-wide attendance and activity insights
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Time range selector */}
          <div style={{ display: 'flex', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {DAY_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => setDays(opt.value)}
                style={{ padding: isMobile ? '7px 10px' : '8px 14px', background: days === opt.value ? 'var(--brand)' : 'var(--bg-card)', color: days === opt.value ? '#fff' : 'var(--text-primary)', border: 'none', fontSize: isMobile ? 11 : 13, fontWeight: days === opt.value ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isMobile ? opt.value + 'd' : opt.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => refetch()} disabled={isRefetching}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--radius-atomic)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={14} style={{ animation: isRefetching ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Summary stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
        <StatTile loading={isLoading} icon={Activity}  label="Sessions"        value={summary.totalSessions  ?? 0}    color="var(--brand-text)"  bg="var(--brand-subtle)"      />
        <StatTile loading={isLoading} icon={TrendingUp} label="Platform rate"  value={`${summary.platformRate ?? 0}%`} color="#10b981"            bg="rgba(16,185,129,0.08)"   />
        <StatTile loading={isLoading} icon={Calendar}   label="Records"        value={summary.totalAttendance ?? 0}   color="#f59e0b"            bg="rgba(245,158,11,0.08)"  />
        <StatTile loading={isLoading} icon={Users}      label="Users"          value={(userBreakdown.reduce((s,u) => s+u.value, 0))} color="#7c3aed" bg="rgba(124,58,237,0.08)" />
      </div>

      {/* Sessions over time */}
      <ChartCard title="Sessions over time" subtitle={`Daily sessions for the last ${days} days`} loading={isLoading}>
        {sessionsOverTime.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sessionsOverTime} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                interval={xAxisInterval}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-display)' }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                itemStyle={{ color: '#2563eb' }}
                cursor={{ fill: 'var(--bg-raised)' }}
              />
              <Bar dataKey="count" name="Sessions" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="No sessions in this time range" />
        )}
      </ChartCard>

      {/* Bottom row: attendance by class + status breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 'var(--space-3)' }}>

        {/* Attendance rate per class */}
        <ChartCard title="Attendance rate by class" subtitle="Present + late as % of total records" loading={isLoading}>
          {attendanceByClass.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(180, attendanceByClass.length * 52)}>
              <BarChart data={attendanceByClass} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-primary)', fontFamily: 'var(--font-display)' }} tickLine={false} axisLine={false} width={120} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-display)' }}
                  formatter={(value, name) => [`${value}%`, 'Attendance rate']}
                  cursor={{ fill: 'var(--bg-raised)' }}
                />
                <Bar dataKey="rate" name="Rate" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {attendanceByClass.map((entry, index) => (
                    <Cell key={index} fill={entry.rate >= entry.threshold ? '#10b981' : entry.rate >= entry.threshold - 5 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No attendance data yet" />
          )}
        </ChartCard>

        {/* Status breakdown donut */}
        <ChartCard title="Attendance breakdown" subtitle="Status distribution across all records" loading={isLoading}>
          {statusBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <PieChart width={180} height={180}>
                <Pie data={statusBreakdown} cx={85} cy={85} innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-display)' }}
                />
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {statusBreakdown.map(s => {
                  const total = statusBreakdown.reduce((sum, x) => sum + x.value, 0);
                  const pct   = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  return (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{s.value}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: s.color, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyChart message="No attendance records yet" />
          )}
        </ChartCard>
      </div>

      {/* User breakdown */}
      <ChartCard title="User distribution" subtitle="Platform users by role" loading={isLoading}>
        <div style={{ display: 'flex', gap: isMobile ? 12 : 24, flexWrap: 'wrap', padding: '8px 0' }}>
          {userBreakdown.map(u => {
            const total = userBreakdown.reduce((s, x) => s + x.value, 0);
            const pct   = total > 0 ? Math.round((u.value / total) * 100) : 0;
            return (
              <div key={u.name} style={{ flex: '1 1 120px', background: 'var(--bg-raised)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-3)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: u.color, width: `${pct}%`, borderRadius: '0 0 0 var(--radius-molecular)' }} />
                <div style={{ fontSize: 28, fontWeight: 700, color: u.color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{u.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: u.color, fontWeight: 700, marginTop: 2 }}>{pct}% of users</div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}

// ─── Chart card wrapper ────────────────────────────────────────
function ChartCard({ title, subtitle, loading, children }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', border: '1px solid var(--border)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>
      </div>
      {loading ? (
        <div className="shimmer" style={{ height: 220, borderRadius: 8 }} />
      ) : children}
    </div>
  );
}

// ─── Stat tile ─────────────────────────────────────────────────
function StatTile({ loading, icon: Icon, label, value, color, bg }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-molecular)', padding: 'var(--space-3)', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: bg, filter: 'blur(24px)', opacity: 0.8, pointerEvents: 'none' }} />
      <Icon size={14} color={color} style={{ position: 'relative', marginBottom: 8 }} />
      <div style={{ position: 'relative', fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
        {loading ? '—' : value}
      </div>
      <div style={{ position: 'relative', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ─── Empty chart state ─────────────────────────────────────────
function EmptyChart({ message }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
      {message}
    </div>
  );
}