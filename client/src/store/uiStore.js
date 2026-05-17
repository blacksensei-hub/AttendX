import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        document.documentElement.classList.toggle('dark', next === 'dark');
        document.documentElement.classList.toggle('light', next === 'light');
      },

      initTheme: () => {
        const theme = get().theme;
        document.documentElement.classList.toggle('dark',  theme === 'dark');
        document.documentElement.classList.toggle('light', theme === 'light');
      },
    }),
    {
      name: 'attendx-ui',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);