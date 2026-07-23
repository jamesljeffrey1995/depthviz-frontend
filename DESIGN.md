---
name: DepthViz
description: Underwater visibility forecast for spearfishers and freedivers — the precision marine instrument
colors:
  surface: "#f3f6f8"
  surface-raised: "#ffffff"
  surface-sunken: "#e7ecef"
  surface-border: "#d8dee3"
  surface-border-strong: "#b9c2c9"
  ink: "#101820"
  ink-dim: "#4b5661"
  ink-faint: "#5e6b78"
  face: "#0b1622"
  face-raised: "#142334"
  face-ink: "#f3f7fa"
  accent: "#0e7c86"
  accent-text: "#0d737d"
  accent-strong: "#0a5f67"
  sev-blocked: "#646b78"
  sev-poor: "#bd3a3a"
  sev-marginal: "#985c16"
  sev-decent: "#5b722c"
  sev-good: "#237744"
  sev-excellent: "#107852"
  moderate: "#a2571b"
  danger-deep: "#9b2f2f"
  sev-blocked-face: "#9ca3af"
  sev-poor-face: "#ff6b6b"
  sev-marginal-face: "#ffb454"
  sev-decent-face: "#d7de6e"
  sev-good-face: "#63e6a0"
  sev-excellent-face: "#4cd9b0"
typography:
  scale:
    step-7: "7px"
    step-8: "8px"
    step-9: "9px"
    step-10: "10px"
    step-11: "11px"
    step-12: "12px"
    step-13: "13px"
    step-14: "14px"
    step-15: "15px"
    step-16: "16px"
    step-17: "17px"
    step-18: "18px"
    step-20: "20px"
    step-22: "22px"
    step-24: "24px"
    step-26: "26px"
    step-28: "28px"
    step-32: "32px"
    step-36: "36px"
    step-38: "38px"
    step-40: "40px"
    step-44: "44px"
    step-48: "48px"
    step-54: "54px"
    step-64: "64px"
    step-80: "80px"
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "13px 22px"
  instrument-gauge:
    backgroundColor: "{colors.face}"
    rounded: "{rounded.lg}"
    padding: "28px 20px 20px"
---

# Design System: DepthViz

## Overview

**Creative North Star: "The Precision Marine Instrument"**

DepthViz reads as a calibrated instrument — the kind a serious diver already trusts their life to — not a weather app with a number on it. The visibility reading is a gauge reading, on a real 0–15m scale with tick marks, a needle position, and a visible confidence band, not a stat tile with a big font. This replaced the app's second identity outright: a warm survey-paper "station log" system (Space Mono, Allerta Stencil, rubber-stamped verdicts, near-square corners) built one redesign prior. That system is now evidence/anti-reference only. Both it and the system before it — a dark "deep ocean" theme with cyan glow — are the category's two ruts: the sci-fi dive-computer HUD and the field-journal cosplay. Neither is where this system lives now.

The world comes from the audience's own instruments: a freediver's watch face, a CTD/Secchi depth-profile cast, a marine weather-routing panel — precision-machined, legible under bright sun, restrained. Color strategy is Restrained: a light aluminum-chassis ground carries almost the whole app, one deep-navy "instrument face" panel is the deliberate dark register (the hero reading, the day-strip mini-dials), and one teal accent does the work of buttons, links, and active states. A small severity set (blocked/poor/marginal/decent/good/excellent) is the only other color in the system, and it exists twice — an "on-light" register for chassis surfaces and a brighter "on-face" register for the dark panel — because a single severity color cannot clear WCAG AA in both places at once.

