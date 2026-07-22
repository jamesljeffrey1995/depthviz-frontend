---
name: DepthViz
description: Underwater visibility forecast for spearfishers and freedivers — the field-science station log
colors:
  paper: "#f2ecdd"
  paper-raised: "#faf6ea"
  paper-dim: "#e6dcc3"
  ink: "#2a251e"
  ink-dim: "#5c5344"
  ink-faint: "#a89c84"
  rule: "#c7bb9c"
  rule-strong: "#8c8064"
  accent: "#a83b0c"
  danger: "#a4321f"
  danger-deep: "#7a2415"
  warn: "#8f5f08"
  moderate: "#96470f"
  good: "#2f6b46"
  excellent: "#1f5138"
  decent: "#4f6b3a"
  blocked: "#675e4e"
typography:
  display:
    fontFamily: "Allerta Stencil, sans-serif"
    fontSize: "clamp(52px, 15vw, 88px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
  body:
    fontFamily: "Space Mono, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.05em"
rounded:
  sm: "1px"
  md: "2px"
  lg: "3px"
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
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "12px 22px"
  verdict-stamp:
    textColor: "{colors.good}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
---

# Design System: DepthViz

## Overview

**Creative North Star: "The Oceanographic Station Log"**

DepthViz reads as a page from a marine research vessel's station log, not a sci-fi dive-computer dashboard. The decay-weighted visibility model is the interface: every screen is structured like a field scientist's data sheet — a station header, a plotted reading, a ruled table of contributing factors — rather than dressed up with glowing dashboard chrome afterward. This replaced the app's original identity outright: a near-black "deep ocean" theme with a cyan glow accent, Bebas Neue display type, and an animated caustics background. That look is the category's rut (the sci-fi-HUD dive-computer aesthetic every visibility/dive app defaults to) and is now evidence/anti-reference only, not a constraint.

The palette is Restrained: warm survey-paper neutrals carry the page, and one safety-orange working ink (the color of a grease pencil or a stamp pad) is the only accent, appearing on buttons, active states, and the day-indexing tabs. Verdict and factor severity form a small, functional signal set — not decoration — because a diver scanning for GO/NO-GO information under bright sun needs the color to carry real meaning, the same way a field log's red grease-pencil circle means something specific.

Never let this system drift back toward warm-cream-plus-serif-plus-red-accent as a soft, generic "bookish" rendition — the palette is meant to read as working field-instrument paper (grid rules, stamps, ruled tables), not a cozy stationery aesthetic. Never reintroduce glow/neon shadows; nothing in this system emits light.

**Key Characteristics:**
- Survey-paper ground with graphite ruling, not a dark dashboard.
- One accent (safety orange) carries buttons, active states, and emphasis — restrained, not scattered.
- Verdicts render as rubber-stamped labels; the visibility number is a plotted reading, not just a stat tile.
- Space Mono survives from the previous system for tabular data; a stencil display face (Allerta Stencil) replaced Bebas Neue for headers and verdicts.
- Flat, ruled surfaces throughout — corners are nearly square (1–3px radius), because a logbook page doesn't have rounded cards.

## Colors

The palette is built from one warm paper family, one working accent ink, and a small severity set that must stay distinguishable at a glance — this is a safety-relevant signal, not a decorative choice.

### Primary
- **Working Ink** (`#a83b0c`, safety orange): the single accent. Buttons, active tab state, focus rings, links, the day-index tab underline. Used sparingly — most of any screen is paper and ink, never accent-tinted chrome.

### Neutral
- **Survey Paper** (`#f2ecdd`): the page ground.
- **Paper, Raised** (`#faf6ea`): cards and surfaces that sit slightly above the page (the station-log card itself, inputs).
- **Paper, Dim** (`#e6dcc3`): recessed fills — metric chips, factor cards, secondary panels.
- **Graphite Ink** (`#2a251e`): primary text, headings, the visibility number.
- **Ink, Dim** (`#5c5344`): body copy, secondary labels.
- **Ink, Faint** (`#a89c84`): tertiary text, placeholders, tick labels.
- **Rule** (`#c7bb9c` / `#8c8064` strong): hairlines, borders, ruled dividers — the grid-paper of the whole system.

### Named Rules
**The One Ink Rule.** Only the accent orange carries brand emphasis. Nothing else is "brand-colored" — severity colors are functional signals, not decoration, and must never be reached for as a second accent.

