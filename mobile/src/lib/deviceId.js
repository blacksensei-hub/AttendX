// mobile/src/lib/deviceId.js
//
// Stable per-install device identifier.
//
// WHY THIS EXISTS
// AttendX flags "proxy attendance" — one student marking attendance on
// behalf of others, typically by logging into their friends' accounts on
// a single phone. The signature of that fraud is: many DIFFERENT student
// accounts marking attendance from the SAME device.
//
// We deliberately do NOT key that detection on IP address: an entire class
// shares one classroom WiFi IP, so "many students from one IP" describes a
// normal lecture, not fraud. The device is the signal that cuts through it.
//
// WHAT THIS CAN AND CANNOT DO — be honest about the limits:
//   • Managed Expo cannot read a true hardware ID (e.g. Android's
//     ANDROID_ID) without native code, so we generate a UUID on first
//     launch and persist it instead.
//   • SecureStore survives app restarts and updates. On iOS it also
//     survives uninstall/reinstall (iOS Keychain behaviour); on Android
//     it is cleared on uninstall.
//   • So a determined student CAN reset their ID by reinstalling on
//     Android. That's a far higher bar than simply logging into a
//     friend's account, which is the behaviour we're actually deterring.
//     This raises the cost of cheating; it does not make it impossible.

import * as SecureStore from 'expo-secure-store';
import * as Crypto      from 'expo-crypto';

const DEVICE_ID_KEY = 'attendx.device_id';

// In-memory cache so repeated calls in one session don't re-hit storage.
let cachedId = null;

/**
 * Returns this install's stable device ID, creating it on first call.
 * Never throws — on any storage failure it falls back to a session-only
 * ID so that marking attendance is never blocked by this feature.
 */
export async function getDeviceId() {
  if (cachedId) return cachedId;

  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      cachedId = existing;
      return cachedId;
    }

    const fresh = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh);
    cachedId = fresh;
    return cachedId;
  } catch (err) {
    // Storage unavailable (rare). Fall back to an in-memory ID: detection
    // degrades for this session, but attendance still works. Never let a
    // secondary anti-fraud signal break the primary flow.
    console.warn('[deviceId] SecureStore unavailable, using session ID:', err?.message);
    cachedId = cachedId ?? `session-${Crypto.randomUUID()}`;
    return cachedId;
  }
}