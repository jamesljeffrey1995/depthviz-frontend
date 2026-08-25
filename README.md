# DepthViz — Frontend

Real-time underwater visibility forecasts for spearfishers and freedivers, plus
the community platform around them: dive reports, catches, a spot map, friends,
apnea-table training, competitions and admin tooling.

This repository is the **web client** (a React + TypeScript PWA). The forecast
model, calibration, and all persistence live in the separate **`depthviz-api`**
FastAPI backend; the client talks to it over HTTP and to **Supabase** for auth.

## Stack

- **React 19** + **TypeScript**, bundled with **Vite 7**
- **CSS Modules** for component-scoped styles; `src/styles/tokens.css` holds the
  `--ds-*` design tokens
- **Supabase** (`@supabase/supabase-js`) for authentication and session storage
- **depthviz-api** (FastAPI) for forecasts, reports, catches, competitions, etc.
- **Leaflet** / **react-leaflet** for the interactive spot map
- **OpenCV.js** (`@techstark/opencv-js`) + **mp4box** for on-device dive-video
  visibility analysis (runs in a web worker)
- **qrcode** for shareable spot/table QR codes
- **vite-plugin-pwa** — installable, offline-capable app shell
- **Vitest** for tests, **ESLint** (flat config) for linting

## Requirements

- **Node ≥ 20.19** (or ≥ 22.12) — Vite 7 requirement; CI pins Node 22
- A running `depthviz-api` instance (or its hosted URL)
- A Supabase project (URL + anon key)

## Environment

Create a `.env` (or `.env.local`) with the variables the client reads at build
time. All are `VITE_`-prefixed so they are inlined into the bundle — do **not**
put secrets here (the anon key is public by design; never the service key):

| Variable                 | Required | Purpose                                                        |
|--------------------------|----------|----------------------------------------------------------------|
| `VITE_SUPABASE_URL`      | yes      | Supabase project URL (auth)                                    |
| `VITE_SUPABASE_ANON_KEY` | yes      | Supabase anon/public key                                       |
| `VITE_API_URL`           | no       | Deployment mount/base URL for depthviz-api. Defaults to `/api`; the client adds the canonical `/api/v1` namespace itself. |

`VITE_API_URL` is deliberately the **deployment mount**, not an API-version
setting. For the normal same-origin production setup it remains `/api`, while a
local direct-backend setup can use `http://localhost:8000`. The client transport
normalizes both forms onto the backend's `/api/v1` routes.

> `src/lib/supabase.ts` throws at import time if the two Supabase variables are
> missing, so the app will not start without them. Admin access is **not** an
> env flag — the backend re-verifies admin identity on every `/admin/*` request
> and returns an `is_admin` flag the UI uses only for visibility.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the Supabase + API values
npm run dev
```

## Scripts

| Command           | Description                                        |
|-------------------|----------------------------------------------------|
| `npm run dev`     | Vite dev server                                    |
| `npm run build`   | Type-check (`tsc`) then production build to `dist/`|
| `npm run preview` | Serve the production build locally                 |
| `npm run lint`    | ESLint (flat config, `eslint.config.js`)           |
| `npm test`        | Run the Vitest suite                               |

## Project structure

```
src/
├── components/     # ~50 feature components (forecast, feed, catches, friends,
│                   #   spot map, apnea tables, competitions, admin, legal, …)
├── hooks/          # useConditions, useDialog, … data + UI hooks
├── lib/            # api.ts (backend client), apiV1Transport.ts (versioning,
│                   #   canonical paths + idempotent POST retries), feedApi.ts
│                   #   (cursor feed), visibility.ts, spotCrypto.ts, cache.ts, …
├── styles/         # tokens.css design system
├── types/          # shared TypeScript types
├── workers/        # opencv.worker.ts (video analysis off the main thread)
├── App.tsx         # top-level routing / shell
└── main.tsx        # entry point
```

## API client conventions

`src/lib/apiV1Transport.ts` is installed before the React tree renders. It keeps
existing feature clients compatible while enforcing the backend's current API
contract at the transport boundary:

- first-party backend calls are routed through `/api/v1`
- deprecated aliases are rewritten to canonical resource paths
- JSON `POST` requests receive an `Idempotency-Key`
- a keyed `POST` may be retried once after a network failure or 5xx, reusing the
  exact same key so the backend can replay the original result safely
- third-party traffic such as Supabase and Open-Meteo is never rewritten

The community activity feed uses the API's cursor pagination (`next_cursor`)
rather than offset paging so inserting new activity at the head cannot shift
later pages and create duplicates/skips.

## Forecast model

The authoritative visibility forecast is produced by **depthviz-api**
(ML-calibrated, using swell/wave, wind, precipitation, ocean-colour and
community data). `src/lib/visibility.ts` keeps a lightweight client-side mirror
of the penalty model — a baseline of **8 m** (North Sea, 50–62°N) or **11 m**
elsewhere with swell/wind/direction/precip/humidity penalties and a 7-day
historical decay — used for instant local estimates and explanation UI. It is
kept aligned with the API's `services/visibility.py`; the backend is the source
of truth.

## Deployment

`npm run build` emits a static `dist/`. In production the client needs the
backend reachable at the deployment mount in `VITE_API_URL` (commonly `/api`
behind a reverse proxy that routes `/api` to depthviz-api and serves the SPA for
everything else). Do not put `/api/v1` into `VITE_API_URL`; the frontend transport
adds the version namespace consistently for both proxied and direct-backend
configurations.

### Cloudflare Pages / Netlify

`public/_headers` is picked up automatically and sets the security headers,
including the Content-Security-Policy that OpenCV.js needs.

### Self-hosted (nginx, Apache, Caddy, …)

`public/_headers` is only read by Cloudflare Pages and Netlify. When self-hosting
you **must** send the CSP header from the web server. OpenCV.js (Emscripten glue)
calls `new Function(…)` at runtime, so `'unsafe-eval'` and `'wasm-unsafe-eval'`
**must** appear in `script-src` or image/video analysis fails.

An annotated **nginx** example is provided at
[`nginx.conf.example`](./nginx.conf.example). The CSP is duplicated across
`vite.config.ts`, `public/_headers`, `index.html`, and `nginx.conf.example`;
`src/lib/cspSync.test.ts` asserts they stay identical, so edit the policy in all
four together.

> **Why the `<meta>` tag in `index.html` is not enough:** browsers give HTTP
> response headers higher precedence than `<meta http-equiv="Content-Security-Policy">`.
> If your server emits any CSP header, the `<meta>` fallback is ignored — set the
> full policy at the server level.
