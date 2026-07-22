# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are spearfishers and freedivers; the broader dive community (scuba divers, snorkelers) also uses the product. It serves both moments of use: same-day go/no-go decisions (checking conditions the morning of a dive) and advance trip planning (checking a multi-day forecast ahead of time).

## Product Purpose

Turns standard marine/weather data into an estimated underwater visibility-in-metres forecast for a chosen coastal location, so users can decide whether a location is worth diving without interpreting raw swell/wind/precipitation numbers themselves. Users can also log real dive visibility — via on-device video analysis and manual reports — to compare against the forecast.

## Positioning

The differentiated mechanism is the visibility-specific forecast model: it translates swell, wind (speed + direction), precipitation, and humidity into a single visibility-in-metres estimate, with a 7-day historical decay applied to swell/rain/wind so a rough preceding week still depresses today's score even if the surface looks calm. A generic marine-weather app surfaces the raw inputs; DepthViz's model is the thing a competitor would need to independently build, not just copy.

## Operating Context

- Users search or select a coastal location (map, saved places, location history) and view a multi-day forecast strip with per-day detail (factor breakdown: swell, wind, precipitation, humidity).
- Units (ft/m) and dive depth are persistent, app-wide preferences that affect forecast requests.
- Beyond the forecast, users can log catches, submit dive-video visibility reports, run/create/share apnea (breath-hold) training tables, read a news feed, participate in a forum, manage friends, and dispute forecast or report data.
- Admin-only tooling (ML charts, seabed editor, admin panel) exists alongside the regular user experience; it's gated client-side but the server is the actual authority.
- Auth is magic-link email OTP via Supabase; nearly everything else flows through a separate backend REST API.
- Ships as an installable PWA with offline-resilient caching of the last location/forecast for instant first paint.

## Capabilities and Constraints

- This repo is frontend-only. All business data and the forecast model itself live in a separate backend REST API; Supabase is used only for auth.
- On-device dive-video visibility analysis (OpenCV.js dark-channel/Beer-Lambert estimation, run in a web worker) is a distinct client-side estimation feature, separate from the server-computed forecast — the two must not be conflated.
- Admin status and every `/admin/*` request are re-checked server-side; the client-side admin flag is a UI hint only, never a security boundary.
- Private saved locations encrypt coordinates client-side before the server ever sees plaintext coordinates.

## Brand Commitments

"DepthViz" is the fixed, committed product name — not open for renaming or rebranding.

## Evidence on Hand

No real user testimonials, case studies, or press exist yet. Future design work must not fabricate any.

## Product Principles

- Translate raw marine data into a single actionable decision (a visibility number plus its factor breakdown), not raw meteorological readings.
- Serve same-day go/no-go checks and advance trip planning equally — neither use case should be designed away in favor of the other.
- Treat user-submitted observation (video analysis, reports) as a check against the forecast, not a replacement for it.
- Client-side gates (admin flag, unit toggle, cached forecast) are UX conveniences only; the backend remains the authority on data and permissions.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established yet; treat as undecided.