**Key Characteristics:**
- Light instrument-chassis ground (cool off-white/pale blue-grey), never a full dark theme.
- One dark surface, `--face`, reserved for the calibrated reading itself — the hero gauge and the day-strip thumbnails. Nothing else in the app is dark.
- One teal accent (`--accent` for fills/icons/borders, `--accent-text` for text-on-light — the plain accent measures ~4.2:1 against `--surface-sunken`, short of AA for small text) carries buttons, links, active states.
- The visibility number is always read off a 270° calibrated arc with real tick marks at 0/5/10/15m — never a bare number, never a generic circular progress ring.
- Confidence is a literal visual encoding — the arc carries a translucent "uncertainty band" straddling the needle, wide for low-confidence readings and tight for high-confidence ones — plus a text confidence pip, so the encoding is never color-only.
- One font family (Inter, self-hosted variable, 300–800) does all the work; hierarchy comes from size and weight, not a second display face.
- Corners are machined-soft: 8/12/20px radii, never square, never fully pill-rounded except genuine pills (chips, nav segments, buttons).
- Depth is real: soft diffused shadows with offset and blur (`--shadow-card`, `--shadow-lg`, `--shadow-face`), never a flat 1px rule standing in for elevation.
- Glass appears exactly once, deliberately: `--lens-sheen`, a diagonal gradient overlay on the instrument face reads as light catching a sapphire cover glass. It is not used anywhere else.

## Colors

### Chassis (light — carries almost the whole app)
- **Surface** (`#f3f6f8`): page ground.
- **Surface, Raised** (`#ffffff`): cards, inputs, the day-strip tile background.
- **Surface, Sunken** (`#e7ecef`): recessed fills — metric chips, factor cards, secondary panels.
- **Surface Border** (`#d8dee3` / `#b9c2c9` strong): hairlines, card borders.
- **Ink** (`#101820`): primary text, headings, the wordmark.
- **Ink, Dim** (`#4b5661`): body copy, secondary labels.
- **Ink, Faint** (`#5e6b78`): tertiary text, placeholders, tick labels. (Darkened from an initial `#8a96a3`, which measured 2.78:1 against `--surface-sunken` — well short of even the 3:1 large-text floor.)

### Instrument face (the one dark surface)
- **Face** (`#0b1622`): the hero gauge panel and day-strip mini-dial background. Nothing else is this color.
- **Face, Raised** (`#142334`): inset chips within the face, if ever needed.
- **Face Ink** (`#f3f7fa` / dimmer variants at 62%/36% opacity): text and numerals on the face.

### Accent
- **Accent** (`#0e7c86`): the single working color. Button fills, icon strokes, borders, focus rings.
- **Accent, Text** (`#0d737d`): use this instead of `--accent` whenever the accent is a text/link color on a light surface rather than a fill with white text on top — `--accent` alone only clears ~4.2:1 against `--surface-sunken`, short of the 4.5:1 body-text floor.

### Severity — two registers, one meaning
Both registers encode the same six-step scale (blocked → poor → marginal → decent → good → excellent); which one to use depends on what's behind the text:
- **On light** (`--sev-*`, e.g. `--sev-good: #237744`): text, chip values, badges, factor bars on `--surface`/`--surface-sunken`/`--surface-raised`. Chosen to clear 4.5:1 against all three.
- **On face** (`--sev-*-face`, e.g. `--sev-good-face: #63e6a0`): the gauge arc/needle and verdict tag on `--face`. Brighter because the background is near-black; each clears 6.5:1+ there.
- **Blocked is deliberately neutral grey, not red** — "no dive" (unsafe sea state / a hard gate) reads differently from "poor visibility." This is inherited from the system before and is load-bearing: don't let `blocked` drift toward the danger-red family.

### Named Rules
**The Two-Register Rule.** Never use an on-light severity color against `--face`, or an on-face color against a light surface — both were tuned for one specific background and will fail contrast (or just look washed out) on the other.

**The One Accent, Two Weights Rule.** `--accent` and `--accent-text` are the same hue at two different lightness steps, not two different colors — treat them as one accent with a text-safe variant, not a second brand color.

## Typography

