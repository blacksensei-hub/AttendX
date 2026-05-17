import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const useAuthStore = create((set, get) => ({
  user:            null,
  token:           null,
  isAuthenticated: false,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync('token', token);
    set({ user, token, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        set({ token, isAuthenticated: true });
        return token;
      }
    } catch { /* ignore */ }
    return null;
  },

  isLecturer: () => get().user?.role === 'lecturer',
  isStudent:  () => get().user?.role === 'student',
}));