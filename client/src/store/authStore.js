import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * ════════════════════════════════════════════════════════════════════
 * Auth store — extended with impersonation support.
 *
 * Normal state:
 *   user             = the logged-in user
 *   token            = their JWT
 *   originalUser     = null
 *   originalToken    = null
 *
 * Impersonating state (admin viewing as another user):
 *   user             = the TARGET user (so the rest of the app behaves
 *                      as if that user is logged in)
 *   token            = the impersonation JWT (carries impersonated_by
 *                      claim that the backend reads)
 *   originalUser     = the ADMIN who initiated the impersonation
 *   originalToken    = the admin's pre-impersonation JWT (kept only
 *                      as a UI hint — not used to recover; recovery
 *                      goes through /api/impersonation/stop which
 *                      issues a brand new admin token from the server)
 *
 * Why originalUser/originalToken are persisted:
 *   If the admin closes their browser mid-impersonation and returns
 *   later, the persisted state still shows impersonation, the banner
 *   still renders, and "Stop impersonating" still works. Without
 *   persisting these fields, refresh would orphan the user inside the
 *   impersonated identity with no obvious way out.
 * ════════════════════════════════════════════════════════════════════
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:          null,
      token:         null,
      isAuthenticated: false,

      // ── Impersonation state ────────────────────────────────────
      // These are only set while an admin is "viewing as" another
      // user. They are cleared on stopImpersonating() and on logout().
      originalUser:  null,
      originalToken: null,

      // ── Existing actions ───────────────────────────────────────
      setAuth: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
      }),

      updateUser: (updates) => set(state => ({
        user: { ...state.user, ...updates },
      })),

      logout: () => {
        // Clear EVERYTHING including impersonation state. A logout
        // from an impersonation session also ends the impersonation
        // (the audit log will have null ended_at, which is documented
        // as expected — the cleanup job can backfill later).
        set({
          user:           null,
          token:          null,
          isAuthenticated: false,
          originalUser:   null,
          originalToken:  null,
        });
        // Clear query cache on logout
        window.__qc?.clear();
      },

      // ── New impersonation actions ──────────────────────────────

      /**
       * Called after a successful POST /api/impersonation/start/:userId.
       * Stashes the current admin context as "original" and swaps the
       * active user/token to the target user's identity.
       *
       * The current state's user/token are guaranteed to be the admin's
       * because /start requires authorize('admin') on the server, which
       * rejects any token whose role !== 'admin'.
       */
      startImpersonating: (target, targetToken) => set(state => ({
        originalUser:    state.user,
        originalToken:   state.token,
        user:            target,
        token:           targetToken,
        isAuthenticated: true,
      })),

      /**
       * Called after a successful POST /api/impersonation/stop.
       * The server returns a freshly minted admin token (we do not
       * reuse originalToken because it may have expired during the
       * impersonation session).
       *
       * If the server call fails, do NOT call this — leave the
       * impersonation state intact so the user can retry. Calling
       * this prematurely would leave them in a state where they
       * appear logged in as admin but their token is the now-revoked
       * originalToken, which would 401 on the next request.
       */
      stopImpersonating: (admin, adminToken) => set({
        user:            admin,
        token:           adminToken,
        originalUser:    null,
        originalToken:   null,
        isAuthenticated: true,
      }),

      // ── Selectors ──────────────────────────────────────────────
      isLecturer:      () => get().user?.role === 'lecturer',
      isStudent:       () => get().user?.role === 'student',
      isAdmin:         () => get().user?.role === 'admin',

      /**
       * True iff this session was initiated by an admin who chose
       * "view as". The originalToken is the canonical signal because
       * it's set BY startImpersonating and cleared BY both
       * stopImpersonating and logout — there is no path that leaves
       * it in an inconsistent state.
       */
      isImpersonating: () => Boolean(get().originalToken),

      /**
       * Returns the actual admin behind this session, or null if not
       * impersonating. Useful for the banner and for any UI that
       * wants to surface "this action will be performed AS [target]
       * BY [admin]".
       */
      getOriginalAdmin: () => get().originalUser,
    }),
    {
      name: 'attendx-auth',
      partialize: (state) => ({
        user:            state.user,
        token:           state.token,
        isAuthenticated: state.isAuthenticated,
        // Persist impersonation fields so refresh-during-impersonation
        // restores cleanly. Without these, a refresh would lose the
        // banner and trap the admin inside the target user's view.
        originalUser:    state.originalUser,
        originalToken:   state.originalToken,
      }),
    }
  )
);