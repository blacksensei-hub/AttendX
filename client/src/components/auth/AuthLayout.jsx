import { Outlet }        from 'react-router-dom';
import ThemeToggle       from '../ui/ThemeToggle';
import { EASE, DURATION } from '../../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * AuthLayout — wrapper around LoginPage and RegisterPage.
 *
 * Single centred column. The previous two-panel design put a
 * gradient marketing panel on the left (feature tiles, headline,
 * glow orbs) — that's been removed in favour of putting the form
 * front and centre at every viewport width.
 *
 * A nice side effect: there's no longer a desktop/mobile layout
 * fork, so the matchMedia hook and its two branches are gone
 * too. One layout, all screen sizes.
 *
 * Logo asset:
 *   /logo-full.png — icon + wordmark, on a WHITE background. It
 *   sits on a white rounded card, which reads as a deliberate
 *   brand plate rather than a stray white rectangle, and keeps
 *   the logo legible in both light and dark themes without
 *   needing two versions of the artwork.
 * ═════════════════════════════════════════════════════════════════
 */
export default function AuthLayout() {
  return (
    <div style={{
      minHeight:       '100dvh',
      width:           '100%',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         'var(--space-4) var(--space-3)',
      backgroundColor: 'var(--bg)',
      position:        'relative',
      overflow:        'hidden',
      transition:      `background-color ${DURATION.medium}ms ${EASE.state}`,
    }}>

      {/* Ambient brand glow — corner wash so the page isn't flat.
          pointerEvents:none so it never intercepts clicks on the form. */}
      <div style={{
        position:      'absolute',
        top:           '-120px',
        right:         '-120px',
        width:         '420px',
        height:        '420px',
        background:    'var(--brand-subtle)',
        filter:        'blur(100px)',
        opacity:       0.7,
        pointerEvents: 'none',
      }} />
      <div style={{
        position:      'absolute',
        bottom:        '-140px',
        left:          '-140px',
        width:         '380px',
        height:        '380px',
        background:    'var(--brand-subtle)',
        filter:        'blur(100px)',
        opacity:       0.5,
        pointerEvents: 'none',
      }} />

      {/* Theme toggle — top right corner */}
      <div style={{
        position: 'absolute',
        top:      'var(--space-3)',
        right:    'var(--space-3)',
        zIndex:   10,
      }}>
        <ThemeToggle />
      </div>

      {/* Form column */}
      <div style={{
        width:    '100%',
        maxWidth: '440px',
        position: 'relative',
        zIndex:   1,
      }}>

        {/* Brand plate */}
        <div style={{
          display:        'flex',
          justifyContent: 'center',
          marginBottom:   'var(--space-4)',
        }}>
          <div style={{
            background:     '#ffffff',
            borderRadius:   'var(--radius-molecular)',
            padding:        '14px 22px',
            boxShadow:      'var(--shadow-md)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}>
            <img
              src="/logo-full.png"
              alt="AttendX"
              style={{
                display:   'block',
                width:     'auto',
                height:    '72px',
                maxWidth:  '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>

        <Outlet />

        {/* Footer */}
        <p style={{
          marginTop:  'var(--space-4)',
          textAlign:  'center',
          color:      'var(--text-muted)',
          fontSize:   '11px',
          fontFamily: 'var(--font-mono)',
        }}>
          © {new Date().getFullYear()} AttendX · Final Year Project
        </p>
      </div>
    </div>
  );
}