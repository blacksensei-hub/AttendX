import { useCallback, useSyncExternalStore } from 'react';

/**
 * True while the viewport is narrower than `breakpoint` px.
 *
 * Reads the media query through useSyncExternalStore, so there is no
 * state to keep in sync and no extra render on mount.
 */
export function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const subscribe = useCallback((onChange) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
