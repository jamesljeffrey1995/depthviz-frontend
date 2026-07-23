# DepthViz interface direction

## North star: the coastal field reference

DepthViz is a decision-support tool used by people who are about to enter the
water. It should resemble a well-maintained chart, tide table, or field
reference: direct, specific, information-dense, and calm. It must not resemble
a generic SaaS landing page or a simulated dive-computer dashboard.

The interface is deliberately editorial rather than promotional. A screen
starts with the question the user needs answered, then exposes evidence,
uncertainty, and safety constraints in that order.

## Visual language

- Warm chart-paper ground (`#f2f0e8`) with dark blue-black ink (`#182528`).
- Fine grid lines are permitted as a quiet spatial reference. Glows, blobs,
  glass panels, and atmospheric gradients are not.
- Teal (`#0f545c`) is a working colour for links, focus, selection, and active
  state. It is not decorative.
- Georgia is used sparingly for page and section headings; Arial is the
  workhorse UI face; IBM Plex Mono is reserved for references, coordinates,
  times, labels, and measurements.
- Corners are nearly square. A component gets a boundary only when the
  boundary explains grouping, containment, or interaction.
- Shadows are absent from ordinary content. A modal or mobile navigation tray
  may use one restrained shadow to establish layering.

## Information structure

The homepage is an index, not a sales funnel:

1. State the real decision in plain language.
2. Let the user enter a place immediately.
3. State the forecast limitation alongside the input.
4. List tools as rows with explicit outcomes, not icon cards.
5. Present announcements as a chronological log.

Product screens follow the product constitution: verdict, explanation, raw
data. Safety-relevant caveats are always visible and never placed behind
progressive disclosure.

## Components

### Navigation

Desktop navigation is a ruled text index with an underline for the active
section. Mobile navigation is a compact, opaque utility tray. Neither uses a
segmented pill or glass blur.

### Buttons and links

Primary actions may use a solid teal rectangle. Secondary actions use a plain
border or underlined text. Rounded capsule buttons are prohibited unless the
control is semantically a compact tag.

### Data groupings

Prefer rows, tables, labelled scales, and dividing rules. Do not wrap every
piece of content in a card. A card is justified only when its contents can move
or act as an independent unit.

### Status and condition colour

Condition colours encode a measured or assessed state and must always be
paired with text or a numeric value. No coloured dot may appear without a real
state. `blocked` remains neutral so it is not confused with poor visibility.

## Content rules

- Name the object, source, place, time, and consequence whenever known.
- Avoid claims such as “powerful insights”, “seamless”, “supercharge”, and
  “everything you need”.
- Do not use eyebrow labels mechanically above every heading. Monospaced
  labels are for genuine references or metadata only.
- Never fabricate proof, testimonials, partners, users, or live data.
- A call to action says what happens next: “Use map”, “Compare visibility”,
  “Read diver reports”.

## Accessibility and operating constraints

- Designed mobile-first for sunlight and weak connections.
- WCAG AA contrast is required.
- Colour is never the only signal.
- Controls retain visible keyboard focus and a minimum practical touch target.
- Motion is functional and honours `prefers-reduced-motion`.
- Core forecast and safety language must remain useful when imagery, maps, or
  remote data fail to load.

## Anti-patterns

Do not introduce:

- oversized centre-aligned marketing heroes;
- gradient text or decorative glow;
- dark-mode-as-premium styling;
- feature-card grids or icon tiles;
- nested cards;
- repeated pills and badges;
- floating browser or dashboard mockups;
- decorative emojis, sparkles, or status dots;
- vague startup copy;
- entrance animation used only to make a static page feel expensive.
