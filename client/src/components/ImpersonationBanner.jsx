import { useState }               from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, X, Loader2 }         from 'lucide-react';
import toast                       from 'react-hot-toast';

import { useAuthStore } from '../store/authStore';
import adminService     from '../services/admin';

/**
 * ════════════════════════════════════════════════════════════════════
 * ImpersonationBanner — sticky banner shown whenever an admin is
 * "viewing as" another user.
 *
 * Why red:
 *   • Visually distinct from NetworkBanner (amber). If both show
 *     simultaneously they should not visually merge.
 *   • Red signals "elevated state, be careful" — the admin's actions
 *     in this mode are recorded with their identity attached.
 *   • Matches GitHub/Stripe convention for impersonation UI.
 *
 * Position:
 *   • Sticky at top, z-index above the page content.
 *   • Mounts above NetworkBanner inside AppLayout — ordering is
 *     intentional: impersonation is a more critical context than a
 *     transient network blip.
 *
 * Animation:
 *   • Slide-in from top on first appearance (using framer-motion
 *     AnimatePresence). Slide-out on stop. Keeps the transition
 *     readable rather than a jarring snap.
 *
 * Accessibility:
 *   • role="alert" so screen readers announce the impersonation
 *     state when it appears.
 *   • The "Stop impersonating" button is keyboard-focusable and
 *     gets the natural primary action of the banner.
 *
 * If react-hot-toast is not installed in your project, replace the
 * `toast.success(...)` and `toast.error(...)` calls with whatever
 * notification mechanism your codebase already uses (or just
 * console.error during development — the banner disappearing on
 * success is itself enough feedback).
 * ════════════════════════════════════════════════════════════════════
 */
export default function ImpersonationBanner() {
  const isImpersonating   = useAuthStore(s => s.isImpersonating());
  const user              = useAuthStore(s => s.user);
  const originalUser      = useAuthStore(s => s.originalUser);
  const stopImpersonating = useAuthStore(s => s.stopImpersonating);

  const [stopping, setStopping] = useState(false);

  const handleStop = async () => {
    if (stopping) return;
    setStopping(true);

    try {
      const res = await adminService.stopImpersonation();
      const { user: admin, token } = res?.data?.data ?? {};

      if (admin && token) {
        // Update store BEFORE showing the toast so the banner unmounts
        // immediately — otherwise the toast fires while the banner is
        // still visible, which looks wrong.
        stopImpersonating(admin, token);
        toast.success(`Welcome back, ${admin.name}`);
      } else {
        // Server returned 200 but with an unexpected body shape.
        // Fail safe: tell the user, leave them in impersonation
        // state so they can retry.
        toast.error('Could not return to your admin account. Please try again.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message
        || 'Failed to stop impersonating. You can also log out and log back in.';
      toast.error(msg);
    } finally {
      setStopping(false);
    }
  };

  return (
    <AnimatePresence>
      {isImpersonating && (
        <motion.div
          role="alert"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{    y: -60, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{
            position:        'sticky',
            top:             0,
            zIndex:          1000,
            background:      'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
            color:           '#fff',
            padding:         '10px 16px',
            display:         'flex',
            alignItems:      'center',
            gap:             12,
            boxShadow:       '0 2px 12px rgba(185, 28, 28, 0.35)',
            borderBottom:    '1px solid rgba(0, 0, 0, 0.15)',
          }}
        >
          {/* Left icon — visual marker that this is impersonation mode */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          32,
            height:         32,
            borderRadius:   8,
            background:     'rgba(255, 255, 255, 0.18)',
            flexShrink:     0,
          }}>
            <Eye size={16} />
          </div>

          {/* Identity copy — emphasises who they're acting as and reminds
              them that their real identity is still attached underneath */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight:    600,
              fontSize:      14,
              lineHeight:    1.3,
              letterSpacing: '-0.01em',
            }}>
              Viewing as {user?.name}
              {user?.role && (
                <span style={{ opacity: 0.85, fontWeight: 500 }}>
                  {' · '}{user.role}
                </span>
              )}
            </div>
            {originalUser && (
              <div style={{
                fontSize:   12,
                opacity:    0.85,
                lineHeight: 1.3,
                marginTop:  1,
              }}>
                Your actions are recorded as {originalUser.name} (admin)
              </div>
            )}
          </div>

          {/* Stop button — bright white-on-red so it never blends in.
              Disabled state shows a spinner instead of the X to signal
              the in-flight server call. */}
          <button
            onClick={handleStop}
            disabled={stopping}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            6,
              padding:        '7px 12px',
              background:     'rgba(255, 255, 255, 0.96)',
              color:          '#B91C1C',
              border:         'none',
              borderRadius:   8,
              fontWeight:     600,
              fontSize:       12,
              letterSpacing:  '0.01em',
              cursor:         stopping ? 'not-allowed' : 'pointer',
              opacity:        stopping ? 0.7 : 1,
              flexShrink:     0,
              transition:     'transform 120ms ease, background 120ms ease',
            }}
            onMouseDown={(e) => {
              if (!stopping) e.currentTarget.style.transform = 'scale(0.97)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {stopping
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <X size={13} />
            }
            {stopping ? 'Returning…' : 'Stop impersonating'}
          </button>

          {/* Inline keyframes for the spinner animation. Keeps this
              component self-contained — no need to ensure spin is
              defined globally in the project's CSS. */}
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}