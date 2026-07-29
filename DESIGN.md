# DepthViz interface direction

## Status: visual direction is open

The previous version of this file prescribed one specific look, a dark matte
"marine avionics" identity, and enforced it with a long list of prohibitions.
That direction has been withdrawn. It is not the house style any more and
should not be reintroduced from git history.

What remains below is deliberately narrower: the constraints that hold whatever
the app ends up looking like, because they come from how DepthViz is used or
because a test enforces them. Anything that is purely a matter of taste is now
an open decision, not a rule.

Candidate directions are drawn up as interactive mocks, all built on the same
sample forecast so they can be compared like for like:

- `docs/design-directions/ripple.html`, the current front runner
- `docs/design-directions/directions-01-05.html`
- `docs/design-directions/directions-06-10.html`

Open them in a browser. Each carries its own palette, type pairing, central
device and stated trade-off.

The first ten were reviewed and judged too rectilinear: monospace micro-labels
in caps, hairline rules everywhere, hard corners, everything in a ruled grid.
Ripple is the response to that and is the direction to build on unless it is
overruled. It is not yet ratified here, so no aesthetic rules follow from it
yet. When it is confirmed, this section is replaced by a "Chosen direction"
section describing its spacing, radius, shadow, type and colour decisions, and
only then do aesthetic rules belong in this file again.

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
