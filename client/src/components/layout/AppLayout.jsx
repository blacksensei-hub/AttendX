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