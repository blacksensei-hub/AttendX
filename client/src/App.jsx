import { useEffect, useState }   from 'react';
import { AnimatePresence }       from 'framer-motion';
import AppRouter                 from './router';
import SplashScreen              from './components/SplashScreen';
import { useUIStore }            from './store/uiStore';

/**
 * ═════════════════════════════════════════════════════════════════
 * App — root component.
 *
 * Responsible for applying the user's theme preference to the html
 * element so CSS custom properties resolve to the right palette,
 * and for showing the branded splash on first load.
 *
 * Splash behaviour, and why it's built this way:
 *   • Shown ONCE per page load, not per route change. It sits here
 *     rather than inside the router so navigation never re-triggers
 *     it.
 *   • The router mounts underneath it immediately — the splash is an
 *     overlay, not a gate. Chunks load and auth rehydrates while it's
 *     visible, so it costs nothing; by the time it fades the page is
 *     genuinely ready rather than waiting to start.
 *   • Skipped entirely for users who prefer reduced motion, where a
 *     full-screen animated overlay is exactly the wrong thing.
 * ═════════════════════════════════════════════════════════════════
 */

const SPLASH_DURATION = 1400;

export default function App() {
  const theme = useUIStore(s => s.theme);

  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Apply theme class to <html>. Removing both first prevents a
  // flash of the wrong theme when toggling since CSS specificity
  // for .light and .dark is equal.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'light');
    html.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <AppRouter />
      <AnimatePresence>
        {showSplash && <SplashScreen key="splash" />}
      </AnimatePresence>
    </>
  );
}