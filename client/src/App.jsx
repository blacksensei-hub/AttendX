import { useEffect }   from 'react';
import AppRouter       from './router';
import { useUIStore }  from './store/uiStore';

/**
 * ═════════════════════════════════════════════════════════════════
 * App — root component.
 *
 * Responsible for applying the user's theme preference to the html
 * element so CSS custom properties resolve to the right palette.
 * Everything else lives in the router.
 * ═════════════════════════════════════════════════════════════════
 */
export default function App() {
  const theme = useUIStore(s => s.theme);

  // Apply theme class to <html>. Removing both first prevents a
  // flash of the wrong theme when toggling since CSS specificity
  // for .light and .dark is equal.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'light');
    html.classList.add(theme);
  }, [theme]);

  return <AppRouter />;
}