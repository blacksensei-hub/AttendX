// client/src/components/console/format.js
import { useEffect, useLayoutEffect, useRef } from 'react';
import { revealGrid } from '../../lib/anime';

/** Formatting helpers and the palette hotkey, shared by console pages. */

export const pctFormat = (v) => `${(Math.round(v * 10) / 10).toFixed(v % 1 ? 1 : 0)}%`;

export const toneFor = (rate, threshold = 75) =>
  rate >= threshold ? 'good' : rate >= threshold - 10 ? 'warn' : 'bad';

// "3 minutes ago" style times for feeds and tables.
export function timeAgo(date) {
  if (!date) return '';
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return '1 min ago';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
}

export const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '';

// Ctrl/Cmd+K toggles the command palette.
export function useCommandPaletteHotkey(setOpen) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
}

// Staggers a page's panels in once, the first time its data is ready.
// Later refetches never replay it.
export function usePanelReveal(ref, ready) {
  const done = useRef(false);
  useLayoutEffect(() => {
    if (!ready || done.current || !ref.current) return undefined;
    done.current = true;
    return revealGrid(ref.current.querySelectorAll('.panel'), { each: 40 });
  }, [ready, ref]);
}
