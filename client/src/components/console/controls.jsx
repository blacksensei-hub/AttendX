// client/src/components/console/controls.jsx
import { useId } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { SPRING } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * Console form controls. The moving thumb and tab underline are
 * Framer Motion shared-layout animations: they slide to the new
 * choice, which tells you where the selection went.
 * ═════════════════════════════════════════════════════════════════
 */

export function Segmented({ options, value, onChange, label }) {
  const id = useId();
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={`seg-${id}`} className="seg-thumb" transition={SPRING.snappy} />}
            <span>{o.label}{o.count != null && <span className="count">{o.count}</span>}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, label }) {
  const id = useId();
  return (
    <div className="c-tabs" role="tablist" aria-label={label}>
      {tabs.map(t => {
        const on = t.value === value;
        return (
          <button key={t.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.value)}>
            {t.label}
            {t.count != null && <span className="c-muted tabular" style={{ marginLeft: 6, fontSize: 12 }}>{t.count}</span>}
            {on && <motion.span layoutId={`tab-${id}`} className="tab-line" transition={SPRING.snappy} />}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" className="switch" aria-checked={Boolean(checked)} aria-label={label}
            disabled={disabled} onClick={() => onChange(!checked)} />
  );
}

export function Field({ label, hint, error, children, style }) {
  return (
    <label className="c-field" style={style}>
      <span className="c-label">{label}</span>
      {children}
      {error ? <span className="err" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search' }) {
  return (
    <div className="c-search">
      <Search size={15} aria-hidden="true" />
      <input className="c-input" type="search" value={value} onChange={e => onChange(e.target.value)}
             placeholder={placeholder} aria-label={label} />
    </div>
  );
}

export function Select({ value, onChange, options, label, style }) {
  return (
    <select className="c-select" value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={{ width: 'auto', ...style }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
