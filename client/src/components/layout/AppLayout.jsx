// client/src/components/layout/AppLayout.jsx
import { Suspense, useState }        from 'react';
import { Outlet }                    from 'react-router-dom';

import Sidebar                       from './Sidebar';
import Topbar                        from './Topbar';
import NetworkBanner                 from '../NetworkBanner';
import { useIsMobile }               from '../../hooks/useIsMobile';

export default function AppLayout() {
  const isMobile                      = useIsMobile();
  const [mobileOpen, setMobileOpen]   = useState(false);

  return (
    <div style={{
      display:         'flex',
      // width: 100% is load-bearing. A flex container with no width
      // constraint sizes to its content, so without this the whole app
      // collapsed to a narrow column on mobile instead of filling the
      // screen — the page looked "zoomed in" and needed pinch-zooming
      // out to read. #root carries a matching rule in App.css; both are
      // needed, since #root is unstyled by default in Vite's template
      // and would otherwise collapse before this element even gets a
      // chance to fill it.
      width:           '100%',
      height:          '100dvh',
      overflow:        'hidden',
      backgroundColor: 'var(--bg)',
    }}>
      <NetworkBanner />

      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div style={{
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        // minWidth: 0 lets this flex child shrink below its content's
        // intrinsic width — without it, a wide table or chart inside
        // would force the whole layout wider than the viewport.
        minWidth:      0,
        overflow:      'hidden',
      }}>
        <Topbar onMenuToggle={() => setMobileOpen(o => !o)} />

        <main style={{
          flex:            1,
          overflowY:       'auto',
          padding:         isMobile ? 'var(--space-3)' : 'var(--space-4)',
          backgroundColor: 'var(--bg)',
          position:        'relative',
        }}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}