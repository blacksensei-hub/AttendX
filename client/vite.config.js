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

    rolldownOptions: {
      output: {
        // Long-lived libraries get their own chunks so they stay cached
        // across deploys. Each group also claims the modules its library
        // depends on, so priority decides who gets a shared one: the
        // core every page needs goes first, which stops a heavy
        // page-specific chunk (charts, maps, QR) from swallowing React
        // and then being preloaded on every page, the landing included.
        codeSplitting: {
          groups: [
            { name: 'react-vendor', priority: 30, test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },

            { name: 'motion',   priority: 20, test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: 'query',    priority: 20, test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'http',     priority: 20, test: /node_modules[\\/]axios[\\/]/ },
            { name: 'store',    priority: 20, test: /node_modules[\\/]zustand[\\/]/ },
            { name: 'icons',    priority: 20, test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'toast',    priority: 20, test: /node_modules[\\/]react-hot-toast[\\/]/ },
            { name: 'forms',    priority: 20, test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/ },
            { name: 'dates',    priority: 20, test: /node_modules[\\/]date-fns[\\/]/ },
            { name: 'realtime', priority: 20, test: /node_modules[\\/](socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)[\\/]/ },

            // Only some pages need these; they load with those pages.
            { name: 'charts',   priority: 10, test: /node_modules[\\/](recharts|victory-vendor|d3-[a-z-]+)[\\/]/ },
            { name: 'maps',     priority: 10, test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/ },
            { name: 'qr',       priority: 10, test: /node_modules[\\/](html5-qrcode|qrcode[a-z.-]*)[\\/]/ },
          ],
        },
      },
    },
  },
})