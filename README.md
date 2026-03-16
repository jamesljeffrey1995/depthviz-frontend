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
