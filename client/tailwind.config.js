/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          DEFAULT: 'var(--bg)',
          card:    'var(--bg-card)',
          raised:  'var(--bg-raised)',
          border:  'var(--border)',
          hover:   'var(--bg-hover)',
        },
      },
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'slide-up':      'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':       'fadeIn 0.3s ease both',
        'scale-in':      'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse-dot':     'pulseDot 2s ease infinite',
        'count-up':      'countUp 0.6s ease both',
        'spin':          'spin 0.8s linear infinite',
      },
      keyframes: {
        slideUp:  { from: { opacity:'0', transform:'translateY(24px)' }, to: { opacity:'1', transform:'translateY(0)' } },
        fadeIn:   { from: { opacity:'0' }, to: { opacity:'1' } },
        scaleIn:  { from: { opacity:'0', transform:'scale(0.9)' }, to: { opacity:'1', transform:'scale(1)' } },
        pulseDot: { '0%,100%': { transform:'scale(1)', opacity:'1' }, '50%': { transform:'scale(1.4)', opacity:'0.7' } },
        countUp:  { from: { opacity:'0', transform:'translateY(10px)' }, to: { opacity:'1', transform:'translateY(0)' } },
      },
    },
  },
  plugins: [],
};