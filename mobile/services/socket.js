import { io } from 'socket.io-client';
import Constants from 'expo-constants';

import { useAuthStore } from '../store/authStore';

/**
 * ═════════════════════════════════════════════════════════════════
 * Socket service — singleton manager for the lecturer mobile app.
 *
 * Design notes:
 *
 * • Mirrors the web app's `useSocket` hook (client/src/hooks/useSocket.js)
 *   so the backend doesn't need to know which client is connecting.
 *   Same auth shape ({ token } in handshake.auth), same join/leave events,
 *   same room naming. The server-side socket config we're connecting to
 *   lives in server/src/config/socket.js.
 *
 * • Singleton, not a hook. The web app uses a hook because each
 *   component manages its own connection lifecycle; on mobile we have
 *   exactly one screen that needs sockets right now (the live session
 *   view) so a singleton is simpler. If we ever need sockets on the
 *   student app for live session-opened notifications, we'd export
 *   a `useSocket` hook that wraps this singleton.
 *
 * • Listener registry, not raw socket.on. We track per-event listeners
 *   in an internal Map so we can re-attach them automatically on
 *   reconnect. socket.io-client *does* auto-reconnect by default, but
 *   without re-attaching listeners and re-joining rooms, the connection
 *   would silently stop receiving events after a network blip.
 * ═════════════════════════════════════════════════════════════════
 */

// Resolve the WebSocket URL.
// Order of precedence:
//   1. EXPO_PUBLIC_WS_URL (explicit override for Socket.io)
//   2. EXPO_PUBLIC_API_URL with /api stripped (most users will set this)
//   3. localhost fallback (will only work in iOS simulator on the same
//      machine; Android emulator and physical devices will fail here
//      and the user will need to set EXPO_PUBLIC_WS_URL)
function resolveSocketUrl() {
  const explicit = process.env.EXPO_PUBLIC_WS_URL
    ?? Constants.expoConfig?.extra?.wsUrl;
  if (explicit) return explicit;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL
    ?? Constants.expoConfig?.extra?.apiUrl;
  if (apiUrl) return apiUrl.replace(/\/api\/?$/, '');

  return 'http://localhost:5000';
}

class SocketManager {
  constructor() {
    this.socket    = null;
    this.connected = false;
    // Map of event name → Set of callback functions. We use a Set so
    // callers can register the same callback twice without duplication
    // (defensive against re-renders that might re-call .on()).
    this.listeners = new Map();
    // Set of sessions we've joined, so we can re-join on reconnect.
    this.joinedSessions = new Set();
  }

  /* ── Connect ──────────────────────────────────────────────── */
  connect() {
    if (this.socket?.connected) return this.socket;

    const token = useAuthStore.getState().token;
    if (!token) {
      console.warn('[Socket] No auth token — skipping connect');
      return null;
    }

    const url = resolveSocketUrl();
    console.log(`[Socket] Connecting to ${url}`);

    this.socket = io(url, {
      auth:                  { token },
      transports:            ['websocket'],
      reconnection:          true,
      reconnectionDelay:     2000,
      reconnectionDelayMax:  10000,
      reconnectionAttempts:  Infinity,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[Socket] Connected');

      // Re-join any sessions we were in before the disconnect, and re-attach
      // every listener. socket.io's auto-reconnect creates a fresh server-side
      // session under the hood, so room membership and listeners must be
      // reapplied after each successful reconnect.
      for (const sessionId of this.joinedSessions) {
        this.socket.emit('join-session', sessionId);
      }
      for (const [event, callbacks] of this.listeners) {
        for (const cb of callbacks) {
          this.socket.on(event, cb);
        }
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log(`[Socket] Disconnected: ${reason}`);
    });

    this.socket.on('connect_error', (err) => {
      console.warn(`[Socket] Connection error: ${err.message}`);
    });

    return this.socket;
  }

  /* ── Disconnect ──────────────────────────────────────────── */
  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket    = null;
    this.connected = false;
    this.joinedSessions.clear();
    this.listeners.clear();
  }

  /* ── Join / leave sessions ───────────────────────────────── */
  // We track joined sessions so reconnect can re-join automatically.
  joinSession(sessionId) {
    if (!sessionId) return;
    this.joinedSessions.add(sessionId);
    this.socket?.emit('join-session', sessionId);
  }

  leaveSession(sessionId) {
    if (!sessionId) return;
    this.joinedSessions.delete(sessionId);
    this.socket?.emit('leave-session', sessionId);
  }

  /* ── Event subscription ──────────────────────────────────── */
  // Returns an unsubscribe function so callers can clean up easily,
  // matching React's useEffect return-value pattern.
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    this.socket?.on(event, callback);

    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
    this.socket?.off(event, callback);
  }
}

// Export a single shared instance — the rest of the app imports this.
const socketManager = new SocketManager();
export default socketManager;