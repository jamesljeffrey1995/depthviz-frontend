# DepthViz Design System

> A world-class environmental forecasting experience for divers, freedivers and
> spearfishers — built so every screen answers one question first:
> **“Should I dive here today?”**

This document is the canonical specification for the DepthViz redesign. It is
paired with a **living style guide** rendered from the real components at
[`/design`](../src/components/DesignSystemPage.tsx), so the documentation can
never drift from the code.

---

## 1. Design principles

We adopted the *principles* that make best-in-class conditions apps (e.g.
Surfline) successful — decision-first hierarchy, progressive disclosure, a
single confidence-building score — without copying any visual identity or
assets. DepthViz owns a distinct identity rooted in **clarity, confidence and
rapid decision-making** for *underwater visibility*, which is a different
problem from surf.

| # | Principle | How it shows up |
|---|-----------|-----------------|
| 1 | **Decisions over data** | Every location page leads with a single Dive Quality Score and a plain-English verdict. Raw numbers live below the fold and behind disclosure. |
| 2 | **Progressive disclosure** | Essential answer first → factor breakdown one tap away → advanced charts/trace behind an "Advanced" toggle. |
| 3 | **Explain the *why*** | The score is never a black box: it decomposes into visibility, sea state, wind, rainfall and algae, each with a measured value and a one-line note. |
| 4 | **Scannable in <2s** | Each card carries one idea. Colour is always paired with a label or glyph. Tabular figures keep numbers in stable columns. |
| 5 | **Build confidence** | A confidence badge (backed by report count, forecast age and volatility) sits beside every score, so users trust the call. |
| 6 | **Advanced mode without overwhelm** | Experienced users can expand model diagnostics, satellite imagery and swell components; newcomers never see them by default. |

---

## 2. Consistent page structure

Every location page follows the same seven-section spine, top to bottom:

1. **Can I dive?** — verdict badge (`Yes — dive` / `Maybe` / `Not today`)
2. **Visibility score** — the prominent 0–100 Dive Quality Score gauge
3. **Live reports** — recent diver reports (community truth)
4. **Hourly timeline** — horizontal, thumb-scrollable
5. **Forecast explanation** — plain-English "why"
6. **Environmental breakdown** — factor meters + stat tiles
7. **Advanced charts** — trend, swell, satellite, model trace (disclosed)

The redesign implements 1, 2, 5 and 6 today (`DiveScoreCard` +
`ForecastExplanation`); 3, 4 and 7 are sequenced in the roadmap (§9).

---

## 3. Design tokens

Source of truth: [`src/styles/tokens.css`](../src/styles/tokens.css). All tokens
are namespaced `--ds-*` and layered additively over the legacy theme so they
roll out screen-by-screen without a big-bang rewrite.

### Colour

A restrained, high-contrast, ocean-inspired palette. Neutrals carry a subtle
cool tint; a single ocean accent does the brand work; a six-step
**dive-quality scale** encodes conditions.

**Dive-quality scale** — luminance-stepped so it survives greyscale and the
common colour-vision deficiencies. Never used alone: always paired with a label
and, in meters, an impact glyph (▲ / ● / ▼).

| Step | Token | Hex | Meaning |
|------|-------|-----|---------|
| Excellent | `--ds-q-excellent` | `#17d1a6` | 6 m+ — rare, drop everything |
| Good | `--ds-q-good` | `#22b573` | 4–6 m — a proper good day |
| Workable | `--ds-q-workable` | `#7cc47a` | 3–4 m — if you know the ground |
| Marginal | `--ds-q-marginal` | `#f0a01f` | 2–3 m — manage expectations |
| Poor | `--ds-q-poor` | `#e5533d` | 1–2 m — consider waiting |
| Blown out | `--ds-q-blown` | `#64788c` | <1 m — sit it out |

Semantic roles (`--ds-accent`, `--ds-surface`, `--ds-text-strong`, …) are
theme-aware with dark (default) and light overrides plus a `system` mode.

