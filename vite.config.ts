/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Full CSP shared across dev, preview, and production (public/_headers).
// 'unsafe-eval' + 'wasm-unsafe-eval' are required because the Emscripten glue
// code inside @techstark/opencv-js uses `new Function(…)` at runtime.
const cspValue = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Map tiles (OpenStreetMap) + satellite imagery fetched directly by the
  // browser: NASA GIBS (true-colour), NOAA CoastWatch ERDDAP (chlorophyll),
  // and EOX (10 m Sentinel-2 cloudless). Keep in sync with public/_headers
  // and the inline CSP in index.html.
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://gibs.earthdata.nasa.gov https://coastwatch.noaa.gov https://tiles.maps.eox.at",
  "connect-src 'self' https://*.supabase.co https://geocoding-api.open-meteo.com",
  "font-src 'self'",
  // Dive-video analysis loads user-selected clips into a <video> element via
  // blob: URLs (URL.createObjectURL). Without this, media-src falls back to
  // default-src 'self' and the browser rejects the load ("Media load rejected
  // by URL safety check").
  "media-src 'self' blob:",
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
  worker: {
    format: 'es',
  },
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
  test: {
    // src/lib/supabase.ts throws at import time without these, which broke
    // any test that (transitively) imports lib/api.ts on a fresh clone with
    // no .env. Tests never talk to Supabase — stub values are enough.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
