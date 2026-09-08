// client/src/components/ForceLogoutListener.jsx
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

import { useAuthStore } from '../store/authStore';

/**
 * ═════════════════════════════════════════════════════════════════
 * ForceLogoutListener — ends the session when the server says so.
 *
 * The server bumps token_version when an admin resets a device, which
 * makes the old token fail on its NEXT request. That's the actual
 * security guarantee. This component only changes the timing: it
 * listens on the user's personal socket room so a device that's
 * currently open is signed out immediately, with an explanation,
 * rather than sitting on a dead session until the user next clicks
 * something and gets a confusing error.
 *
 * Why its own socket rather than useSocket(): useSocket only connects
 * when given a sessionId, so it's idle on every page except the live
 * session view — which is exactly where a student being reset usually
 * isn't. This one connects whenever a token exists.
 *
 * Best-effort by design. A closed tab or offline phone receives
 * nothing, and relies on the token_version check instead.
 * ═════════════════════════════════════════════════════════════════
 */
export default function ForceLogoutListener() {
  const token  = useAuthStore(s => s.token);
  const logout = useAuthStore(s => s.logout);

  useEffect(() => {
    if (!token) return;

    const socket = io(
      import.meta.env.VITE_WS_URL || 'http://localhost:5000',
      {
        auth:              { token },
        transports:        ['websocket'],
        reconnectionDelay: 2000,
      }
    );

    const handleForceLogout = (payload) => {
      const reason = payload?.reason
        || 'Your session has been ended. Please sign in again.';

      toast.error(reason, { duration: 6000 });

      // Stash the reason so the login page can surface it too. A hard
      // reload wipes in-memory toasts, and on a phone the user may not
      // be looking at the screen when this fires.
      try { sessionStorage.setItem('attendx.logout_reason', reason); } catch {}

      logout();

      // Delay the redirect: navigating immediately unmounts the page in
      // the same tick the toast is created, so it never gets painted.
      // The session is already dead server-side (token_version bumped),
      // so this pause costs nothing in security terms.
      //
      // Full reload rather than a router navigate: it guarantees every
      // cached query, socket and in-memory bit of the old session is
      // discarded, which is what we want when a session is revoked.
      setTimeout(() => { window.location.href = '/login'; }, 2200);
    };

    socket.on('auth:force_logout', handleForceLogout);

    return () => {
      socket.off('auth:force_logout', handleForceLogout);
      socket.disconnect();
    };
  }, [token, logout]);

  return null;
}