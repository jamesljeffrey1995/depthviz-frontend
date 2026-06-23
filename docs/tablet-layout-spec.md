# Tablet / adaptive layout

How DepthViz adapts across window classes, and how the expanded list-detail
layout is wired. Follow-up to `docs/mobile-tablet-audit.md`.

## Window classes (width-driven, not device/orientation-driven)

| Class | Width | Layout | Nav |
|---|---|---|---|
| Compact | < 600px | Single column (unchanged) | Bottom tab bar |
| Medium | 600–899px | Single column, wider shell (760px), 2-up card grids | Top nav |
| Expanded | ≥ 900px | List-detail: map pane + forecast detail pane (map route group only) | Top nav |

Everything keys off `min-width` media/`matchMedia` queries, so high zoom (400%),
small tablet split-screen, and portrait/landscape all resolve to the right
layout automatically — satisfying WCAG **Reflow** (1.4.10) and **Orientation**
(1.3.4) without orientation-specific code.

## Expanded list-detail (the substantive change)

For the map route group (`/map`, `/forecast`, `/tides`, `/best`) at ≥900px, the
`<main>` becomes a two-column grid:

- **Left pane** (`.mapPane`, sticky) — `SpotsMap` + saved-places dashboard,
  rendered from a single `mapView` value so there is never a second map mounted.
- **Right pane** (`.detailPane`) — the routed detail content, wrapped in a
  labelled `region` so it is a keyboard landmark.

Selecting a spot still drives everything through the existing
`handleSpotSelect` → `navigate('/forecast')` flow, so the URL remains the source
of truth; the map simply stays mounted in the left pane instead of being
replaced. On `/map` with nothing selected, the right pane shows a "choose a
spot" prompt.

### Why this needed no data-flow refactor
Forecast state (`currentLat/Lon`, `forecast`, `selectedLocationId`) already lives
in `App`, so both panes read the same state. The only structural change is where
the map and the routed content are *placed*, controlled by a single `splitView`
boolean (`isExpanded && MAP_GROUP_ROUTES.includes(currentPath)`).

### Accessibility
- **Focus**: on spot selection in the split layout, focus moves to the detail
  pane (`detailPaneRef`, via `requestAnimationFrame` after the route renders) so
  keyboard and screen-reader users land on the updated content.
- **Landmark**: the detail pane is `role="region"` with `aria-label="Forecast
  detail"`. A live region was deliberately avoided to prevent chatty
  announcements as charts stream in.
- **Reflow**: `minmax(0, …)` on the detail column lets charts/tables shrink
  rather than forcing horizontal scroll; panes collapse to one column < 900px.
- **Measure**: the search field is capped at 680px even in the wide shell, so it
  doesn't stretch across the full split width.

### Implementation map
- `src/hooks/useMediaQuery.ts` — SSR-safe `matchMedia` subscription.
- `src/App.tsx` — `isExpanded`/`splitView`, extracted `mapView`, restructured
  `<main>` (map pane + detail pane), focus handling, `containerWide`/`searchWrap`.
- `src/App.module.css` — medium shell, `.containerWide`, `.splitView` grid,
  `.mapPane` (sticky), `.detailPane`, `.searchWrap`.

## Leaflet note
The map has a fixed height and is remounted when `splitView` toggles (it moves
between the `/map` route and the left pane), so it re-measures its container on
mount — no manual `invalidateSize()` needed for the breakpoint transition. If a
future change makes the pane resize *without* remounting (e.g. a draggable
splitter), add an `invalidateSize()` call on that resize.

## Not yet done (Phase 3 / backlog)
- `@container` queries so cards adapt to pane width independent of viewport.
- Optional supporting pane (e.g. tides alongside forecast) where it shortens a
  task.
- axe/Lighthouse in CI + manual AT pass on the split layout.