**Face:** Inter (self-hosted variable font, weights 300–800; `@fontsource` registry installs can't complete in this environment, so the woff2 is bundled directly — see `src/assets/fonts/Inter-Variable.woff2`).

**Character:** One workhorse grotesque doing every job — Operate-mode UI is well served by a system-adjacent sans, and a second "display" face here would be reaching for a point-of-view typeface this surface doesn't need. Hierarchy is entirely size/weight/color: the hero numeral is 44px/800 with tight (-0.03em) tracking and `tabular-nums`; section titles are 20px/800; body is 13–15px/400; labels/captions are 10–12px/600, often uppercase with slight tracking for eyebrow-style metadata (station label, factor names, chip labels).

**Numerals:** `tabular-nums` on every metric value (the hero reading, factor values, metric chips, debug panel) so columns of numbers align and don't jitter as digits change.

### Real scale in use
Like the previous system, this isn't two sizes — it's a working scale used deliberately across a dense, tabular Operate surface (metric chips, factor cards, debug tables) where several nested levels of emphasis sit close together: `7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 36, 38, 40, 44px`, plus the fluid hero clamp. A value landing on one of these steps is on-system, not drift.

### Named Rules
**The One-Face Rule.** Do not introduce a second family for "hierarchy" or a "signature" moment — the previous system's stencil/mono pairing is exactly the device this system replaced. Weight and size carry hierarchy here.

## Layout

Single-column, max-width ~720px container, mobile-first. Density is high on the flagship forecast screen by design (a real instrument face is a dense readout) but the "Conditions" and "Show detailed breakdown" toggles keep the glanceable core — the instrument face, the day strip, the verdict — uncluttered by default. Mobile gets a floating rounded bottom tab bar (`8px` inset on all sides, not flush to the viewport edge); ≥481px width swaps to a pill-segmented top nav instead of duplicating both.

## Elevation & Depth

Real, soft, diffused shadows — this is a layered-card system, not a flat one. `--shadow-card` (cards resting on the chassis), `--shadow-lg` (floating elements: the bottom nav, modals, the cookie banner), `--shadow-face` (the instrument panel itself, which needs to read as a physical object sitting slightly proud of the page). Every shadow has an offset and blur; there is no flat `0 0 0` colored halo anywhere in the system.

### Named Rules
**The No-Flat-Shadow Rule.** A shadow token always carries a real offset + blur radius. A shadow that's just a tinted 1px outline is a decorative habit, not elevation.

### Documented exceptions
- **Admin debug/trace panel** (`DayDetail.module.css` `.debugPanel` and children): reuses `--face` deliberately, reading as a telemetry printout clipped into an otherwise light UI — admin-only, never diver-facing. Its positive/negative delta values (the penalty waterfall, KNN bias) use the on-face severity tokens (`--sev-poor-face`, `--sev-good-face`); its general chrome — borders, muted labels, table rules — keeps its own ad-hoc off-white/red-tinted rgba tones inherited unchanged from the system before, which is fine precisely because this panel is exempt from the main palette by design.
- **Print stylesheet** (`index.css` `@media print`): forces plain `#111` on white, ignoring every token above. Standard print-safe override.

## Shapes

Corners are machined-soft: `--radius-sm` (8px) for small chips/inputs, `--radius-md` (12px) for cards, `--radius-lg` (20px) for the hero instrument face, `--radius-full` for pills (buttons, nav segments, the day-strip verdict, badges). Borders are 1px hairlines in `--surface-border`, `--surface-border-strong` for hover/active. The signature shape is the **instrument gauge**: a 270° calibrated arc (135°–405°, a 90° gap centered at the bottom) with real tick marks at 0/5/10/15m, a fill arc in the severity-face color, and an optional translucent confidence band straddling the needle position.

## Components

### Instrument Gauge (signature component)
`src/components/InstrumentGauge.tsx`. Renders as a large version (216px) inside the DayDetail hero face, and a compact version (56px, no ticks) inside each ForecastStrip day tile. The fill arc position is always the real value on a 0–15m scale; the confidence band width is a real encoding of `high`/`medium`/`low`/`none` confidence (derived from `bias_attribution.knn.confidence`), not decoration. Never repurpose this component as a generic "progress ring" for unrelated data — it is specifically a calibrated 0–15m visibility scale.

### Buttons
- **Shape:** full pill (`--radius-full`) for primary/secondary actions; `--radius-md` for inline form buttons.
- **Primary:** `--accent` background, white text.
- **Secondary/Ghost:** `--surface-raised` or transparent background, `--surface-border` border, `--ink-dim` text.
- **Focus:** always a 2px solid accent outline, `outline-offset: 2px`.

### Cards
- **Corner style:** `--radius-md` (12px) standard, `--radius-lg` (20px) for the hero face.
- **Background:** `--surface-raised` for primary cards, `--surface-sunken` for recessed/secondary panels (metric chips, factor cards, water-quality cards).
- **Border:** 1px `--surface-border`.
- **Shadow:** `--shadow-card` on primary cards; recessed panels use border only, no shadow.

### Inputs
- **Style:** `--surface-sunken` or `--surface-raised` background, 1px `--surface-border`, `--ink` text.
- **Focus:** border shifts to `--accent`, optional `0 0 0 3px` accent-soft glow ring (the search input) or a plain 2px accent outline (everything else).

### Navigation
- **Top nav (≥481px):** a single pill-segmented control (`--surface-sunken` track, `--accent` fill on the active segment, white text) — not a row of underlined links.
- **Bottom tab bar (mobile only):** floating, rounded (`--radius-lg`), inset 8px from every edge, translucent white + blur, `--accent`-soft pill behind the active icon. Hidden ≥481px.
- **Day-index strip (signature nav):** each day is a `--surface-raised` card containing a compact instrument dial (dark `--face` disc, mini gauge arc, numeral) plus a verdict line below in the on-light severity color.

## Do's and Don'ts

### Do:
- **Do** keep the accent to one hue; reach for `--accent-text` rather than a second color when `--accent` fails contrast as text.
- **Do** keep severity colors distinguishable and correctly registered (on-light vs on-face) everywhere they appear — they're safety information.
- **Do** carry the calibrated-gauge language (real ticks, a real scale, a real confidence encoding) anywhere a "how much / how confident" reading needs a hero treatment — it's the system's device, not a one-off widget.
- **Do** use `tabular-nums` on any numeral that updates or sits in a column with others.

### Don't:
- **Don't** introduce a second display typeface "for hierarchy" — sizing and weight carry it.
- **Don't** use a colored `border-left`/`border-right` accent bar on cards or callouts — alert/callout states get a tinted background + border, not a stripe (removed from `KelpVisibilityNote` and `SatelliteImageryCard` in this pass, which both had it).
- **Don't** reintroduce the near-square 1–3px corners or the stamped/rotated verdict badge from the previous system, or the dark-theme-plus-neon-cyan system before that — both are anti-reference only.
- **Don't** treat the instrument gauge as a decorative progress ring — every pixel of the arc maps to a real value.

## Rollout status

This pass replaced the global tokens (colors, type, radii, shadows, the self-hosted font) app-wide, and fully rebuilt the flagship path: the app shell (header, top nav, bottom nav, footer, loading/empty states), Home, Search, the day-index strip, the full forecast detail screen (instrument-face hero, metric chips, algae/water-quality/turbidity/resuspension/river-discharge cards, factor grid, admin debug panel), the auth modal, and the cookie banner. A new hand-authored icon set (`src/components/icons.tsx`, Lucide-style 24×24 line icons) replaced emoji/unicode glyphs across all of the above — a `lucide-react` dependency was attempted first but couldn't install in this environment (see below).

Every other component in the app (forum, news, apnea tables, catches, admin panels, map/spot popups, friends, profile, etc.) inherited the new tokens automatically through the same CSS custom properties, plus a mechanical pass that replaced hardcoded legacy hex/rgba literals (the old paper-orange accent, the older cyan-glow dark-theme remnants, and the old severity hex values) with their new equivalents across roughly 40 files — so nothing in the app still renders the old palette, even where structure wasn't touched. Full compositional rework of those secondary screens to the instrument-panel structural language (not just its colors) is follow-up work, not done in this pass.

**Environment note:** this sandbox's npm install is broken by an unrelated root-owned leftover package (`node_modules/@fontsource/bebas-neue`) that any `npm install` tries to reconcile and fails on with EACCES. Both the font (Inter) and the icons were sourced/authored to route around this rather than fix it, since it's outside this task's scope — a real dev environment should have no trouble running `npm install @fontsource-variable/inter lucide-react` if that's preferred going forward.
