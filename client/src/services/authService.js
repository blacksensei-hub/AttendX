// client/src/services/authService.js
//
// Every backend response is shaped as { success, data, message }.
// We unwrap to res.data.data so callers receive the payload
// directly without having to dig through the wrapper.

import api from './api';

export const authService = {
  register: async (data) => {
    const res = await api.post('/auth/register', data);
    return res.data?.data ?? res.data;
  },

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
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