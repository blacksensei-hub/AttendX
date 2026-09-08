// client/src/lib/deviceId.js
//
// Stable per-browser device identifier, used for account device binding.
//
// WHY THIS EXISTS
// A student account is locked to a single device: on first login the
// device ID is recorded against the account, and later logins from a
// different device are rejected. That stops a student handing their
// credentials to a friend to mark attendance on their behalf.
//
// HONEST LIMITATION — worth knowing and worth stating in any writeup:
// this ID lives in localStorage, which the user controls. Clearing site
// data, using a private/incognito window, or switching browsers all
// produce a NEW id. So web-side binding deters casual credential sharing
// but does not stop a determined user. The mobile binding (SecureStore)
// is meaningfully more durable, which is why the mobile app is the
// stronger half of this defence.
//
// Kept deliberately simple: no fingerprinting of screen size, fonts,
// canvas, etc. Those are more tamper-resistant but are also a privacy
// concern and can collide between identical devices.

const DEVICE_ID_KEY = 'attendx.device_id';

// In-memory cache so repeated calls in one page session skip storage.
let cachedId = null;

/**
 * Returns this browser's device ID, creating and persisting one on first
 * call. Never throws — if storage is unavailable (private mode in some
 * browsers, storage disabled) it falls back to a session-only id so login
 * is never blocked outright by this helper.
 */
export function getDeviceId() {
  if (cachedId) return cachedId;

  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cachedId = existing;
      return cachedId;
    }

    const fresh = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, fresh);
    cachedId = fresh;
    return cachedId;
  } catch (err) {
    console.warn('[deviceId] localStorage unavailable, using session id:', err?.message);
    cachedId = cachedId ?? `session-${generateUUID()}`;
    return cachedId;
  }
}

// crypto.randomUUID needs a secure context (https or localhost). On a LAN
// address over plain http it can be undefined, so fall back to a
// crypto-backed v4 builder, then to Math.random as a last resort.
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}