### Spacing — strict 8px system

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` → `--ds-space-1 … --ds-space-8`. 4px is the
only sub-step, reserved for tight icon/label gaps.

### Radii

`--ds-radius-sm 8` · `-md 12` (cards) · `-lg 16` (hero) · `-xl 24` (modals) ·
`-pill 999` (buttons, chips, segmented controls).

### Shadows

Three deliberate steps (`--ds-shadow-1/2/3`) used **only** to establish
hierarchy — floating sheets, the primary decision card — never for decoration.
Whitespace and a single hairline (`--ds-hairline`) do the rest.

### Motion

`--ds-dur-fast 150ms` · `-base 220ms` · `-slow 300ms`, with
`--ds-ease` (standard) and `--ds-ease-spring` (arrivals). All motion is disabled
under `prefers-reduced-motion`.

---

## 4. Typography

**Inter Variable**, one type scale, tabular figures for all metrics.

| Role | Size / Weight | Token |
|------|---------------|-------|
| Hero | 36–48 / 700 / -0.02em | `--ds-text-hero` |
| Section heading | 24 / 700 | `--ds-text-h2` |
| Card title | 17–20 / 600 | `--ds-text-h3` |
| Body | 15 / 400 / 1.55 | `--ds-text-body` |
| Metadata | 13 / 500 | `--ds-text-meta` |
| Label | 12 / 600 / uppercase | `--ds-text-label` |

---

## 5. Component library

All primitives live in [`src/components/ui/`](../src/components/ui) and export
from a single barrel (`import { Card, DiveScore } from '../components/ui'`).

| Component | Purpose | Notes |
|-----------|---------|-------|
| `Card` | Base surface | flat / raised / floating elevation; optional status accent edge |
| `Button` | Actions | pill, 44px min target at every size; primary / secondary / ghost / danger |
| `Badge` | Verdicts & status | dot or icon + label → never colour-only |
| `SectionHeader` | Page structure | eyebrow + title + subtitle + action |
| `Meter` | Factor bar | value + impact glyph + note; `role="meter"` |
| `StatTile` | Metric tile | tabular value, unit, sub-label, icon |
| `DiveScore` | **Signature** score gauge | 270° arc, animated, `role="img"` with full label |
| `SegmentedControl` | Toggles | units, day/week, ranges; keyboard operable |
| `Skeleton` | Loading | shimmer placeholder + composed `DiveScoreSkeleton` |
| `icons` | Icon set | dependency-free, `currentColor`, 1.6 stroke |

**Composed:** `DiveScoreCard` — the location-page lead. Combines verdict badge,
score gauge, headline, confidence, self-explaining factor meters and a
best-window shortcut.

---

## 6. The Dive Quality Score

Logic: [`src/lib/diveScore.ts`](../src/lib/diveScore.ts) (unit-tested).

A single **0–100** number is the product's centre of gravity — it turns a
scatter of oceanographic variables into one confident answer. It is a weighted
blend of transparent sub-scores:

```
score = 0.60·visibility + 0.16·seaState + 0.12·wind + 0.07·rain + 0.05·algae
```

Each sub-score is a monotonic, piecewise-linear curve over anchor points
calibrated for **North-East UK** spearfishing/freediving (where 3 m is
*workable*, not "very poor"). Visibility dominates because it is what a diver
ultimately experiences; the other factors temper the score **and**, more
importantly, **explain it**. The strongest contributor surfaces as the headline
driver ("Calm seas and clear water are carrying the score").

Bands map to a verdict and a go/maybe/skip answer:

| Score | Band | Answer |
|------:|------|--------|
| 82–100 | Excellent | Yes — dive |
| 64–81 | Good | Yes — dive |
| 48–63 | Fair | Maybe |
| 30–47 | Marginal | Maybe |
| 14–29 | Poor | Not today |
| 0–13 | Blown out | Not today |

**Why a score beats raw metres (improving on surf-style star ratings):** it (a)
folds in the factors a diver would otherwise mentally combine, (b) stays
explainable rather than opaque, and (c) is locally calibrated instead of using
tropical-scuba thresholds that would call every NE-UK day "poor".

---

## 7. Charts

Principles for every visualisation (trend, swell, hourly): minimise chrome,
drop unnecessary gridlines, emphasise the **trend** and the **current** value,
and keep the same ink on desktop and mobile.

- One accent line + a soft area fill; gridlines at `--ds-chart-grid` (≈8% ink).
- "Now" is marked explicitly (`--ds-chart-now`), not left to the reader.
- Bars/points are min 44px-tappable on mobile; the axis is decluttered to
  ~4 labels.
- Colour encodes the quality scale so a chart reads the same language as the
  score.

---

## 8. Interaction specifications

- **Progressive disclosure** — "Why this score" and "Advanced" are
  `aria-expanded` buttons; chevrons rotate 180° over `--ds-dur-base`.
- **Score gauge** — animates 0 → value on mount via `stroke-dasharray`;
  short-circuits to the final value under reduced motion. Exposed as
  `role="img"` with `aria-label="Dive quality score 72 out of 100 — Good"`.
- **Best-window shortcut** — a 56px row; tapping jumps the day selector to the
  best forecast day. Keyboard-activatable, disabled state when no handler.
- **Touch targets** — buttons, segmented controls and list rows are ≥44px.
- **Perceived speed** — skeletons (not spinners) on load; the map and satellite
  imagery lazy-load; transitions stay in the 150–300ms band; unit toggles
  update optimistically.
- **Sticky controls** — units + max-depth selector stay reachable at the top of
  the forecast on mobile (roadmap item to pin on scroll).

---

## 9. Accessibility (WCAG 2.2 AA)

- **Colour never alone** — every quality colour is paired with a label; meters
  add ▲/●/▼ impact glyphs; badges carry a dot + text.
- **Contrast** — text roles meet AA on their surfaces; the dark theme uses
  `--ds-text-strong` (#f2f7fa) on deep ink.
- **Keyboard** — all controls are native buttons/inputs with visible focus
  rings (`--ds-shadow-focus`, 3px ocean halo).
- **Labels** — gauges, meters and icon buttons expose descriptive `aria-label`s;
  decorative icons are `aria-hidden`.
- **Motion** — a global `prefers-reduced-motion` block neutralises animation.
- **Targets** — 44px minimum, with extra scroll padding so the mobile bottom
  nav never obscures a focused control.

---

## 10. Implementation roadmap

Prioritised so each phase ships value and de-risks the next. Phase 0 is **done**
in this change.

### Phase 0 — Foundation ✅ (this PR)
- `--ds-*` design tokens + Inter typography (additive, non-breaking).
- Reusable `ui/` primitive library + living style guide at `/design`.
- Dive Quality Score engine (`diveScore.ts`) with tests.
- `DiveScoreCard` now **leads the location page**, folding in the best-window
  shortcut; legacy hero retired from that view.

### Phase 1 — Location page IA (next)
- Rebuild `DayDetail` section spine (Can I dive → Score → Reports → Hourly →
  Why → Breakdown → Advanced) entirely on DS primitives.
- Promote **live diver reports** into the primary flow (section 3).
- Add the **horizontal hourly timeline** (section 4) on the DS chart ink.

### Phase 2 — Charts & maps
- Reskin `VisTrendChart` / `SwellChart` to the chart tokens; declutter axes;
  explicit "now" marker.
- Lazy-load the Leaflet map; DS spot markers coloured by the quality scale;
  skeleton map tile.

### Phase 3 — Shell & navigation
- Migrate `TopNav`, search, filters and the mobile bottom nav to DS tokens and
  Inter; retire Bebas Neue / Space Mono from chrome.
- Sticky units/depth controls on scroll.

### Phase 4 — Surfaces at scale
- Spot cards, competition pages, admin dashboard and all modals onto DS
  primitives; introduce the light theme as a user setting.

### Phase 5 — Polish & measurement
- Optimistic UI on saves/reports; full skeleton coverage; motion pass.
- Instrument "time-to-decision" and score comprehension to validate the
  decision-first thesis.

---

## 11. Where we improve on the category

- **A calibrated, explainable score**, not a star rating — locally tuned to NE-UK
  visibility and fully decomposed into its drivers.
- **Confidence is a first-class citizen** — shown next to every score and driven
  by real signals (report count, forecast age, volatility), so users know *how
  much* to trust the call.
- **Underwater-native factors** — algae bloom, river runoff, seabed
  resuspension and satellite ocean-colour feed the model; these have no surf
  equivalent and are the real story for visibility.
- **Community truth in the loop** — diver reports bias-correct the forecast and
  are surfaced as live reports, closing the loop between model and reality.