### Severity signal set (functional, not decorative)
- **Good** (`#2f6b46`) / **Excellent** (`#1f5138`): field-green stamp ink for safe/favorable verdicts and "no impact" factors.
- **Decent** (`#4f6b3a`): sage-olive, the step between marginal and good.
- **Warn** (`#8f5f08`) / **Moderate** (`#96470f`): ochre through burnt-umber for caution states.
- **Danger** (`#a4321f`) / **Danger, Deep** (`#7a2415`): oxblood red for poor/severe conditions.
- **Blocked** (`#675e4e`): muted neutral ink for "STAY ASHORE" / no-data states — deliberately *not* red, preserving the original product's distinction between "unsafe" and "no reading available."

**The Signal, Not Decoration Rule.** These six severity tones exist to be scanned in under a second by someone deciding whether to dive. Never introduce a seventh, never soften them toward the neutral palette, and never use them for anything that isn't an actual severity state.

## Typography

**Display Font:** Allerta Stencil (self-hosted TTF; no system fallback attempts a stencil look, so the stack falls back to plain `sans-serif`)
**Body/Data Font:** Space Mono (carried over from the previous system)

**Character:** A field-instrument pairing — Space Mono for anything tabular or data-driven (numbers, labels, factor tables), Allerta Stencil for anything that should read as stamped or marked: verdicts, the wordmark, section headers. The stencil face is load-bearing for the "rubber stamp" verdict treatment; do not swap it for a solid-cut display face, the visible gaps are the point.

### Hierarchy
- **Display** (400, `clamp(52px, 15vw, 88px)`, line-height 1): the visibility number itself.
- **Headline** (400, `clamp(44px, 10vw, 72px)`): the DEPTHVIZ wordmark, hero titles.
- **Title** (700, 15–20px): station name, tile labels, card titles — set in Space Mono bold, not the display face.
- **Body** (400, 12–14px, line-height 1.6–1.7): paragraph copy, summaries.
- **Label** (400, 7–11px, letter-spacing 0.1–0.3em, uppercase): every small caption, chip label, and section eyebrow — this uppercase-tracked label voice is used constantly and is part of the system's "field data sheet" register.

