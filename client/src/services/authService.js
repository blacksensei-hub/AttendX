// client/src/services/authService.js
//
// Every backend response is shaped as { success, data, message }.
// We unwrap to res.data.data so callers receive the payload
// directly without having to dig through the wrapper.
//
// Device binding: login and register attach this browser's device id, plus
// platform: 'web', so the backend can bind this account's WEB slot. Binding
// is per platform — a student can be logged into their laptop browser and
// their phone at the same time, since each platform has its own slot. The
// id is read here rather than passed in by callers, so pages calling
// login(email, password) need no changes — there's also no way for a
// caller to forget to send it, which would silently bypass the check.

import api             from './api';
import { getDeviceId } from '../lib/deviceId';

export const authService = {
  register: async (data) => {
    // Bind the account's web slot to this device at signup, so the very
    // first session is already tied to a device rather than binding on a
    // later login (which could be from someone else's browser).
    const res = await api.post('/auth/register', {
      ...data,
      deviceId: getDeviceId(),
      platform: 'web',
    });
    return res.data?.data ?? res.data;
  },

  login: async (email, password) => {
    const res = await api.post('/auth/login', {
      email,
      password,
      deviceId: getDeviceId(),
      platform: 'web',
    });
    return res.data?.data ?? res.data;
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data?.data ?? res.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return res.data?.data ?? res.data;
  },
};