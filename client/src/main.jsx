import React               from 'react';
import ReactDOM            from 'react-dom/client';
import { QueryClient,
         QueryClientProvider } from '@tanstack/react-query';
import { Toaster }         from 'react-hot-toast';
import App                 from './App';

// Single source of truth — all tokens, components, animations, and
// accessibility rules live here. Do not import any other stylesheet.
import './App.css';

// ─── Query client ─────────────────────────────────────────────
// Tuned defaults for an attendance app:
//   • staleTime 2min       — most data doesn't change that often
//   • gcTime    10min      — keep cache around for back-nav
//   • retry     1          — don't bombard a flaky API
//   • refetchOnWindowFocus false — was causing flicker
//   • refetchOnReconnect   — silently rebuild after WiFi blips
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:                1,
      staleTime:            2  * 60 * 1000,
      gcTime:               10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />

      {/*
        Toaster — uses the design system tokens so toasts match
        the active theme automatically (light or dark) and follow
        the same radius + shadow language as the rest of the app.
      */}
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 4000,
          style: {
            background:    'var(--toast-bg)',
            color:         'var(--toast-text)',
            border:        '1px solid var(--toast-border)',
            borderRadius:  'var(--radius-molecular)',
            boxShadow:     'var(--shadow-lg)',
            fontSize:      'var(--text-sm)',
            fontFamily:    'var(--font-body)',
            padding:       '12px 16px',
            maxWidth:      '380px',
          },
          success: {
            iconTheme: {
              primary:   'var(--green)',
              secondary: 'var(--toast-bg)',
            },
          },
          error: {
            iconTheme: {
              primary:   'var(--red)',
              secondary: 'var(--toast-bg)',
            },
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);