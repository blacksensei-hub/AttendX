import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * UI store — theme preference.
 *
 * Light is the default for the Roll Call redesign. The persisted
 * store is versioned: version 1 saved 'dark' as the old default for
 * everyone, so the migration resets it once to light. Anyone who
 * switches back to dark after that keeps their choice.
 */
export const useUIStore = create(
  persist(
    (set, get) => ({
      theme: 'light',

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
      name:       'attendx-ui',
      version:    2,
      migrate:    () => ({ theme: 'light' }),
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
