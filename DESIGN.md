# DepthViz interface direction

## Chosen direction: Ripple

Eleven candidate directions were drawn up as interactive mocks and reviewed
together. The first ten were rejected as too rectilinear. Four things were doing
that work, and naming them matters more than the palette:

1. uppercase letterspaced monospace micro-labels on everything
2. hairline rules as the only separator
3. near-square corners (the radius scale topped out at 4px)
4. data arranged as ruled grids and tables

Ripple is the direction built in response, and it is now the house style.
The reference mock is `docs/design-directions/ripple.html`; the ten it replaced
are kept alongside it for context.

### What Ripple is

The shape language comes from water rather than from an instrument panel.
Boundaries are made by surface lift and soft shadow, not by lines. Nothing is
square. Type is one family at four weights, and labels read as words.

**Spacing.** 4pt scale, no exceptions: `--space-xs` 4, `--space-sm` 8,
`--space-md` 16, `--space-lg` 24, `--space-xl` 40, `--space-2xl` 64.

**Radius.** Four steps and a pill, and every surface takes one of them:
`--radius-sm` 10 (chips, inputs), `--radius-md` 18 (cards), `--radius-lg` 26
(large cards), `--radius-xl` 34 (hero panels, sheets, modals), `--radius-full`
for anything the user presses. A fifth value is a bug.

**Elevation.** Two soft, wide shadows carry the whole hierarchy:
`--shadow-xs` for resting cards, `--shadow-card` for raised panels, and
`--shadow-lg` for things that float (docks, sheets, modals). These replaced the
hairlines, so they are structural. Do not add a third shadow, and do not put a
border on something that already has one.

**Type.** One family, `--font-sans`, for everything, with `--font-display`
pointing at the same stack so a softer grotesque can be swapped in later without
touching a component. Labels are sentence case. Large figures are set *light*
(300) rather than heavy: scale carries them, not weight.

Monospace is reserved for genuine machine data: coordinates, timestamps, buoy
identifiers, sensor payloads. Never for labels, eyebrows, section headings,
tags, or button text. This is the single rule most likely to be broken by
accident and most responsible for how the old interface read.

**Colour.** A deep-water ground with one aquamarine accent. The neutral ramp is
biased green so it belongs to the accent rather than reading as an unconsidered
grey. `--surface` is the page, `--surface-raised` a panel, `--surface-tint` a
fill (bar tracks, pressed, selected), `--surface-sunken` an inset.

**Numbering and eyebrows.** Only where the content is genuinely a sequence.
Parallel options, tool lists and news items are not sequences, so they are not
numbered.

### Registers

Two, both defined in `src/index.css`:

- **Deep water** is the planning register. It is used for live forecast data,
  maps, tides, comparisons, history and in-session safety tools such as apnea
  training and weighting.
- **Porcelain** (`:root[data-theme='light']`) is the reading and community
  register. It is used for the home page, reports, catches, news, profiles,
  competitions and legal content.

`src/lib/routeTheme.ts` owns that split. A route should not choose a register
because a single component looks better in it; move the component onto tokens
and keep the route aligned with the user's task. On a light ground, clarity
colour is a fill and small text takes ink so the luminance ramp and AA contrast
do not compete.

### State of the rollout

Converted: the token layer, the app shell, top and bottom navigation, the
footer, the cookie banner, the home page, the search controls, the forecast
reading in `DayDetail` (whose arc gauge is `RippleGauge`), the community feed,
competition registration and the weight calculator.

Not yet converted: roughly 300 hardcoded colours remain in component
stylesheets, concentrated in `CompetitionAdmin`, the apnea training screens and
the admin console. They still render coherently because they are dark-on-dark,
but they will not follow a theme switch. Convert them onto tokens as each screen
gets its pass, and delete the legacy alias block in `src/index.css` as it
empties.

## What the product has to do

DepthViz answers one question: can I see enough to dive here. Everything on a
product screen is in service of that, in this order:

1. The verdict, as a number and an assessment.
2. Why that verdict, in terms the diver can check against the water.
3. The raw data behind it.

Safety-relevant caveats stay visible. They are never placed behind an
accordion, a tab, or a "read more".

## Operating constraints

These come from where the app is actually used, which is outdoors, on a phone,
often on a weak connection, sometimes minutes before entering the water.

- Mobile first. Every screen has to work at 360 px wide before it is designed
  wider.
- Legible in direct sunlight. High contrast is a functional requirement here,
  not a preference.
- WCAG 2.1 AA is the floor, enforced by `npm run test:a11y` (axe-core, desktop
  and mobile viewports). See `tests/README.md` before touching the baseline.
- Colour is never the only signal. Every state also carries text, a number, or
  a shape.
- Visible keyboard focus on every interactive element, and a practical touch
  target size.
- Motion is functional and honours `prefers-reduced-motion`.
- Core forecast and safety copy stays useful when maps, imagery, or remote data
  fail to load.
- Anything that waits on the network has a loading state. Buttons show progress
  in place; data areas use skeletons rather than appearing abruptly.

## Colour rules that are not stylistic

Two separate ramps exist and must not be conflated:

- The **water-clarity ramp** (`--sev-*`, `--ds-q-*`) grades how clear the water
  is. It is a magnitude, so it is encoded in lightness first: the steps climb
  monotonically in relative luminance from poor to excellent. Desaturate a
  screenshot and the order still reads, which is also what keeps it legible
  with red-green colour deficiency. `src/lib/conditionRamp.test.ts` enforces
  both the ordering and the AA contrast floor.
- The **status ramp** (`success`, `warn`, `caution`, `danger`, via
  `src/lib/severity.ts`) grades risk: algae, turbidity, resuspension, river
  discharge, temperature advisories. A murky but safe day and a hazardous day
  must not read in the same language.

`blocked` is a safety state, not a clarity step. It stays neutral so it is
never mistaken for "just murky", and it is always paired with its label and
alert glyph. `src/lib/conditionRamp.ts` depends on this.

Semantic colour is separate from whatever accent the chosen direction uses. An
accent is not allowed to stand in for good, warning, or critical.

## System discipline

Direction-independent, and the difference between a designed interface and an
improvised one:

- One spacing scale, applied everywhere. 4pt or 8pt, chosen once. No arbitrary
  values.
- One type ramp with fixed sizes and line heights. No improvised sizes.
- One radius, one border treatment, one shadow policy, shared by buttons,
  inputs, cards, modals and navigation. Mixed radii and stray shadows are the
  clearest sign of unsystematic work.
- Components are styled through tokens, never with literal hex values. The
  token files are `src/styles/tokens.css` and the `:root` block in
  `src/index.css`.
- Both light and dark rendering are designed, not inverted from each other.

## Content rules

- Name the object, source, place, time and consequence whenever they are known.
- Never fabricate proof, testimonials, partners, user counts, or live data.
  Sample data in mocks is labelled as sample data.
- A call to action says what happens next: "Use map", "Compare visibility",
  "Read diver reports".
- Errors say what went wrong and what to do about it. No apologies, no vague
  "something went wrong".
- Avoid marketing filler: "powerful insights", "seamless", "supercharge",
  "everything you need".
- Units follow the app-wide `ft`/`m` setting. Figures that line up in columns
  use tabular numerals.

## Where the visual decisions live

`src/index.css` and `src/styles/tokens.css` currently carry the withdrawn
direction's palette, including a legacy alias block kept alive so unconverted
components still render. Expect to replace those values wholesale when a
direction is chosen. Until then, do not add new tokens in the old idiom and do
not treat the existing palette as settled.
