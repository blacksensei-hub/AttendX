import api from './api';

/**
 * ════════════════════════════════════════════════════════════════════
 * Admin service — admin-only API helpers.
 *
 * Currently scoped to impersonation since that's what we're shipping
 * first. As the admin dashboard grows (user list, at-risk flagging,
 * heatmap data feeds), additional methods land here so components
 * stay component-shaped and the API surface stays in one place.
 * ════════════════════════════════════════════════════════════════════
 */
const adminService = {
  // ─── Impersonation ──────────────────────────────────────────────

  /**
   * Begin viewing the system as another user.
   *
   * @param  {string}  userId   target user id (must not be an admin
   *                            and must be active)
   * @param  {string}  reason   optional free-text reason — recommended
   *                            for compliance even though the server
   *                            doesn't enforce it
   * @return {Promise<{ user, token, originalUser, impersonationId }>}
   *         Server response shape. Component callers should pass
   *         { user, token } to authStore.startImpersonating.
   */
  startImpersonation(userId, reason) {
    return api.post(
      `/impersonation/start/${userId}`,
      reason ? { reason } : {}
    );
  },

  /**
   * Return to the admin account.
   *
   * The current axios instance will send the IMPERSONATION token
   * (because authStore.token currently holds the impersonation JWT).
   * The server reads the impersonated_by claim, fills in the audit
   * log's ended_at, and issues a fresh admin token.
   *
   * Component callers should pass the returned { user, token } to
   * authStore.stopImpersonating.
   */
  stopImpersonation() {
    return api.post('/impersonation/stop');
  },

  /**
   * List recent impersonation events. Admin-only on the server side.
   * Powers the audit dashboard (built in a later chunk).
   */
  listImpersonationLogs() {
    return api.get('/impersonation/logs');
  },
};

export default adminService;