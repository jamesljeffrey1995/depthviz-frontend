# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DepthViz — an underwater visibility forecast app for spearfishers and freedivers. This repo is the **frontend only**: a React SPA that talks to a separate backend REST API (not in this repo) for all business data, and to Supabase directly only for auth. There is no server-side code here beyond `supabase/dispute-evidence.sql` (a reference schema snippet) and `nginx.conf.example` (deployment reference).

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc typecheck + vite build — this IS the typecheck step, there's no separate `tsc --noEmit` script
npm run preview    # serve the production build locally (needed to test PWA/offline behavior — the SW is disabled in `dev`)
npm test           # vitest run (all tests, one-shot)
```

Run a single test file: `npx vitest run src/lib/units.test.ts`
Run tests matching a name: `npx vitest run -t "some test name"`
There is no lint script yet (CI runs `npm run lint --if-present` as a no-op placeholder for issue #165).

Tests live next to the module they cover (`foo.ts` / `foo.test.ts`), all under `src/lib/`. `vite.config.ts` stubs `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` for the test environment since `src/lib/supabase.ts` throws at import time if they're missing — tests never talk to Supabase.

## Environment variables

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project, used only for auth (magic-link email OTP via `useAuth`)
- `VITE_API_URL` — base URL for the backend REST API, defaults to `/api` (see `src/lib/api.ts`)
- `VITE_ADMIN_EMAIL` — used client-side for admin UI hints; the server is the actual authority on admin status (see below)

## Architecture

### Backend split
Almost everything other than login goes through `src/lib/api.ts` (~670 lines, one function per endpoint) hitting the backend API at `VITE_API_URL` — forecasts, locations, reports, catches, apnea tables, forum, news, ML/admin endpoints, friends, disputes. Auth is the one thing that talks directly to Supabase (`src/lib/supabase.ts`, `src/hooks/useAuth.ts`) via magic-link OTP; there's no password flow.

Admin UI (`AdminPanel`, ML/admin routes) is gated client-side by `getMyProfile().is_admin`, but that flag — and every `/admin/*` request — is re-checked server-side. Never treat a client-side `isAdmin` flag as a real security boundary when touching this code.

### App shell (`src/App.tsx`)
Single large component owning almost all client state (current location, units, selected day, dive depth, auth modal, admin flag) and all routing (`react-router-dom`). Nearly every route component is lazy-loaded via `React.lazy`. Two route-group constants matter when adding pages:
- `FORECAST_ROUTES` — pages that depend on a loaded forecast; on startup only these restore the cached forecast from `localStorage` (`dv_last_forecast`) and revalidate. The home route (`/`) intentionally does *not* trigger a conditions fetch.
- `MAP_GROUP_ROUTES` — routes that keep the bottom-nav "Map" tab highlighted.

Location/forecast/units state persists to `localStorage` (`dv_last_location`, `dv_last_forecast`, `dv_units`, `diveDepth`) for instant first paint and offline resilience.

### Three distinct "visibility" modules — don't conflate them
- `src/lib/visibility.ts` — small client-side display helpers (`getImpact`, `getShallowWaterConfidence`) used by `VisibilityDisplay`/`DayDetail` to render the *server-computed* forecast's factor breakdown. Does not itself compute a forecast.
- `src/lib/underwaterVisibility.ts` — types/orchestration for the **on-device dive-video analysis** feature (`VisibilityAnalyser`, `ReportForm`): extracts frames from a user's video and estimates visibility from them.
- `src/lib/visibilityMath.ts` — the actual dark-channel/Beer-Lambert math (`beerLambert`, `transmissionFromDarkChannel`, `percentile`) used inside `src/workers/opencv.worker.ts`.

The forecast model itself (baseline visibility, swell/wind/precipitation/humidity penalties, 7-day historical decay) lives server-side; this repo only renders it.

### Dive-video analysis pipeline (OpenCV in a worker)
`VisibilityAnalyser` → `webcodecsFrameExtractor.ts` (pulls frames from a user-selected video via WebCodecs, loaded as a `blob:` URL) → posts frames to `src/workers/opencv.worker.ts` → worker runs OpenCV.js (`@techstark/opencv-js`, statically imported so it bundles into the worker chunk — a dynamic runtime fetch was found to hang silently on iOS Safari under memory pressure) → dark-channel prior + Beer-Lambert to estimate transmission/visibility per frame, aggregated into `VisibilityStats`.

`@techstark/opencv-js` is ~10-11MB. It's excluded from the PWA precache (`globIgnores: ['**/opencv*']` in `vite.config.ts`) and given its own manual chunk boundary via Rollup — it should only ever load on-demand for this feature, never in the main bundle.

### CSP is load-bearing and easy to break silently
The Content-Security-Policy is defined in three places that must stay in sync: `vite.config.ts` (`cspValue`, applied to dev/preview server headers), `public/_headers` (Cloudflare Pages/Netlify), and `nginx.conf.example` (self-hosted reference). Key non-obvious requirements baked into the policy:
- `script-src` needs `'unsafe-eval' 'wasm-unsafe-eval'` because OpenCV.js's Emscripten glue calls `new Function(...)` at runtime — omitting this breaks video analysis with a silent `EvalError`.
- `media-src 'self' blob:` is required for the video analysis feature (`URL.createObjectURL` on user-selected clips) — without it the browser rejects the load.
- `connect-src` is intentionally *not* widened to the map/satellite tile domains (OSM, NASA GIBS, NOAA ERDDAP, EOX) — those are `img-src` only, loaded as plain `<img>`/tile requests, not fetched by the service worker. See the `runtimeCaching` comment in `vite.config.ts` (issue #171) before "fixing" this.
- Browsers give HTTP response CSP headers precedence over the `<meta http-equiv="Content-Security-Policy">` in `index.html` — if a server sends any CSP header, the meta tag is ignored, so self-hosters must set the header server-side (see `nginx.conf.example`).

### PWA / service worker
Configured via `vite-plugin-pwa` in `vite.config.ts`. Disabled in `npm run dev` (`devOptions.enabled: false`) to avoid stale-cache confusion — test offline/SW behavior with `npm run build && npm run preview`. Registration happens through `useRegisterSW()` (`virtual:pwa-register/react`) inside `src/components/PwaStatus.tsx`, not an injected inline script, because the CSP has no `'unsafe-inline'` in `script-src`. Forecast/tides API responses use a `NetworkFirst` runtime-caching strategy scoped tightly to `/api/(forecast|tides)(/best)?` so it never swallows SPA navigation routes like `/forecast` or `/tides`.

### Units and encryption
- `ft`/`m` toggle is app-wide state in `App.tsx`, persisted to `localStorage`, and refetches the forecast on change (server returns unit-dependent fields).
- Private saved locations encrypt coordinates client-side before saving (`src/lib/spotCrypto.ts`, used from `App.tsx`'s `handleSaveLocation`) — the server never sees plaintext coords for spots saved as private.
