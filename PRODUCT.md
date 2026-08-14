# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Spearfishers and freedivers deciding whether — and where — to dive. Primary geography is
the UK / North Sea (50–62°N), matching the visibility model's regional baseline, the
Seaton Sluice sensor deployment, and the competition partnership below; not yet a global
audience. Secondary users: competition organisers/admins running an event, and community
members contributing reports, catches, and dive-table training data.

## Product Purpose

A decision-support platform, not a weather app: help people make better decisions before
entering the water. Every screen must answer its core decision (e.g. Forecast: "Should I
dive here, today?") within five seconds, for a first-time user, on a mid-range phone, in
sunlight, over a weak signal. Success is a person acting with justified confidence, not
just accurate numbers on screen.

## Positioning

Two obligations override every other product value, including delight and growth:

1. Never manufacture false confidence — a confident-looking green verdict on thin or stale
   data is more dangerous than an honest "we're not sure." Uncertainty is always visible.
2. Never hide a safety-relevant caveat behind disclosure — warnings (rip current, offshore
   wind, reports contradicting the model) appear on the first screen, never one tap down.

This is the mechanism a neighbouring conditions/weather app could not truthfully copy
without adopting the same safety-first, decision-first constraints.

## Operating Context

Used on-site, pre-dive, on mobile — often in sunlight and over a weak signal (PWA,
installable, offline-capable). Core workflows: check today's forecast and decide whether
to dive; log/read community dive reports and catches; browse a spot map; run apnea-table
training; participate in or administer a spearfishing competition (registration, live
leaderboard, safety check-ins); manage a profile and friends list.

## Capabilities and Constraints

- React 19 + TypeScript PWA (Vite 7); CSS Modules styled from `--ds-*` tokens.
- Forecast model, calibration, and persistence live in a separate `depthviz-api` (FastAPI)
  backend; this client mirrors a lightweight penalty model client-side for instant local
  estimates, kept aligned with the API's source of truth.
- Supabase for auth/session; admin access is re-verified server-side on every request, not
  an env flag.
- On-device dive-video visibility analysis via OpenCV.js + mp4box, run in a web worker
  (requires `'unsafe-eval'`/`'wasm-unsafe-eval'` in CSP — documented in README/nginx.conf).
- Free/personal project currently; no monetisation plan established (open decision).

## Brand Commitments

Existing "DepthViz" name and an established design-token system (`src/styles/tokens.css`):
Abyssal Navy / Prussian / Classic Ocean / Shallow Blue / Teal Seawater / Aquamarine
palette. The 6-step dive-quality scale deliberately does
not use a red-amber-green traffic light — poor conditions read as darker/murkier, good as
brighter/clearer aqua, monotonic in luminance so it stays colourblind-safe; colour is
always paired with a label, bar count, and numeric score. A project constitution
(`docs/CONSTITUTION.md`) governs product, design, and engineering decisions and takes
precedence over convenience.

## Evidence on Hand

DepthViz served as the official visibility-forecast partner for a spearfishing
competition — real proof point, safe to reference. No other testimonials, case studies,
or press exist yet; do not fabricate them.

## Product Principles

- Decision first: verdict → explanation → raw data, never reversed, on any screen.
- Progressive disclosure for detail, never for danger — safety-relevant caveats are never
  hidden behind a toggle.
- Every element earns its place: teach, guide, inform, confirm, delight, or protect
  (safety). Nothing is purely decorative.
- Reduce thinking: the product compares, converts, and highlights deltas so the user never
  does mental arithmetic to reach a decision.
- Consistency: the same idea looks and behaves the same way on every screen.

## Accessibility & Inclusion

WCAG AA contrast is verified for every accent/quality-scale pairing. Colour is never the
sole signal (label + icon/bar count accompany every colour-coded state). No further
product-specific accessibility requirement has been established beyond this.
