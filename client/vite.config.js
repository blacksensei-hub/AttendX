import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'
import { visualizer }   from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),

    // Generates dist/stats.html after each build — open in a
    // browser to see a treemap of every chunk's contents.
    // Set open: true if you want it to auto-open after build.
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: false,
      template: 'treemap',  // also: 'sunburst', 'network'
    }),
  ],

  build: {
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // React core
          if (id.includes('react-dom')           ||
              id.includes('react-router-dom')    ||
              id.includes('react/jsx-runtime')   ||
              id.match(/[\\/]node_modules[\\/]react[\\/]/)) {
            return 'react-vendor';
          }

          // Charting
          if (id.includes('recharts')) return 'charts';
          if (id.includes('d3-'))      return 'd3';

          // Animation
          if (id.includes('framer-motion')) return 'motion';

          // Data
          if (id.includes('@tanstack/react-query')) return 'query';
          if (id.includes('axios'))                 return 'http';
          if (id.includes('zustand'))               return 'store';

          // UI
          if (id.includes('lucide-react'))     return 'icons';
          if (id.includes('react-hot-toast'))  return 'toast';

          // QR
          if (id.includes('html5-qrcode') || id.includes('qrcode')) return 'qr';

          // Maps
          if (id.includes('leaflet') || id.includes('mapbox')) return 'maps';

          // Date
          if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
            return 'dates';
          }

          // Socket.io / realtime
          if (id.includes('socket.io')) return 'realtime';

          // Form handling
          if (id.includes('react-hook-form') || id.includes('formik')) return 'forms';

          return 'vendor';
        },
      },
    },
  },
})