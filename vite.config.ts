/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
  // Lock down plugin/embedded objects and stop an injected <base> from
  // repointing relative URLs (§ hardening — no legitimate use of either here).
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': cspValue,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker auto-updates in the background; the app shows a small
      // "update available" affordance via the virtual:pwa-register hook.
      registerType: 'prompt',
      // The SW is registered via useRegisterSW() in src/components/PwaStatus.tsx
      // (virtual:pwa-register/react), not via an injected inline <script> — the
      // CSP is script-src 'self' with no 'unsafe-inline', which an injected
      // registration snippet would violate.
      injectRegister: false,
      // PWA install metadata. Replaces the ad-hoc apple-/theme- meta tags with
      // a real web app manifest (those meta tags stay in index.html as iOS
      // fallbacks). Icons live in public/icons/.
      manifest: {
        name: 'DepthViz — Underwater Visibility Forecast',
        short_name: 'DepthViz',
        description:
          'Real-time underwater visibility forecasts for spearfishers and freedivers — swell, current and ocean data with AI calibration and community dive reports.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#020d14',
        background_color: '#020d14',
        categories: ['sports', 'weather', 'navigation'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell so the SPA boots with no connectivity at the
        // coast. Skip very large chunks (opencv-js is ~10 MB and only used for
        // on-demand dive-video analysis, which isn't needed offline).
        globPatterns: ['**/*.{js,css,html,woff,woff2,svg,png,ico}'],
        // opencv-js (~11 MB, bundled into opencv.worker-*.js) powers on-demand
        // dive-video analysis only — never precache it, both to keep installs
        // small and because it isn't needed offline.
        globIgnores: ['**/opencv*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // SPA fallback for client-side routes; never hijack the API.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Forecast / tides API data: prefer the network so divers see fresh
            // conditions when online, but fall back to the last cached response
            // when offline. The app also keeps the latest forecast in
            // localStorage (dv_last_forecast) for instant first paint.
            //
            // Scoped to the /api/ base (see API_BASE in src/lib/api.ts) so it
            // matches the JSON endpoints only — NOT the SPA navigation routes
            // /forecast and /tides, which must fall through to navigateFallback.
            urlPattern: /\/api\/(forecast|tides)(\/best)?(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dv-forecast-tides',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // NOTE: map/satellite tiles are intentionally NOT runtime-cached by
          // the service worker. Those tile domains (OSM/NASA GIBS/CoastWatch/
          // EOX) are only in the CSP img-src, not connect-src; a SW fetch() to
          // cache them is a connect-src operation and would be blocked. Issue
          // #171 requires staying within the existing CSP, so we leave tile
          // loading to Leaflet's <img> requests (covered by img-src) and don't
          // widen connect-src here.
        ],
      },
      // Keep the SW out of `npm run dev` to avoid stale-cache confusion during
      // development; verify the offline UX with `npm run build && npm run preview`.
      devOptions: { enabled: false },
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    // opencv-js is ~10 MB on its own; keep the warning from being alarmist.
    chunkSizeWarningLimit: 12_000,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('leaflet')) return 'vendor-leaflet'
          if (id.includes('@supabase')) return 'vendor-supabase'
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
