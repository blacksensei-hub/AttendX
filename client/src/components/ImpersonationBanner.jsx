import { useState }                from 'react';
import { useNavigate }             from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, X, Loader2 }         from 'lucide-react';
import toast                       from 'react-hot-toast';

import { useAuthStore }            from '../store/authStore';
import { stopImpersonation }       from '../services/adminService';
import { SPRING }                  from '../lib/motion';

/**
 * ═════════════════════════════════════════════════════════════════
 * ImpersonationBanner — the way back from "view as".
 *
 * While an admin is viewing the app as another user, a floating bar
 * stays pinned to the bottom of every screen: who they are viewing
 * as, that their actions are recorded against their own admin
 * account, and a Stop button that swaps the admin's own token back
 * in and returns them to the admin area.
 *
 * Rendered by AppShell, so it shows on lecturer, student and admin
 * routes alike and survives navigation.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ImpersonationBanner() {
  const isImpersonating   = useAuthStore(s => Boolean(s.originalToken));
  const user              = useAuthStore(s => s.user);
  const originalUser      = useAuthStore(s => s.originalUser);
  const stopImpersonating = useAuthStore(s => s.stopImpersonating);
  const navigate          = useNavigate();
  const [stopping, setStopping] = useState(false);

  const handleStop = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      // The service unwraps the API envelope: { user, token }
      const { user: admin, token } = await stopImpersonation();
      if (!admin || !token) throw new Error('unexpected response');
      stopImpersonating(admin, token);
      toast.success(`Welcome back, ${admin.name}`);
      navigate('/admin', { replace: true });
    } catch (err) {
      toast.error(
        err?.response?.data?.message
          || 'Could not return to your admin account. Sign out and back in if this keeps happening.'
      );
    } finally {
      setStopping(false);
    }
  };

  return (
    <AnimatePresence>
      {isImpersonating && (
        <motion.div
          role="status"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={SPRING.snappy}
          style={{
            position:     'fixed',
            left:         '50%',
            bottom:       'max(16px, env(safe-area-inset-bottom))',
            translate:    '-50% 0',
            zIndex:       60,
            width:        'min(640px, calc(100% - 24px))',
            display:      'flex',
            alignItems:   'center',
            gap:          12,
            padding:      '10px 10px 10px 14px',
            borderRadius: 'var(--radius-molecular)',
            background:   'var(--red-fill)',
            color:        '#fff',
            boxShadow:    '0 18px 40px -16px rgba(196, 37, 54, 0.6)',
          }}
        >
          <Eye size={17} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
            <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Viewing as {user?.name}{user?.role ? ` · ${user.role}` : ''}
            </p>
            {originalUser && (
              <p style={{ fontSize: 'var(--text-xs)', opacity: 0.85 }}>
                Actions are recorded as {originalUser.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleStop}
            disabled={stopping}
            className="btn-ghost"
            style={{ background: '#fff', color: 'var(--red)', borderColor: 'transparent', padding: '8px 12px', flexShrink: 0 }}
          >
            {stopping ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            {stopping ? 'Returning' : 'Stop'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
