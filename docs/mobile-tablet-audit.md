# Mobile & Tablet Audit — DepthViz frontend

A focused review of the app against the WCAG 2.2 / platform-guidance quality
model for mobile and tablet webpages (readability, responsive/adaptive layout,
touch input, accessibility, performance, validation). This documents what is
already strong, the targeted fixes applied on this branch, and a prioritised
backlog of further improvements that were intentionally left out of scope to
keep the change reviewable.

## What is already strong

The app is mobile-mature and most ship-first essentials are already in place:

- **Viewport / zoom** — `width=device-width, initial-scale=1` with no
  `user-scalable=no`; pinch-zoom is preserved (`index.html`).
- **Semantic HTML & ARIA** — real `<button>`/`<a>`/`<label>`/`<select>`
  controls, landmark `<nav>`/`<header>`/`<footer>`, `aria-label`,
  `aria-current`, `aria-live` regions, and a skip-to-content link.
- **Focus management** — `:focus-visible` outlines globally; `useDialog`
  implements a proper modal pattern (initial focus, focus trap recomputed per
  Tab, `Escape` to close, background scroll-lock, focus restoration).
- **Touch targets** — primary controls (`.navBtn`, `.bottomNavBtn`,
  `.footerLink`, auth button/avatar) already meet 44 px.
- **Reduced motion** — `prefers-reduced-motion` disables the caustics/sonar
  animations and neutralises transitions.
- **Mobile chrome** — fixed bottom tab bar honours `env(safe-area-inset-bottom)`;
  the cookie banner and PWA toasts are deliberately stacked above it so their
  actions are never hidden.
- **Reflow** — content column caps at 680 px (a sensible "constrain measure"
  on tablet/desktop); data tables that need width (`MLCharts`) scroll inside an
  `overflow-x: auto` wrapper, which the WCAG reflow exception allows.

## Targeted fixes applied on this branch

| Issue | WCAG 2.2 | Fix |
|---|---|---|
| The fixed bottom nav could cover a control when focus or an in-page anchor scrolled it to the bottom edge. No `scroll-padding` was set despite `scroll-behavior: smooth` and the skip-link anchor. | 2.4.11 Focus Not Obscured (Minimum) | Added `scroll-padding-top` and a mobile-only `scroll-padding-bottom` (bar height + safe-area) in `src/index.css`. |
| Unit toggle: the switch was 22 px tall and the adjacent `FT`/`M` labels had no padded hit area — three small, adjacent targets failing the size minimum and its spacing exception. | 2.5.8 Target Size (Minimum) | Switch height 22 → 24 px (slider radius 11 → 12 px); `.unitLabel` given `min-height: 24px` + horizontal padding without changing layout (`src/App.module.css`). |

These were chosen because they are genuine conformance gaps, high-confidence,
and low-risk (no layout or behaviour change beyond the target areas).

## Backlog — recommended, intentionally out of scope

Left out to keep this branch a tight, reviewable audit pass:

1. **Tablet-specific layout.** The app switches binary at 480 px (mobile bottom
   nav ↔ top nav). A medium/expanded breakpoint with a list-detail or
   supporting-pane pattern (e.g. map + forecast side-by-side) would use tablet
   width better, but it is an architectural change.
2. **Semantic logo control.** The header logo is a `<div role="button">`;
   converting it to a native `<button>` would fix the Space-key scroll quirk and
   match "native controls before ARIA". Low risk but a focused follow-up.
3. **Comfortable targets on secondary controls.** The depth `<select>` (28 px)
   and toggle clear the 24 px floor but sit below the ~44 px platform comfort
   range; worth revisiting if the header control row is restyled.
4. **Container queries.** Cards/panels currently adapt to viewport width via
   media queries; `@container` would let them adapt to the space they are
   actually given (valuable in split-view/side panes).
5. **Validation loop.** Wire `axe-core`/Lighthouse into CI and pair with a manual
   checklist (keyboard, 200%/400% zoom, reflow, VoiceOver/TalkBack) on the
   critical paths (search → forecast, sign-in, log dive).

## How to verify the fixes

- **Focus Not Obscured:** on a narrow viewport, tab through controls near the
  page bottom and confirm none land underneath the fixed nav.
- **Target size:** the unit toggle and `FT`/`M` labels present a ≥24 px tap area
  (inspect the bounding boxes).
