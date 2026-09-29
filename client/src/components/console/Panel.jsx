// client/src/components/console/Panel.jsx
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import Ticker from '../ui/Ticker';

/**
 * ═════════════════════════════════════════════════════════════════
 * Console building blocks: page header, framed panel, KPI, status
 * signal, empty state and skeleton. Styles in console.css.
 * ═════════════════════════════════════════════════════════════════
 */

export function ConsoleHead({ kicker, title, lede, actions }) {
  return (
    <header className="c-head">
      <div style={{ minWidth: 0 }}>
        {kicker && <p className="kicker"><span className="dot" /> {kicker}</p>}
        <h1>{title}</h1>
        {lede && <p className="c-lede">{lede}</p>}
      </div>
      {actions && <div className="c-actions">{actions}</div>}
    </header>
  );
}

export function Panel({ label, title, actions, className = '', flush = false, alert = false, children, ...rest }) {
  return (
    <section className={`panel${flush ? ' is-flush' : ''}${alert ? ' is-alert' : ''} ${className}`} {...rest}>
      {(label || title || actions) && (
        <div className="panel-head">
          <div style={{ minWidth: 0 }}>
            {label && <p className="c-label">{label}</p>}
            {title && <h2 className="c-title">{title}</h2>}
          </div>
          {actions && <div className="c-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Change against a baseline. `invert` for metrics where down is good.
export function Delta({ value, suffix = ' pts', invert = false }) {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  const dir = rounded === 0 ? 'flat' : (rounded > 0) !== invert ? 'up' : 'down';
  const Icon = rounded === 0 ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`delta ${dir}`}>
      <Icon size={12} aria-hidden="true" />
      {rounded > 0 ? '+' : ''}{rounded}{suffix}
    </span>
  );
}

export function Kpi({ label, value, format, foot, delta, children, className = '' }) {
  return (
    <Panel className={className} label={label}>
      <span className="kpi-value">
        {typeof value === 'number' ? <Ticker value={value} format={format} /> : value}
      </span>
      {(foot || delta != null) && (
        <div className="kpi-foot">
          {delta}
          {foot && <span>{foot}</span>}
        </div>
      )}
      {children}
    </Panel>
  );
}

export function Sig({ tone = 'idle', children }) {
  return <span className={`sig ${tone}`}>{children}</span>;
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="dt-empty" role="status">
      {Icon && <Icon size={22} style={{ color: 'var(--text-muted)', marginBottom: 10 }} aria-hidden="true" />}
      <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{title}</p>
      {children && <p style={{ marginTop: 4, fontSize: 13 }}>{children}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skel" style={{ height: h, width: w, ...style }} aria-hidden="true" />;
}

// A panel-shaped placeholder while a page's first request is in flight.
export function PanelSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`panel ${className}`} aria-busy="true">
      <Skeleton h={10} w="30%" />
      <Skeleton h={28} w="55%" style={{ marginTop: 14 }} />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <Skeleton key={i} h={10} w={`${80 - i * 15}%`} style={{ marginTop: 12 }} />
      ))}
    </div>
  );
}

