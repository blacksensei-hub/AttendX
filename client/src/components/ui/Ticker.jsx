// client/src/components/ui/Ticker.jsx
import { useLayoutEffect, useRef } from 'react';
import { tickTo } from '../../lib/anime';

const defaultFormat = (v) => Math.round(v).toLocaleString();

/**
 * A number that counts to its value with anime.js.
 *
 * It counts up from zero once, when first shown; later changes count
 * from the previous value, so a refetch that moves 81% to 82% reads as
 * a small step rather than replaying the whole climb. The final value
 * is rendered by React, so screen readers, copy/paste and reduced
 * motion all see the real number.
 */
export default function Ticker({ value, format = defaultFormat, duration = 900, className, style }) {
  const ref  = useRef(null);
  const prev = useRef(0);

  useLayoutEffect(() => {
    const to = Number(value) || 0;
    const stop = tickTo(ref.current, prev.current, to, { format, duration });
    prev.current = to;
    return stop;
  }, [value, format, duration]);

  return (
    <span ref={ref} className={`tabular ${className ?? ''}`} style={style}>
      {format(Number(value) || 0)}
    </span>
  );
}
