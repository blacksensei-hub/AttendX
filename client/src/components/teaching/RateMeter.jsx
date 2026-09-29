// client/src/components/teaching/RateMeter.jsx
import { motion } from 'framer-motion';
import { EASE } from '../../lib/motion';
import { rateTone } from './format';

/**
 * An attendance rate against its minimum: the number, a bar that grows
 * in, and a tick where the minimum sits. Teal at or above the minimum,
 * amber within 5 points under it, red further below.
 */

export default function RateMeter({ rate, threshold = 75, width, delay = 0 }) {
  const v = Math.max(0, Math.min(100, rate ?? 0));
  return (
    <span className="meter" style={width ? { width } : undefined} title={`Minimum ${threshold}%`}>
      <span className="meter-value">{rate == null ? '–' : `${rate}%`}</span>
      <span className="meter-track" aria-hidden="true">
        <motion.span
          className={`meter-fill ${rateTone(rate, threshold)}`}
          style={{ width: '100%' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: v / 100 }}
          transition={{ duration: 0.7, ease: EASE.entry, delay }}
        />
        <span className="meter-mark" style={{ left: `calc(${threshold}% - 1px)` }} />
      </span>
    </span>
  );
}