### Real scale in use
This is a dense, tabular Operate surface (station log, factor tables, metric chips), so the label/body range above isn't two sizes — it's a working scale with roughly a 1px step between adjacent tiers, used deliberately for tables where several nested levels of emphasis sit close together (a factor card's name vs. its value vs. its note vs. its impact tag, for example): `6, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12, 14, 15, 16, 18, 20, 22, 24, 28, 36, 48px`, plus the two fluid clamps above. Most of this scale predates this redesign pass and was carried over unchanged. Treat it as the documented ramp — a value landing on one of these steps is on-system, not drift.

### Named Rules
**The Stamped Verdict Rule.** Any GO/NO-GO-style verdict (STAY ASHORE → EXCELLENT) renders as a bordered, slightly rotated stamp in the display face and its severity color — never as plain colored text. This is the system's signature device.

## Layout

Single-column, max-width ~680px container, generous top padding, content-first. Density is deliberately high on the flagship forecast screen (a real field log is dense) but toggles exist for secondary detail ("Conditions", "Show detailed breakdown") so the glanceable core — verdict stamp, big number, ruled bar — stays uncluttered by default. Mobile gets a fixed bottom tab bar; ≥481px width swaps to a website-style top nav instead of duplicating both.

## Elevation & Depth

Flat by design — this is a paper world, not a glass/glow one. Depth comes from ruled borders and tonal paper steps (paper → paper-raised → paper-dim), not shadows. One shadow token exists (`--shadow-card`, a barely-there `0 1px 3px rgba(42,37,30,0.14)`) for the rare card that needs to lift off the page a touch; nothing glows.

### Named Rules
**The No-Glow Rule.** The previous system used cyan glow shadows (`box-shadow: 0 0 20px rgba(0,201,255,.15)`) throughout. None of that survives. If something needs emphasis, give it a heavier rule or the accent color — never a glow.

### Documented exceptions (intentionally outside the palette above)
- **Admin debug/trace panel** (`DayDetail.module.css` `.debugPanel` and children): stays dark — near-black background, white/red-tinted text (`rgba(255,130,130,*)`, `rgba(255,80,80,*)`) — deliberately, as a "photostat/carbon-copy insert clipped into the log" rather than another paper surface. It's admin-only and reads as a distinct system-data overlay, not part of the diver-facing world. Don't migrate it to the paper palette; don't extend its dark treatment anywhere else.
- **Print stylesheet** (`index.css` `@media print`): forces plain `#111` text on white, ignoring every token above. Standard print-safe override, unrelated to the visual identity.

## Shapes

Corners are almost square: 1–3px radius across the whole scale (`--radius-sm/md/lg`). Borders are 1px hairlines in `--rule`, with `--rule-strong` for active/hover states. The signature shape is the verdict stamp: a double-ruled rectangle (an outer 3px border plus an inset 1px border at 55% opacity), rotated -3°, in the severity color.

## Components

### Buttons
- **Shape:** 2px radius, 1px border.
- **Primary:** `--accent` background, `--paper` text (never dark ink on the accent — the accent is mid-value, not bright, so it needs light text for contrast).
- **Secondary/Ghost:** transparent or `--paper-raised` background, `--accent` text, `--rule`/accent-alpha border.
- **Hover/Focus:** border darkens to `--rule-strong` or full accent; focus-visible is always a 2px solid accent outline.

### Verdict Stamp (signature component)
A bordered box in the display face, severity-colored via `currentColor`, rotated -3°, with a double-ruled border (outer 3px + inset 1px at 0.55 opacity). This is the system's one deliberately "designed" flourish — everything else is quiet.

### Cards / Containers
- **Corner style:** 0–3px radius, effectively square.
- **Background:** `--paper-raised` for primary cards, `--paper-dim` for recessed/secondary panels.
- **Border:** 1px `--rule`.
- **Shadow:** none, or `--shadow-card` only on the primary station card.

### Inputs / Fields
- **Style:** `--paper-raised` background, 1px `--rule` border, `--ink` text.
- **Focus:** 2px solid accent outline (no glow).

### Navigation
- **Top/section nav:** small uppercase labels (10px, 0.2em tracking) in bordered paper tabs; active state gets an accent background wash + accent border.
- **Bottom tab bar (mobile only):** fixed, translucent paper background with blur, accent color for the active icon/label; hidden ≥481px in favor of the top nav.
- **Day-index strip (signature nav):** the multi-day forecast selector reads as logbook index tabs — paper-raised cards with a ruled bottom border that becomes an accent underline when active.

## Do's and Don'ts

### Do:
- **Do** treat the accent as a working ink, not a brand color to splash around — one accent, used with restraint (buttons, active states, the stamp's rare use elsewhere).
- **Do** keep severity colors distinguishable and consistent everywhere they appear (verdict stamps, factor bars, chips) — they're safety information.
- **Do** use Space Mono for anything tabular or numeric; reserve Allerta Stencil for verdicts, the wordmark, and major section headers.
- **Do** keep corners nearly square and depth flat — the paper/field-log identity depends on it.

### Don't:
- **Don't** reintroduce glow shadows, neon cyan, or the old `--ocean-*` dark theme — those are anti-reference only.
- **Don't** let the palette drift toward a soft cream-and-serif "cozy stationery" look — this is working field-instrument paper, not a greeting card.
- **Don't** use ink-on-accent text combinations (both are mid-to-dark values now; accent needs light `--paper` text, not dark `--ink`).
- **Don't** treat the verdict stamp as a generic badge — it's the signature device and should stay a bordered, rotated, severity-colored stamp, not a pill or plain colored text.

## Rollout status

This pass replaced the global tokens (colors, type, radii, shadows) app-wide — every screen inherits paper/ink/accent automatically through existing CSS custom properties — and fully rebuilt the flagship forecast screen (station header, verdict stamp, ruled bar, factor tables) plus the shell chrome (header, nav, bottom bar) and every screen a first-time visitor sees before reaching the forecast (home, search bar, cookie banner). Deeper secondary screens (forum, news composer/admin panels, apnea tables, admin ML charts, map popups) inherited the token retheme automatically but keep their original *structure* — a few of them (Forum/News composer inputs, several `background: var(--accent)` badges) needed a targeted contrast fix where the old dark-on-dark or light-on-light pairing broke under the new palette; those are fixed. Full compositional rework of those secondary screens (bringing them to the same "station log" structural language as the flagship) is follow-up work, not done in this pass.
