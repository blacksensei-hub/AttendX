import axios            from 'axios';
import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '../store/authStore';

/**
 * ═════════════════════════════════════════════════════════════════
 * api.js — axios instance for all backend requests.
 *
 * Responsibilities:
 *   • Base URL resolution (env var with LAN fallback for dev)
 *   • Sensible defaults (JSON, 15s timeout)
 *   • Request interceptor: attaches the bearer token from SecureStore
 *     to every outgoing request
 *   • Response interceptor: handles global 401s by resetting auth
 *     state via the Zustand store, so protected routes can react
 *     and redirect to /login immediately
 * ═════════════════════════════════════════════════════════════════
 */

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'http://192.168.1.129:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach bearer token ────────────────
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — global 401 handling ───────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // A 401 means the token is invalid or expired. Blow away auth
    // state entirely so the root layout's auth watcher boots the
    // user back to the login screen.
    //
    // getState() reaches into the Zustand store imperatively —
    // safe to call from outside React components.
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

export default api;