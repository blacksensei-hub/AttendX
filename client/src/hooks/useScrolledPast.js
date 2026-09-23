import { useCallback, useSyncExternalStore } from 'react';

/**
 * True once the window has scrolled more than `threshold` pixels.
 * Re-renders only when that answer flips, not on every scroll event.
 * Drives the floating pill nav on the landing page and in the app.
 */
export function useScrolledPast(threshold = 16) {
  const subscribe = useCallback((onChange) => {
    window.addEventListener('scroll', onChange, { passive: true });
    return () => window.removeEventListener('scroll', onChange);
  }, []);
  return useSyncExternalStore(subscribe, () => window.scrollY > threshold, () => false);
}
