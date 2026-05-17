import { motion, useAnimationControls } from 'framer-motion';
import { useEffect }                    from 'react';
import { EASE }                         from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * QRPulseRing — ambient rotation cue.
 *
 * Wraps the QR code image and pulses when the token is about to
 * rotate. Replaces the friction of students panic-scanning and
 * missing the code mid-refresh.
 *
 * The two-pulse cadence in the final 2 seconds gives students
 * enough time to notice without being annoying if they're already
 * scanning.
 *
 * Drop-in usage — no logic changes required in the parent:
 *   <QRPulseRing secondsRemaining={qrSecondsLeft}>
 *     <img src={qrDataUrl} alt="Attendance QR" />
 *   </QRPulseRing>
 *
 * Props:
 *   secondsRemaining — countdown in seconds until next rotation
 *   children         — the QR code image / element to wrap
 * ═════════════════════════════════════════════════════════════════
 */
export default function QRPulseRing({ children, secondsRemaining }) {
  const controls = useAnimationControls();

  useEffect(() => {
    // Activate only in the final 2-second window. The scale barely
    // changes (1.015) so it reads as "breathing" not "growing".
    // The box-shadow ring expansion is the more visible cue.
    if (secondsRemaining === 2) {
      controls.start({
        scale: [1, 1.015, 1, 1.015, 1],
        boxShadow: [
          '0 0 0 0px rgba(59, 130, 246, 0)',
          '0 0 0 12px rgba(59, 130, 246, 0.18)',
          '0 0 0 0px rgba(59, 130, 246, 0)',
          '0 0 0 12px rgba(59, 130, 246, 0.18)',
          '0 0 0 0px rgba(59, 130, 246, 0)',
        ],
        transition: {
          duration: 1.6,
          times:    [0, 0.25, 0.5, 0.75, 1],
          ease:     EASE.entry,
        },
      });
    }
  }, [secondsRemaining, controls]);

  return (
    <motion.div
      animate={controls}
      initial={false}
      style={{
        display:      'inline-block',
        borderRadius: 'var(--radius-molecular)',
        willChange:   'transform, box-shadow',
      }}
    >
      {children}
    </motion.div>
  );
}