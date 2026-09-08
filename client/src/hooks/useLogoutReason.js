// client/src/hooks/useLogoutReason.js
import { useEffect } from 'react';
import toast from 'react-hot-toast';

const KEY = 'attendx.logout_reason';

/**
 * Shows (once) the reason a session was ended, if one was stashed before
 * the redirect to /login.
 *
 * ForceLogoutListener fires a toast at the moment of revocation, but a
 * hard reload wipes it — and on a phone the user may not even be looking
 * at the screen. Persisting the reason means they still find out why
 * they were signed out when they arrive at the login page.
 *
 * Reads and clears in one go, so a later refresh doesn't replay it.
 */
export function useLogoutReason() {
  useEffect(() => {
    let reason = null;
    try {
      reason = sessionStorage.getItem(KEY);
      if (reason) sessionStorage.removeItem(KEY);
    } catch {
      return;
    }

    if (reason) {
      // Slight delay so the toast isn't swallowed by the login page's
      // own mount animation.
      const id = setTimeout(() => toast.error(reason, { duration: 6000 }), 300);
      return () => clearTimeout(id);
    }
  }, []);
}