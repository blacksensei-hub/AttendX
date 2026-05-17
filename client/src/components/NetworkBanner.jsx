import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';

import { SPRING } from '../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * NetworkBanner — non-intrusive banner shown when the network is down.
 *
 * Two signals trigger the banner:
 *
 *   1. Browser-level offline events (window.online / .offline).
 *      The browser fires these when the OS detects a lost connection.
 *      Reliable for full disconnects (airplane mode, WiFi off) but
 *      doesn't catch the case where the device has internet but the
 *      AttendX backend specifically is down.
 *
 *   2. Periodic health pings to /api/health every 30s. This catches
 *      backend-specific failures: server crashed, DNS broken, mid-deploy.
 *      A failed ping flips us into "offline" mode even if the browser
 *      thinks it's online.
 *
 * The banner uses position:fixed at the top of the viewport so it
 * floats above any layout. It animates down on appearance and back
 * up on disappearance — quick and unobtrusive.
 *
 * No dismiss button: this isn't an alert the user can suppress, it's
 * a status indicator. As soon as connectivity returns, it goes away
 * on its own. Adding a dismiss button creates the bad pattern of
 * "I dismissed it but now things are still failing silently".
 * ═════════════════════════════════════════════════════════════════
 */

const HEALTH_CHECK_URL      = `${import.meta.env.VITE_API_URL || '/api'}/health`;
const HEALTH_CHECK_INTERVAL = 30000; // 30s — catches backend-down without spamming
const HEALTH_CHECK_TIMEOUT  = 5000;  // 5s — give slow networks a chance

async function checkHealth() {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const res = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      signal: controller.signal,
      // No credentials — health endpoint should be public
    });

    clearTimeout(timer);
    return res.ok;
  } catch {
    // Either the timeout fired, the server returned a non-ok status,
    // or the network rejected the request. All of these mean "down".
    return false;
  }
}

export default function NetworkBanner() {
  // Start optimistic — assume online until proven otherwise.
  // If we started pessimistic, the banner would flash on every page
  // load before the first health check completes.
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Browser-level connectivity events.
  useEffect(() => {
    const handleOnline  = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Backend health checks. We run them only while the browser thinks
  // it's online — there's no point pinging the backend if the device
  // has no network at all.
  useEffect(() => {
    if (!online) return;

    let cancelled = false;
    const tick = async () => {
      const healthy = await checkHealth();
      if (!cancelled && !healthy) setOnline(false);
    };

    // Don't run on mount — initial page load already exercised the API
    // through other queries; let those signal failure naturally.
    const handle = setInterval(tick, HEALTH_CHECK_INTERVAL);
    return () => { cancelled = true; clearInterval(handle); };
  }, [online]);

  // When offline, retry the health check more aggressively (every 5s)
  // so the banner clears as soon as connectivity returns.
  useEffect(() => {
    if (online) return;

    let cancelled = false;
    const tick = async () => {
      // navigator.onLine is the cheaper check — try it first.
      if (navigator.onLine && await checkHealth()) {
        if (!cancelled) setOnline(true);
      }
    };

    const handle = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(handle); };
  }, [online]);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="banner"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={SPRING.snappy}
          style={{
            position:        'fixed',
            top:             0,
            left:            0,
            right:           0,
            zIndex:          9999,
            background:      'var(--amber-bg)',
            borderBottom:    '1px solid var(--amber-border)',
            padding:         '8px var(--space-3)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            gap:             '8px',
            boxShadow:       'var(--shadow-md)',
          }}
        >
          <WifiOff size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <p style={{
            color:      'var(--amber)',
            fontSize:   'var(--text-xs)',
            fontWeight: 600,
            fontFamily: 'var(--font-body)',
          }}>
            Can't connect to AttendX — check your internet connection
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}