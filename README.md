# DEPTHVIZ

Underwater visibility forecast for spearfishing. Enter a coastal location and get an estimated visibility in metres based on current and historical weather and sea conditions.

## Stack

- **React 18** + **TypeScript**
- **Vite** for bundling
- **CSS Modules** for component scoped styles
- **Open-Meteo** APIs (free, no key required)

## Project Structure

```
src/
├── components/
│   ├── SearchBar.tsx          # Location input with autocomplete
│   ├── SearchBar.module.css
│   ├── VisibilityDisplay.tsx  # Main result card + factor grid
│   └── VisibilityDisplay.module.css
├── hooks/
│   ├── useConditions.ts       # Fetches data + runs visibility model
│   └── useGeolocation.ts      # GPS location wrapper
├── lib/
│   ├── api.ts                 # Open-Meteo API calls
│   └── visibility.ts          # Visibility calculation model
├── types/
│   └── index.ts               # Shared TypeScript types
├── App.tsx
├── App.module.css
├── index.css                  # Global styles + CSS variables
└── main.tsx
```

## Getting Started

```bash
npm install
npm run dev
```

## The Model

Starts from a baseline of **8m** (North Sea, lat 50–62°N) or **11m** elsewhere, then applies penalties:

| Factor       | Max penalty |
|--------------|-------------|
| Swell / wave | −8m         |
| Wind speed   | −4m         |
| Wind dir     | −1m         |
| Precipitation| −3m         |
| Humidity     | −1m         |

**7-day historical decay** is applied to swell, rain, and wind — older data is weighted down exponentially so a rough week still affects today's score even if conditions look calm on the surface.

See `src/lib/visibility.ts` for full model details.

## Deployment

Works as a static site — just run `npm run build` and deploy the `dist/` folder to Netlify, Vercel, or any static host.

### Cloudflare Pages / Netlify

The `public/_headers` file is picked up automatically and sets all required security headers, including the Content-Security-Policy needed by OpenCV.js.

### Self-hosted (nginx, Apache, Caddy, …)

`public/_headers` is only read by Cloudflare Pages and Netlify.  When self-hosting you **must** configure your web server to send the correct `Content-Security-Policy` header.  OpenCV.js (Emscripten glue) calls `new Function(…)` at runtime, so `'unsafe-eval'` and `'wasm-unsafe-eval'` **must** appear in `script-src`.  Without them you will see an `EvalError` and the image-analysis feature will fail silently.

An annotated **nginx** example is provided at [`nginx.conf.example`](./nginx.conf.example).  The essential header is:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.tile.openstreetmap.org;
  connect-src 'self' https://*.supabase.co https://geocoding-api.open-meteo.com;
  font-src 'self';
  worker-src 'self' blob:;
  frame-ancestors 'none';
```

> **Why the `<meta>` tag in `index.html` is not enough**  
> Browsers give HTTP response headers higher precedence than `<meta http-equiv="Content-Security-Policy">`.  If your server emits *any* CSP header — even a restrictive default — the `<meta>` tag is ignored.  You must set the full policy at the server level.
