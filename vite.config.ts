import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Full CSP shared across dev, preview, and production (public/_headers).
// 'unsafe-eval' + 'wasm-unsafe-eval' are required because the Emscripten glue
// code inside @techstark/opencv-js uses `new Function(…)` at runtime.
const cspValue = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "connect-src 'self' https://*.supabase.co https://geocoding-api.open-meteo.com",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': cspValue,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export default defineConfig({
  plugins: [react()],
  build: {
    // opencv-js is ~10 MB on its own; keep the warning from being alarmist.
    chunkSizeWarningLimit: 12_000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-supabase': ['@supabase/supabase-js'],
          // opencv is imported only inside src/workers/opencv.worker.ts;
          // Vite bundles it into the worker chunk automatically.
        },
      },
    },
  },
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
})
