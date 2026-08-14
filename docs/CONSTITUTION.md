# The DepthViz Product & Engineering Constitution

> The definitive product, design and engineering standard for every interface,
> interaction, endpoint and line of code across DepthViz.

**Status:** Canonical · **Applies to:** `depthviz-frontend` and `depthviz-api` ·
**Companion:** the backend-specific chapter lives at
[`depthviz-api/docs/CONSTITUTION.md`](https://github.com/jamesljeffrey1995/depthviz-api/blob/main/docs/CONSTITUTION.md) ·
**See also:** the living component guide at [`/design`](../src/components/DesignSystemPage.tsx),
rendered from the real primitives shipped by the app.

---

## How to read this document

This is a **constitution**, not a style guide. A style guide tells you where to put a
semicolon; a constitution tells you what the product is _for_ and what you are allowed
to trade away when the two pull against each other. When a rule here conflicts with a
convenient shortcut, the rule wins. When two rules here conflict, the earlier chapter
wins — product philosophy outranks a component convention, which outranks a naming
preference.

Three words appear throughout with precise meaning, borrowed from RFC 2119:

- **MUST** — non-negotiable. A change that violates a MUST is a defect, whether or not a
  test catches it.
- **SHOULD** — the default. Deviating requires a one-line justification in the PR
  description. "It was faster" is not a justification.
- **MAY** — genuinely optional; pick the option that best serves the reader.

The document is long on purpose. You are not expected to hold all of it in your head. You
_are_ expected to know it exists, to know which chapter governs the work in front of you,
and to read that chapter before you start. Skimming the whole thing once, then treating
the table of contents as an index, is the intended usage.

### Contents

1. [Philosophy](#1-philosophy)
2. [Product values](#2-product-values)
3. [UX principles](#3-ux-principles)
4. [Navigation philosophy](#4-navigation-philosophy)
5. [Information hierarchy](#5-information-hierarchy)
6. [The design system](#6-the-design-system)
7. [Design tokens](#7-design-tokens)
8. [Data-visualisation principles](#8-data-visualisation-principles)
9. [Domain screens](#9-domain-screens)
10. [Copywriting & tone](#10-copywriting--tone)
11. [Empty states, errors & loading](#11-empty-states-errors--loading)
12. [Mobile interaction patterns](#12-mobile-interaction-patterns)
13. [Accessibility](#13-accessibility)
14. [Component architecture](#14-component-architecture)
15. [React architecture](#15-react-architecture)
16. [TypeScript standards](#16-typescript-standards)
17. [State management](#17-state-management)
18. [File & folder structure](#18-file--folder-structure)
19. [Naming conventions](#19-naming-conventions)
20. [API design](#20-api-design)
21. [AI integration guidelines](#21-ai-integration-guidelines)
22. [Performance budgets](#22-performance-budgets)
23. [Testing standards](#23-testing-standards)
24. [Feature acceptance criteria](#24-feature-acceptance-criteria)
25. [Git workflow](#25-git-workflow)
26. [Technical-debt rules](#26-technical-debt-rules)
27. [Amending this constitution](#27-amending-this-constitution)

---

## 1. Philosophy

DepthViz exists for one reason:

**Help people make better decisions before entering the water.**

Everything else is secondary. Not charts. Not weather. Not maps. Not the model. Not AI.
Not subscriptions. Not graphs. Those are all _means_. The product is not a weather
application; it is a **decision-support platform** that happens to be about the sea.

The distinction is not rhetorical — it changes what we build. A weather application is
finished when it displays accurate numbers. A decision-support platform is finished only
when a person can look at the screen and _act_ with justified confidence. Accurate
numbers that leave the user still doing arithmetic in their head are a failure, not a
feature.

Every screen must be able to answer its **core decision** — the single question the user
came to that screen to resolve:

| Screen | The user's decision |
|--------|---------------------|
| Forecast | Should I dive here, today? |
| Competition (competitor) | What do I need to do next? |
| Competition (admin) | Is today's event under control? |
| Registration | How do I enter, and am I in? |
| Reports | Can I trust this report? |
| Species | Can I safely identify this fish? |
| Profile | What matters about this diver? |

If a screen cannot answer its core decision **within five seconds** of loading — for a
first-time user, on a mid-range phone, in sunlight, over a weak signal — it is not
"a bit slow" or "a bit busy." It is broken, and it must be redesigned. The five-second
test is the single most important acceptance criterion in this document, and every later
chapter exists to make passing it repeatable rather than accidental.

A useful sharpening question, applied to any element on any screen: _"Does this help the
user make the decision, or does it just prove we have the data?"_ Data we have but that
does not move the decision belongs behind disclosure, in an export, or nowhere.

### The safety corollary

DepthViz influences whether a person enters the sea. That is a physical-risk decision.
Two obligations follow and they override every other value in this document, including
delight and growth:

1. **Never manufacture false confidence.** A confident-looking green verdict built on
   thin or stale data is more dangerous than an honest "we're not sure." Uncertainty MUST
   be visible wherever it exists (see [§8](#8-data-visualisation-principles) and
   [§21](#21-ai-integration-guidelines)).
2. **Never hide a safety-relevant caveat behind disclosure.** Progressive disclosure
   ([§3](#3-ux-principles)) is for _detail_, not for _warnings_. A rip-current note, an
   offshore-wind flag, or a "reports contradict the model" signal belongs on the first
   screen, not one tap down.

---

## 2. Product values

Every feature, every screen and every endpoint must measurably improve at least one of
these seven values, and must not regress any of them without an explicit, recorded
trade-off:

- **Confidence** — the user believes the answer and knows how much to trust it.
- **Speed** — time-to-decision, not raw benchmark numbers. The two are related but not
  the same; a fast page that requires ten seconds of reading is a slow decision.
- **Trust** — the product is honest about what it knows, what it's guessing, and where it
  got the data.
- **Clarity** — a beginner understands the screen; an expert is not slowed by it.
- **Consistency** — the same idea looks and behaves the same way everywhere, so learning
  one screen teaches all of them.
- **Delight** — the product feels considered and alive, in service of the above, never at
  their expense.
- **Safety** — see the safety corollary. When safety conflicts with any other value,
  safety wins.

Never optimise for **"more information."** More information is the easiest thing to add
and the most common way to make a decision harder. Optimise for **better decisions**, and
be willing to _remove_ information to get there.

Every PR description SHOULD name which value(s) it advances. A change that cannot name one
is either mis-scoped or unnecessary — see [§24](#24-feature-acceptance-criteria) and
[§25](#25-git-workflow).

---

## 3. UX principles

These eight principles are the operating rules that turn the philosophy into interface
decisions.

### 3.1 Good UI design is intuitive

Users should be able to understand and use the interface quickly, regardless of technical
experience. The product must explain itself through structure, labels, and obvious actions
rather than relying on prior training.

### 3.2 Familiarity is key

Use familiar patterns and conventions so users can rely on existing mental models rather
than learning a new system from scratch. Navigation, controls, disclosure, and feedback
should behave the way experienced web and mobile users already expect.

### 3.3 Good UI needs to be responsive

Interfaces must adapt cleanly across phone, tablet, and desktop layouts while staying
fast. Responsiveness is about both screen fit and perceived performance: layouts reflow,
targets remain usable, and feedback arrives without delay.

### 3.4 Consistency and clarity play a part

Visual and behavioural consistency make the interface easier to learn, while clarity keeps
interactions simple, predictable, and understandable. Learning one screen should teach the
user how the rest of the product behaves.

### 3.5 Empathy is necessary for good UI design

Design must account for users' intentions, confidence, and emotional state throughout the
experience. The product exists for people making real decisions before entering the water,
so the interface must reduce anxiety, not add to it.

### 3.6 The best UI design calls for an invisible UI

The interface should minimise disruption to the user's goal by keeping only essential
elements and removing unnecessary friction. When the design is working, the user focuses on
the decision, not on operating the interface.

### 3.7 Minimalism is key in user interface

Use typography, colour, spacing, proportions, and repeated visual patterns to create clear
hierarchy. Minimalism is not emptiness for its own sake; it is disciplined emphasis on what
the user needs to notice and do next.

### 3.8 Best UI design is about inclusivity

Design for users with different needs by considering accessibility from the start:
contrast, legible typography, strong hierarchy, multiple forms of feedback, and icons
paired with text. If an interface works only for ideal conditions, it is incomplete.

---

## 4. Navigation philosophy

Navigation should **disappear.** The user should never think _"where is that feature?"_ —
only _"of course it's here."_

- **Maximum depth: three levels.** If a task takes more than three navigational steps,
  the information architecture is wrong, not the user.
- **No buried settings, no hidden actions.** Prefer **contextual actions** placed where
  the decision is made over global menus the user has to go find. A "report conditions"
  button belongs on the forecast for the spot being viewed, not three taps away in a
  profile menu.
- **The shell is consistent.** `TopNav`, search, filters and the mobile bottom nav behave
  identically on every screen. Learning to navigate one screen teaches all of them
  (this is the **consistency** value made concrete).
- **Back always means back.** Route transitions are predictable; `react-router-dom` (v7)
  history is never manipulated to trap or surprise the user.

---

## 5. Information hierarchy

Every content screen follows the **same vertical spine**, top to bottom. This never
changes between screens — it is the structural expression of decision-first:

```
1. Decision            — the answer / verdict
2. Primary action      — the one thing to do next
3. Supporting info     — the "why", at a glance
4. Advanced detail     — factor breakdowns, model inputs
5. Historical data     — trends, past reports
6. Technical info      — diagnostics, raw values, export
```

A screen may _omit_ lower sections (not every screen has technical info) but it may
**never reorder** them. Historical data never appears above the decision; a raw metric
never appears above the verdict it feeds. When you are unsure where a new element goes, ask
which layer it serves and place it there.

---

## 6. The design system

The design system is not a suggestion box of components — it is the **only** vocabulary
the product is allowed to speak in. Its code-backed implementation is rendered live at
`/design`. This chapter states the constitutional rules that govern it.

### 6.1 Component reuse is mandatory

There is **one** button, **one** card, **one** badge. When a new need arises you
**extend an existing component** with a prop; you do **not** create `Button2`,
`ForecastCardLarge`, or `MapCardNew`. A component that cannot be extended to fit is a
signal to change the component's API deliberately (and update `/design`), not to fork it.

Every visual element on screen MUST resolve to a primitive in
[`src/components/ui/`](../src/components/ui). The current primitives and their single
responsibilities:

| Component | Purpose |
|-----------|---------|
| `Card` | Base surface — flat / raised / floating; optional status accent edge |
| `Button` | Actions — pill, ≥44px target, primary / secondary / ghost / danger |
| `Badge` | Verdicts & status — dot or icon + label, **never colour-only** |
| `SectionHeader` | Page structure — eyebrow + title + subtitle + action |
| `Meter` | Factor bar — value + impact glyph + note; `role="meter"` |
| `StatTile` | Metric tile — tabular value, unit, sub-label, icon |
| `DiveScore` | The signature score gauge — 270° arc, `role="img"` + full label |
| `SegmentedControl` | Toggles — units, ranges; keyboard operable |
| `Skeleton` | Loading placeholders |
| `icons` | Dependency-free icon set, `currentColor`, 1.6 stroke |

All primitives export from a single barrel: `import { Card, DiveScore } from '../components/ui'`.

### 6.2 One card, one question

Cards are the foundation of every layout. **Every card answers exactly one question.** A
card that contains two unrelated ideas is two cards wearing one border — split it. If you
cannot write the single question a card answers in one sentence, the card is wrong.

### 6.3 Typography

**One font family: Inter Variable.** Weights are restricted to **400 / 500 / 600 / 700** —
never more. (Bebas Neue and Space Mono remain in `package.json` only for legacy chrome
being actively retired per the design-system roadmap; **do not** introduce them into new
work.)

The type scale is fixed: **12 · 14 · 16 · 18 · 20 · 24 · 32 · 40 · 48**. Never invent a
size. Everything aligns to the scale. All metrics use **tabular figures** so numbers stay
in stable columns across rows and across updates (this directly serves "reduce thinking").

### 6.4 Colour

Colour **communicates information; it is never decoration.** The semantic roles:

| Role | Meaning |
|------|---------|
| Blue (`--ds-accent`) | Information / brand |
| Green | Good |
| Amber | Warning |
| Red | Danger |
| Grey | Secondary |
| White / surface | Breathing space |

Plus the six-step, luminance-stepped **dive-quality scale**
(`--ds-q-excellent … --ds-q-blown`) that encodes conditions. The governing rule:
**if colour disappeared, the interface would still work.** Every colour is therefore
paired with a label, glyph, or position. See [§13](#13-accessibility).

### 6.5 Spacing, radius, shadow, motion

- **Spacing** — a strict 8-point grid: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`.
  4px is the only sub-step, reserved for tight icon/label gaps. Never invent a value.
- **Border radius** — cards `16`, images `16`, charts `16`, maps `16`, dialogs `24`,
  buttons/chips `9999` (pill). Soft, but professional.
- **Shadow** — three deliberate steps, used **only** to establish hierarchy (floating
  sheets, the primary decision card), never for decoration. Whitespace and a single
  hairline do the rest.
- **Motion** — motion _explains change_; it is never ornament. Durations: hover `150ms`,
  expansion `200ms`, navigation `250ms`, page `300ms`. Always ease. **Never bounce, never
  overshoot.** All motion collapses to nothing under `prefers-reduced-motion`.

The precise token values are in [§7](#7-design-tokens); this chapter fixes the _rules_,
those tokens are the _implementation_.

---

## 7. Design tokens

**Source of truth:** [`src/styles/tokens.css`](../src/styles/tokens.css). Every token is
namespaced `--ds-*` and layered additively over the legacy theme so the design system
rolls out screen-by-screen without a big-bang rewrite.

The absolute rule of tokens: **no raw values in component styles.** A hard-coded
`#22b573`, `padding: 15px`, or `border-radius: 10px` is a defect — it will drift, it
breaks theming, and it silently defeats accessibility work. Every colour, space, radius,
shadow, duration and type step MUST reference a token.

```css
/* ✗ Forbidden — raw values, off-grid, un-themeable */
.card { background: #10202b; padding: 15px; border-radius: 10px; }

/* ✓ Correct — token-referenced, on-grid, theme-aware */
.card {
  background: var(--ds-surface);
  padding: var(--ds-space-4);
  border-radius: var(--ds-radius-lg);
}
```

Token families, summarised (see `tokens.css` and `/design` for the live reference):

- **Colour** — semantic roles (`--ds-accent`, `--ds-surface`, `--ds-text-strong`, …) plus
  the six-step `--ds-q-*` dive-quality scale. Roles are theme-aware with a default (dark),
  a light override, and a `system` mode.
- **Space** — `--ds-space-1 … --ds-space-8` mapping onto the 8-pt grid.
- **Radius** — `--ds-radius-sm|md|lg|xl|pill`.
- **Shadow** — `--ds-shadow-1|2|3` and `--ds-shadow-focus` (the 3px ocean focus halo).
- **Motion** — `--ds-dur-fast|base|slow`, `--ds-ease`, `--ds-ease-spring`.
- **Type** — `--ds-text-hero|h2|h3|body|meta|label`.
- **Chart ink** — `--ds-chart-grid`, `--ds-chart-now`, plus the quality scale reused for
  series colour.

**Adding a token** is an amendment, not a routine act (see [§27](#27-amending-this-constitution)):
if a genuinely new need exists, add the token to `tokens.css`, surface it at `/design`, and
only then use it. Never reach for a raw value because adding a token feels heavy — that is
exactly the moment the token matters.

---

## 8. Data-visualisation principles

Every chart answers **one** question — not ten. A chart that tries to answer several
questions answers none of them in five seconds. Before writing a single line of chart
code, name the one question, then design backwards from it.

> **Before building any chart, read the `dataviz` skill.** It governs colour, form choice,
> stat tiles, meters and dashboard layout across every medium. This chapter is the
> DepthViz-specific overlay on top of it.

The rules for every visualisation (trend, swell, hourly timeline):

- **Minimise chrome.** Remove unnecessary gridlines. Gridlines sit at `--ds-chart-grid`
  (≈8% ink) and exist only to make values readable, never to fill space.
- **Highlight the trend and highlight "now."** "Now" is marked explicitly with
  `--ds-chart-now` — never left for the reader to locate. The eye should land on the
  present and the direction of travel without effort.
- **Explain uncertainty; never hide it.** Forecast confidence, sparse data and model
  disagreement are shown, not smoothed away. A chart that looks more certain than the data
  justifies violates the trust and safety values (see [§1](#1-philosophy)).
- **One accent line + a soft area fill.** Not five overlaid series competing for
  attention. If several series genuinely matter, small multiples beat an overplot.
- **Colour speaks the product's language.** Series colour encodes the quality scale so a
  chart reads the same as the score and the meters. Colour is never the _only_ encoding.
- **Same ink, every device.** The chart is decluttered to ~4 axis labels on mobile;
  points/bars are ≥44px-tappable. Desktop shows the same visual language, not a different
  chart.

Charts serve the decision. A beautiful chart that doesn't change what the user does is
decoration, and decoration is forbidden ([§3.3](#3-ux-principles)).

---

## 9. Domain screens

Each product surface has a fixed answer-order. These are specialisations of the universal
spine ([§5](#5-information-hierarchy)), and like it, they are not reorderable.

### 9.1 Forecast

Answers **"Can I dive?"** — then, in order: verdict → visibility score → live reports →
hourly timeline → conditions/why → advanced models. The Dive Quality Score and its
plain-English verdict lead; raw metres and model traces live below and behind disclosure.
Never surface a graph above the verdict.

### 9.2 Competition — competitor view

Answers **"What happens next?"** in this order:

```
Registration status  →  start time  →  rules  →  messages  →  leaderboard  →  results
```

The competitor should always see their _own_ next required action first (am I registered?
when do I start?), then shared context (rules, messages), then outcomes (leaderboard,
results). Standings never outrank "what do I do next."

### 9.3 Competition — admin view

Answers **"Is today's event under control?"** in this order:

```
Today's event  →  who's in  →  who's out  →  scoring  →  messages  →  safety  →  settings
```

Safety (who is in the water, who has checked back in) is never buried under settings.
Settings are the least-urgent thing an organiser needs mid-event and sit last accordingly.

### 9.4 Reports

Reports must **feel trustworthy before they are read.** Every report shows: reporter,
time, confidence, evidence, photos, weather correlation, and historical reliability. The
purpose is to let a user decide _"can I trust this?"_ at a glance — trust is surfaced, never
assumed. A report with weak evidence is shown _as_ weak, not hidden and not dressed up.

### 9.5 Maps

Maps **support** decisions; a map is **never** the decision. Avoid the giant empty map that
is impressive and useless. Every map must support another action — pick a spot, compare
spots, drop a report. The Leaflet map (`react-leaflet` v5) lazy-loads, uses DS spot markers
coloured by the quality scale, and shows a skeleton tile while loading. If a map isn't
helping the user act, it shouldn't be full-bleed.

### 9.6 Species

Answers **"Can I safely identify this fish?"** Identification content is safety-relevant
(size limits, protected species, venomous look-alikes), so identifying features and
cautions are first-class, never disclosed away.

### 9.7 Profile

Answers **"What matters about this diver?"** Surface the diver's context that informs
community trust and competition eligibility; keep private data private (see the API repo's
data-safety docs and RLS policies) and keep the signal-to-noise high.

---

## 10. Copywriting & tone

Words are UI. They are held to the same standard as pixels: every word does a job or it is
cut. The DepthViz voice is **calm, competent, and on the diver's side** — the voice of an
experienced buddy who respects your time and never shows off.

**Voice principles:**

- **Plain English over jargon.** "Clear water and calm seas are carrying the score" beats
  "high optical transmittance, low sea-state index." Jargon is available behind disclosure
  for those who want it.
- **Say the answer, then the reason.** Copy follows decision-first too: lead with the
  verdict sentence, then the because-clause.
- **Second person, active voice.** "You can dive at Beadnell this afternoon," not "Diving
  conditions at Beadnell are favourable."
- **Honest, never hedging into uselessness.** "We're not confident — only two reports
  today" is honest. "Conditions may or may not be suitable" is noise. State the
  uncertainty _and_ its cause.
- **Never blame the user** (see [§11](#11-empty-states-errors--loading)).
- **Units and numbers are formatted for humans.** Respect the user's chosen units
  (`src/lib/units.ts`), round to a sensible precision, and never show more decimal places
  than the underlying data supports — false precision is a trust violation.

**Mechanics:** UK English spelling (`metre`, `colour`, `harbour`). Sentence case for
headings and buttons — never Title Case, never ALL CAPS except the 12px uppercase label
role. One space after a full stop. No exclamation marks in system copy except genuine
celebration (a competition win). Numbers 0–9 as digits when they are measurements
(`3 m visibility`), words in prose where it reads better.

---

## 11. Empty states, errors & loading

These three states are where products feel broken, and therefore where trust is won or
lost. They get first-class design, never an afterthought.

### 11.1 Empty states

An empty state must **explain, encourage, and guide.** It never just says "No data."

```
✗  No data.

✓  No visibility reports have been submitted here today.
   Be the first diver to help your local community. [ Add a report ]
```

Every empty state answers: _why_ is it empty, _what_ can I do about it, and (where
relevant) a **single primary action** to do it. An empty state with no path forward is a
dead end and a design bug.

### 11.2 Errors

An error must **explain, fix, and reassure** — in that order — and **never blame the
user.**

- **Explain** in plain language what happened, from the user's point of view, not the
  stack's. "We couldn't reach the forecast service," not "500 Internal Server Error."
- **Fix** — give the way out: a retry button, a fallback, an alternative. An error the
  user can't act on is just an apology.
- **Reassure** — make clear nothing was lost or broken where that's true ("Your report is
  saved — we'll send it when you're back online").
- Distinguish _offline_ (see `useOnlineStatus`), _service degraded_ (see
  `useServiceStatus`), and _genuinely broken_. Each gets different copy and a different
  fix. Treating a weak signal like a server crash is a trust violation.

### 11.3 Loading

Loading must **never feel broken.** Use, in order of preference:

- **Skeletons over spinners.** Skeletons (`Skeleton`, `DiveScoreSkeleton`) preserve layout
  and set the expectation of what's coming; a spinner is a shrug.
- **Optimistic updates** for user actions (unit toggles, saves, votes) — reflect the
  intended state immediately and reconcile on response (see [§17](#17-state-management)).
- **Progressive / incremental rendering** — show the decision as soon as its data lands;
  don't block the verdict on a satellite tile.
- **Perceived speed** matters more than raw speed. The map and satellite imagery
  lazy-load; transitions stay in the 150–300ms band so nothing feels stuck and nothing
  feels frantic.

---

## 12. Mobile interaction patterns

Assume every diver has **wet hands, bright sunlight, a poor signal, and one free thumb.**
Design every interaction to work under all four at once — because on a beach, they always
co-occur.

- **Touch targets ≥44px**, always, with extra scroll padding so the mobile bottom nav
  never obscures a focused control. This is not negotiable for wet-hand tapping.
- **Thumb-first layout.** Primary actions sit in the lower, reachable arc of the screen;
  the top of the screen is for reading, not for tapping.
- **Sunlight contrast.** The default theme is high-contrast for readability at midday on a
  bright beach; contrast is validated (see [§13](#13-accessibility)), not eyeballed.
- **Weak-signal resilience.** Cache aggressively (`src/lib/cache.ts`), degrade gracefully,
  and make offline a designed state, not a crash. The app is a PWA (`vite-plugin-pwa`);
  installed, it must still give a usable last-known answer with no signal.
- **Horizontal scrolling is deliberate, never accidental.** The hourly timeline scrolls
  horizontally by design and says so; page bodies never scroll sideways.
- **Gestures are enhancements, not the only path.** Anything doable by swipe is also doable
  by a visible control — a diver with gloves or a cracked screen still gets there.

Desktop and tablet are first-class too (see `docs/mobile-tablet-audit.md` and
`docs/tablet-layout-spec.md`), but mobile-under-adverse-conditions is the design baseline
everything else scales up from.

---

## 13. Accessibility

**WCAG 2.2 AA is the floor, not the goal.** Accessibility is a safety feature here: a
diver who can't read the verdict in sunlight is a diver making a worse decision. The
non-negotiables:

- **Colour is never alone.** Every quality colour is paired with a label; meters carry
  `▲ / ● / ▼` impact glyphs; badges carry a dot or icon plus text. A user with any
  colour-vision deficiency, or a screen washed out by sun, gets the full meaning.
- **Contrast meets AA** on every surface, in both themes, validated against tokens — not
  approved by eye.
- **Everything is keyboard-operable** with a visible focus ring (`--ds-shadow-focus`, the
  3px ocean halo). All controls are native `button`/`input` elements or correctly
  ARIA-roled; nothing is a click-handler on a `div`.
- **Semantics are real.** Gauges (`role="img"` with a full `aria-label` like _"Dive quality
  score 72 out of 100 — Good"_), meters (`role="meter"`), and icon buttons all expose
  descriptive labels; decorative icons are `aria-hidden`.
- **Reduced motion is honoured** globally — a single `prefers-reduced-motion` block
  neutralises animation, and animated components (the score gauge) short-circuit to their
  final state.
- **Typography is large and touch targets are generous** (≥44px), which serves both
  accessibility and the wet-hands mobile baseline.

Accessibility is verified per-change, not audited once a year. A new interactive element
that is not keyboard-operable and screen-reader-labelled is an incomplete element.

---

## 14. Component architecture

### 14.1 Every component belongs to the system

There are no orphan components. A component is either a **design-system primitive**
(`src/components/ui/`, generic, reusable, documented at `/design`) or a **feature
component** (`src/components/`, composed from primitives, specific to one screen). There is
no third category, and a feature component MUST NOT reinvent a primitive's job with raw
markup and raw CSS.

### 14.2 Composition over configuration, up to a point

Prefer composing small primitives over a mega-component with thirty props. But a shared,
opinionated composite that encodes a product decision — `DiveScoreCard` folding verdict +
gauge + confidence + factor meters + best-window shortcut — is correct and desirable,
because it makes the _right_ layout the _easy_ layout. The line: compose primitives freely;
promote a composite to a named component the moment the same composition appears a second
time.

### 14.3 The component contract

Every component MUST:

- Have a typed props interface (`ComponentNameProps`) — see [§16](#16-typescript-standards).
- Style itself only through tokens, via a co-located CSS Module (`Component.module.css`).
- Be accessible by construction ([§13](#13-accessibility)) — the accessible version is the
  only version, not a follow-up.
- Own one responsibility. A component doing two jobs is two components.
- Be presentational where possible: data-fetching lives in hooks, not in leaf components
  (see [§15](#15-react-architecture)).

### 14.4 Extending, not forking

When a primitive doesn't fit, the options in order are: (1) use a prop that already exists;
(2) add a prop, update `/design` and the types; (3) if neither works, the primitive's
contract is wrong — change it deliberately with the design system's owner. Forking into
`ThingTwo` is never on this list.

---

## 15. React architecture

The frontend is **React 19** + **TypeScript** + **Vite 7**, a single-page app served
static. (Some older docs still say "React 18"; `package.json` is the source of truth and it
is 19.) The architecture rules:

### 15.1 Function components and hooks only

No class components. State and effects live in hooks. Shared stateful logic is extracted
into a **custom hook** in `src/hooks/` (the existing set: `useAuth`, `useConditions`,
`useDialog`, `useGeolocation`, `useMediaQuery`, `useOnlineStatus`, `useServiceStatus`).
When two components need the same stateful behaviour, that behaviour becomes a hook — it is
never copy-pasted.

### 15.2 Separate data, logic, and presentation

Three layers, kept distinct:

- **`src/lib/`** — pure, framework-free logic and IO. The visibility/score model
  (`diveScore.ts`, `visibility.ts`, `underwaterVisibility.ts`), unit math (`units.ts`),
  the API client (`api.ts`), caching (`cache.ts`), Supabase client (`supabase.ts`). Pure
  functions here are the most testable code in the app and MUST be unit-tested
  ([§23](#23-testing-standards)).
- **`src/hooks/`** — the bridge: hooks orchestrate `lib` calls, own component-facing state,
  and expose a clean interface to the view.
- **`src/components/`** — presentation. Components render props and state; they don't fetch
  and they don't compute the model. A component reaching directly into `fetch` or
  recomputing the score inline is a layering violation.

### 15.3 Effects are for synchronisation, not logic

`useEffect` synchronises React with something outside React (a subscription, the DOM, a
timer). It is not a place to run business logic or derive state that could be computed
during render. Derive during render; memoise (`useMemo`/`useCallback`) only when a real,
measured cost justifies it — premature memoisation is noise.

### 15.4 Keys, lists, and stability

List keys are stable domain identifiers (a spot id, a report id), never array indices.
Unstable keys cause subtle state bugs and janky animation — both of which violate the
motion and trust values.

### 15.5 Boundaries

The app root (`src/main.tsx` → `src/App.tsx`) owns the view switch and top-level error
boundaries. A thrown render error shows a designed error state ([§11](#11-empty-states-errors--loading)),
never a white screen. `src/main.tsx` also performs the clickjacking break-out — security
concerns live at the boundary, deliberately.

---

## 16. TypeScript standards

TypeScript is configured **strict** (`tsconfig.json`: `strict`, `noUnusedLocals`,
`noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`). These flags are
load-bearing; do not relax them to make an error go away.

- **`any` is banned** in application code. When a type is genuinely unknown at a boundary
  (an external API payload), type it `unknown` and narrow with a guard. `any` disables the
  one tool that catches the class of bug we most fear: a wrong number reaching a safety
  decision.
- **No non-null `!` assertions** to silence the compiler. If a value can be null, handle
  null. `!` is a promise to the compiler that you can't keep at 6am on a beach.
- **Model the domain with types, and make illegal states unrepresentable.** A verdict is a
  union (`'dive' | 'maybe' | 'skip'`), not a loose `string`. Discriminated unions for
  loading/loaded/error beat three booleans that can contradict each other.
- **Shared domain types live in `src/types/`.** API response shapes, the conditions model,
  and competition entities are defined once and imported, never redeclared per file. The
  API's response contract and these types must agree — see [§20](#20-api-design).
- **Exported functions have explicit return types.** Inference is fine for locals;
  public surfaces are documented by their signatures.
- **Prefer `type` for unions and shapes; `interface` for extensible object contracts.** Be
  consistent within a file. Name types in `PascalCase`; suffix component props `…Props`.
- **`readonly` and `as const`** for data that shouldn't mutate — especially token maps,
  config, and lookup tables.

The build gates on `tsc` (`npm run build` runs `tsc && vite build`); a type error is a
broken build, not a warning to defer.

---

## 17. State management

DepthViz uses **no global state-management library**, and this is a deliberate, defended
choice, not an omission. Adding Redux/Zustand/Jotai is an amendment ([§27](#27-amending-this-constitution))
requiring a demonstrated need the current model can't meet.

The model, from most-preferred to least:

1. **Server data is not application state.** Forecasts, reports and competition data are
   _cached server state_. They live behind hooks (`useConditions`) over the API client
   (`src/lib/api.ts`) with a TTL cache (`src/lib/cache.ts`). Do not copy server data into
   long-lived local state where it can go stale and disagree with the source — stale data
   presented as current is a trust violation.
2. **Local component state (`useState`/`useReducer`)** for anything a single component
   owns. Reach for `useReducer` when several pieces of state change together or when
   transitions have rules.
3. **Lift state to the nearest common ancestor** when siblings must share it. Lift only as
   far as needed — no further.
4. **Context** for genuinely cross-cutting, low-frequency concerns (auth session via
   `useAuth`, theme, dialogs via `useDialog`). Context is not a dumping ground for
   high-frequency state — it re-renders its whole subtree.
5. **`localStorage`** for the handful of things that must survive a reload (user-added map
   spots, votes, cookie consent, unit preference), accessed through a typed wrapper, never
   sprinkled `localStorage.getItem` calls.

**Optimistic UI** ([§11.3](#11-empty-states-errors--loading)) is the default for user
actions: update immediately, reconcile on response, roll back visibly on failure with a
non-blaming error. Auth state is the one true piece of global session state and flows from
`useAuth` — every API request attaches the Supabase `Authorization: Bearer <jwt>` from
there ([§20](#20-api-design)).

---

## 18. File & folder structure

The frontend layout is fixed; new files find their home by _kind_, then by _feature_:

```
src/
├── components/
│   ├── ui/            # design-system primitives (barrel-exported)
│   ├── admin/         # admin-only feature components
│   └── *.tsx          # feature components + co-located *.module.css
├── hooks/             # custom hooks (use*.ts)
├── lib/               # pure logic + IO + co-located *.test.ts
├── styles/            # tokens.css + global styles
├── types/             # shared domain types
├── workers/           # web workers (video/opencv/mp4 processing)
├── App.tsx            # stateful root + view switch
└── main.tsx           # entry: ReactDOM root, clickjacking break-out
```

Rules:

- **Co-locate.** A component's CSS Module (`Component.module.css`) and, where it has one,
  its test sit beside it. `src/lib/` co-locates `*.test.ts` next to the module it tests —
  this is the established pattern (`diveScore.ts` + `diveScore.test.ts`).
- **One primary export per file**, named to match the file.
- **The `ui/` barrel** (`src/components/ui/index.ts`) is the only import path for
  primitives.
- **Workers are isolated** in `src/workers/`; heavy CPU work (opencv, frame extraction)
  runs off the main thread so the UI stays responsive on mobile ([§22](#22-performance-budgets)).
- **No deep relative-import chains as architecture.** If `../../../` is common, the module
  is in the wrong place.

The backend mirror (`routers/` → `services/` → `models/`, plus `ml/`, `middleware/`,
`migrations/`) is documented in the companion; the shared principle is
**layer-by-responsibility**, imported one direction only (views/routers depend on
logic/services, never the reverse).

---

## 19. Naming conventions

Names are the cheapest documentation and the most-read code. The conventions:

- **Files:** components `PascalCase.tsx` with `PascalCase.module.css`; hooks
  `useThing.ts`; lib modules `camelCase.ts`; tests `<name>.test.ts` beside the source.
- **Components & types:** `PascalCase`. Props interfaces suffixed `Props`
  (`DiveScoreCardProps`).
- **Functions & variables:** `camelCase`, verbs for functions (`computeDiveScore`), nouns
  for values. Booleans read as predicates (`isOffline`, `hasReports`, `canDive`).
- **Hooks:** always `use`-prefixed; return a typed object with named fields, not a
  positional tuple beyond the React-idiomatic `[value, setValue]`.
- **Constants & tokens:** design tokens `--ds-*` in `kebab-case`; TS constants
  `SCREAMING_SNAKE_CASE` only for true module-level constants, otherwise `camelCase`.
- **Event handlers:** `handleX` for the implementation, `onX` for the prop
  (`onSelectSpot` prop → `handleSelectSpot` handler).
- **Say what it is, not what it's made of.** `DiveScore`, not `GreenGauge`. `Meter`, not
  `ProgressBarDiv`. A name that encodes today's styling lies the moment styling changes.
- **No abbreviations that aren't domain-standard.** `visibility`, not `vis`, in public
  APIs (the codebase's own domain shorthands like `vis` in internal chart helpers are
  tolerated where already established, but don't spread them to new public surfaces).

The API side uses `snake_case` for Python and JSON fields; the boundary between JSON
`snake_case` and TS `camelCase` is handled explicitly at the API client, not by scattering
both conventions through the app — see [§20](#20-api-design).

---

## 20. API design

The contract between `depthviz-frontend` and `depthviz-api` is a product surface and is
held to product standards. The backend's own internal rules live in the companion; this
chapter fixes the **contract** both repos must honour.

### 20.1 The client is the single door

Every call from the frontend to the backend goes through
[`src/lib/api.ts` → `apiFetch()`](../src/lib/api.ts). No component calls `fetch` to the API
directly. `apiFetch` owns: the base URL (`VITE_API_URL`, default `/api`), attaching
`Authorization: Bearer <jwt>` from the Supabase session, JSON handling, error normalisation,
and (where applicable) caching. This single door is what makes auth, error handling and
observability consistent — bypassing it re-introduces every bug it prevents.

(Two direct-to-third-party exceptions are deliberate and documented: Open-Meteo geocoding
for autocomplete, and Supabase for auth. Both are non-secret, and both are the exception
that proves the rule.)

### 20.2 REST conventions

- **Resources are nouns, plural** (`/reports`, `/locations`, `/competitions`). Verbs live
  in the HTTP method, not the path.
- **HTTP status codes are used honestly:** `200` success, `201` created, `400`
  client/validation error, `401` unauthenticated, `403` authorised-but-forbidden, `404`
  not found, `429` rate-limited (the API uses `slowapi`), `5xx` server fault. Never return
  `200` with an error body — that defeats every layer above.
- **Errors have a consistent, typed shape** the client can render into the error states of
  [§11](#11-empty-states-errors--loading). An error the frontend can't map to
  explain/fix/reassure is a contract defect.
- **Requests and responses are validated** — FastAPI + SQLModel/Pydantic on the server,
  typed at the client. The frontend never trusts a payload's shape blindly; the server
  never trusts an input's shape blindly.

### 20.3 The contract is versioned by agreement

Response shapes are mirrored by `src/types/`. A breaking change to a response is a breaking
change to the frontend and MUST be coordinated across both repos in lockstep — the two
branches move together. Additive changes (new optional fields) are safe; renaming or
removing a field the client reads is not, and is never merged one-sided.

### 20.4 Fast, cacheable, honest

- The API sends real `Cache-Control` headers (there is `Cache-Control` middleware);
  the client caches with TTL (`src/lib/cache.ts`). Cache windows reflect how fast the
  underlying data actually changes — a 14-day forecast is not cached like a live report.
- Payloads carry what the decision needs, not the whole database row. Over-fetching is a
  performance _and_ a clarity cost.
- Timestamps are ISO-8601 UTC; the client formats to local for humans. Units in payloads
  are explicit and documented; the client converts for display via `units.ts`.

---

## 21. AI integration guidelines

DepthViz uses ML/AI in two places: the internal visibility/bias/calibration/trust models
(backend `ml/`), and generative analysis (the backend depends on `anthropic`). Both are
governed by one overriding rule, inherited from the safety corollary
([§1](#1-philosophy)): **AI increases confidence honestly, or it doesn't ship.**

- **Explain the AI; never present it as an oracle.** Predictions, scores and AI-written
  explanations always show their basis. The Dive Quality Score decomposes into its drivers
  ([`diveScore.ts`](../src/lib/diveScore.ts)); an AI-generated report summary says what it's
  built from. A number with no visible reasoning is not shippable in a safety product.
- **Show uncertainty as a first-class output.** Confidence (report count, forecast age,
  volatility) sits beside every score. When the model is unsure, the UI says so plainly —
  it does not round up to a confident green.
- **Human/community truth stays in the loop.** Diver reports bias-correct the model and are
  surfaced alongside it. Where the model and reports disagree, that disagreement is shown,
  not hidden — it is exactly the safety signal a diver needs.
- **Generative output is bounded and attributed.** AI-written copy follows the voice of
  [§10](#10-copywriting--tone), is clearly the product speaking (not a fake human), never
  invents data it doesn't have, and never states a safety fact it can't ground. AI never
  silently overrides a measured value or a safety flag.
- **AI is a means, not a feature.** Per [§25's](#24-feature-acceptance-criteria) acceptance
  test: AI earns its place only by improving a decision, reducing friction, or increasing
  trust. "It uses AI" is not a reason to ship anything.
- **Costs, prompts and models are managed on the backend**, never exposed to the client;
  secrets never reach the browser. Prompt and model changes are reviewed like code because
  they change product behaviour.

---

## 22. Performance budgets

Performance is a decision-latency feature, measured against the wet-hands, weak-signal
baseline ([§12](#12-mobile-interaction-patterns)). Budgets, not vibes:

- **Time-to-decision < 5s** on a mid-range phone over a 3G-class connection, cold — the
  verdict must be readable within it. This is the [§1](#1-philosophy) five-second test made
  measurable and it is the budget every other one serves.
- **Largest Contentful Paint** (the decision content) target **< 2.5s** on that same
  baseline.
- **Interaction latency < 100ms** for taps and toggles; anything slower gets an optimistic
  update or a skeleton so it never _feels_ slow.
- **JavaScript is shipped deliberately.** Heavy, optional dependencies (Leaflet/maps,
  opencv, mp4box, qrcode) are **lazy-loaded / code-split**, never in the initial bundle
  that stands between the user and the verdict. The map does not delay "can I dive?".
- **Main thread stays free.** CPU-heavy work (video validation, frame extraction, opencv)
  runs in `src/workers/`, off the main thread, so scroll and tap stay smooth.
- **Images and tiles are lazy and right-sized.** Satellite imagery and map tiles load on
  demand with skeletons; nothing full-resolution loads above the fold that isn't the
  decision.
- **Caching is layered** (client TTL + HTTP `Cache-Control`) so a returning user gets an
  instant last-known answer and the network refines it.

A change that regresses a budget is treated like a failing test: it's a defect, and the PR
says how the budget was checked ([§24](#24-feature-acceptance-criteria)).

---

## 23. Testing standards

Tests exist to protect the decision. The closer code sits to the verdict a diver acts on,
the more thoroughly it is tested. Confidence-critical logic without tests is not "done."

- **Pure logic MUST be unit-tested.** Everything in `src/lib/` that computes something a
  user trusts — `diveScore`, `visibility`/`underwaterVisibility`, `units`, `visTrend`,
  `weightCalc`, `entryFee`, `diveRating` — has co-located `*.test.ts` and is tested at its
  edges and anchor points, not just the happy path. The score curves are calibrated for
  NE-UK; tests pin that calibration so a refactor can't silently move a verdict.
- **Test behaviour, not implementation.** Assert on the output a user would see (the
  verdict, the formatted value), not on internal call order. Tests that break on every
  refactor are testing the wrong thing.
- **The runner is Vitest** (`npm test` → `vitest run`); tests run in CI on every PR.
- **Edge cases are the point.** Zero reports, stale forecast, extreme sea state, unit
  boundaries, offline. A safety product is defined by how it behaves at the edges, so
  that's where the tests concentrate.
- **A bug fix ships with the test that would have caught it.** Regression tests are how the
  edge cases we _didn't_ imagine become ones we did.
- **The build gates the merge.** `tsc` (types) + `vitest` (behaviour) both pass before
  merge; a red pipeline is never merged green by hand.

Backend testing (pytest, the extensive `tests/` suite, migration tests, security tests) is
governed by the companion; the shared standard is _the decision-critical path is
covered, and a fix carries its regression test._

---

## 24. Feature acceptance criteria

Before any feature is considered done — and ideally before it is started — it must pass
**all four** gate questions. If it fails one, it is reshaped or rejected, never shipped
anyway:

1. **Does it improve a diver's decision?** (If not, it's noise — [§1](#1-philosophy).)
2. **Does it reduce friction?** (Or at least not add any.)
3. **Does it increase trust?** (Or at least not spend it.)
4. **Does it simplify something?** (Net complexity should fall, or buy a lot.)

Beyond the gate, a feature is **Done** only when:

- It answers its screen's core decision within five seconds ([§1](#1-philosophy)).
- It follows the information hierarchy ([§5](#5-information-hierarchy)) and its domain
  answer-order ([§9](#9-domain-screens)).
- It is built from design-system primitives and tokens only ([§6](#6-the-design-system),
  [§7](#7-design-tokens)) — no new one-off component, no raw values.
- It has empty, error, and loading states ([§11](#11-empty-states-errors--loading)) — all
  three, designed, not defaulted.
- It meets WCAG AA and the mobile baseline ([§12](#12-mobile-interaction-patterns),
  [§13](#13-accessibility)).
- Its decision-critical logic is typed and unit-tested ([§16](#16-typescript-standards),
  [§23](#23-testing-standards)).
- It stays within performance budgets ([§22](#22-performance-budgets)), and the PR says how
  that was verified.
- Its copy matches the voice ([§10](#10-copywriting--tone)).
- Its PR names the product value(s) it advances ([§2](#2-product-values)).

"It works on my machine in the happy path" is not Done. Done is this list.

---

## 25. Git workflow

Both repos share one workflow, tuned to their automated release pipeline.

- **Trunk-based with short-lived branches.** `main` is always releasable. Work happens on
  feature branches (the `claude/...` convention for agent-authored work), merged via PR.
  No long-running divergent branches.
- **Conventional Commits, scoped.** Commit subjects follow
  `type(scope): summary` — e.g. `feat(forecast): …`, `fix(units): …`,
  `refactor(home): …`, `chore(release): …`. This is not cosmetic: **semantic-release**
  (`.releaserc.json` on the frontend, `pyproject.toml` `[tool.semantic_release]` on the
  API) reads these to compute the next version and generate the `CHANGELOG.md`. A
  wrong-typed commit ships the wrong version. `feat` → minor, `fix` → patch, a `!` or
  `BREAKING CHANGE:` footer → major.
- **Types:** `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `ci`, `style`.
  Scope is the area touched (`forecast`, `competition`, `design`, `units`, `api`, …).
- **Small, reviewable PRs.** One coherent change per PR. A PR mixing a refactor, a feature
  and a format-sweep is three PRs. The description names the product value(s)
  ([§2](#2-product-values)) and how acceptance ([§24](#24-feature-acceptance-criteria)) was
  met — check the repo's PR template and fill its sections.
- **Green before merge.** CI (`.github/workflows/ci.yml`) — types, lint/ruff, tests — must
  pass. `deploy.yml` ships from `main`. Never merge red; never hand-bump a version that
  `chore(release)` owns.
- **Cross-repo changes move together.** A contract change ([§20](#20-api-design)) lands as
  coordinated PRs in both repos, not one side at a time.
- **History is honest.** Commit messages say what changed and why; the CHANGELOG is
  generated, so the commit _is_ the record.

---

## 26. Technical-debt rules

Debt is a tool, not a sin — but an _acknowledged_ tool. The rules keep it from
compounding into the thing this constitution exists to prevent: screens nobody trusts.

- **Debt is named, not hidden.** A deliberate shortcut gets a `// TODO(context):` or an
  issue explaining what's owed and why. Silent debt is the expensive kind.
- **Never let debt touch a safety path unremarked.** A shortcut in `diveScore`, in a
  confidence signal, or in a safety flag is not routine debt — it's a defect until proven
  otherwise, because it can quietly move a verdict a diver acts on.
- **The additive-token strategy is the model.** The design system rolled out `--ds-*`
  additively over the legacy theme, screen by screen, instead of a big-bang rewrite. That
  is the sanctioned way to pay down debt: incremental, non-breaking, each step shipping
  value and de-risking the next.
- **Leave it better.** Touch a file, and you may bring its small stuff up to current
  standard (tokens, types, naming) — but keep _that_ cleanup out of a feature PR if it
  would obscure the feature's diff. Big refactors are their own PRs with their own tests.
- **Prefer deletion.** The cheapest, most reliable code is the code that isn't there. An
  unused component, a dead flag, a superseded helper — delete it. Every line removed is a
  line that can't rot.
- **Debt has a ceiling.** When a module's shortcuts start causing bugs or slowing every
  change through it, paying it down becomes the priority, not a someday. The signal is
  concrete: repeated fixes in the same place ([§23](#23-testing-standards) regressions
  clustering) means the debt, not the symptom, is the bug.

---

## 27. Amending this constitution

This document governs the product, but it is not frozen. It changes the way the product
changes: **deliberately, in the open, with a reason.**

- **This file is the master.** The backend companion
  (`depthviz-api/docs/CONSTITUTION.md`) refines it for the API and never contradicts it;
  `/design` is its code-backed component reference. Where they disagree, this file wins and
  the others are corrected.
- **An amendment is a PR** against this file, following [§25](#25-git-workflow), that says
  what rule changes, why, and which product value ([§2](#2-product-values)) the change
  serves. Adding a design token, a new global dependency, a state-management library, or a
  new component category are all amendments — the kinds of decisions that, made casually
  and repeatedly, are exactly how a product loses the coherence this document protects.
- **The five-second test is the tie-breaker.** When a proposed rule and an existing one
  genuinely conflict and the chapter order doesn't settle it, choose whichever better lets
  a real diver, on a real beach, answer their decision in five seconds with justified
  confidence. That is the whole product, compressed to one sentence.

---

## Appendix A — The pre-merge checklist

A single consolidated gate. Before any frontend change merges, its author has confirmed —
and the PR description reflects — each of these. This is [§24](#24-feature-acceptance-criteria)
in one scannable list; if a line can't be ticked, the change isn't done.

**Product & decision**

- [ ] The screen answers its core decision within five seconds ([§1](#1-philosophy)).
- [ ] The change advances at least one named product value ([§2](#2-product-values)) and
      regresses none.
- [ ] Content follows the universal spine and the screen's domain answer-order
      ([§5](#5-information-hierarchy), [§9](#9-domain-screens)).
- [ ] No safety-relevant caveat has been pushed behind disclosure ([§1](#1-philosophy),
      [§3.2](#3-ux-principles)).

**Design system**

- [ ] Built only from `ui/` primitives — no new one-off component, no fork
      ([§6](#6-the-design-system), [§14](#14-component-architecture)).
- [ ] No raw values in CSS — every colour, space, radius, shadow, duration and type step is
      a `--ds-*` token ([§7](#7-design-tokens)).
- [ ] Motion is inside the 150–300ms band, eased, no bounce/overshoot, and collapses under
      `prefers-reduced-motion` ([§6.5](#6-the-design-system)).

**States & copy**

- [ ] Empty, error and loading states all exist and are designed, not defaulted
      ([§11](#11-empty-states-errors--loading)).
- [ ] Copy matches the voice, blames no one, and states uncertainty honestly
      ([§10](#10-copywriting--tone)).

**Accessibility & mobile**

- [ ] Meets WCAG 2.2 AA: colour never alone, AA contrast in both themes, keyboard-operable
      with a visible focus ring, real semantics/labels ([§13](#13-accessibility)).
- [ ] Works under the wet-hands baseline: ≥44px targets, thumb-reachable actions, no
      accidental horizontal scroll ([§12](#12-mobile-interaction-patterns)).

**Engineering**

- [ ] Data/logic/presentation stay in their layers (`lib` → `hooks` → `components`)
      ([§15](#15-react-architecture)).
- [ ] Strict TypeScript, no `any`, no `!` to silence the compiler; illegal states
      unrepresentable ([§16](#16-typescript-standards)).
- [ ] Server data is treated as cached server state, not copied into stale local state
      ([§17](#17-state-management)).
- [ ] Decision-critical logic in `lib/` has co-located unit tests at its edges; a fix
      carries its regression test ([§23](#23-testing-standards)).
- [ ] Stays within performance budgets, and the PR says how that was checked
      ([§22](#22-performance-budgets)).
- [ ] Any API-contract change is coordinated with the paired backend branch
      ([§20](#20-api-design)).
- [ ] `tsc` + `vitest` green; commit is Conventionally typed and scoped
      ([§25](#25-git-workflow)).

---

## Appendix B — Do / don't quick reference

Concrete pairs for the mistakes that recur. The principle each enforces is in brackets.

**Tokens, not raw values** ([§7](#7-design-tokens))

```css
/* ✗ */ .tile { color: #f2f7fa; margin: 20px; border-radius: 10px; }
/* ✓ */ .tile { color: var(--ds-text-strong); margin: var(--ds-space-3); border-radius: var(--ds-radius-lg); }
```

**Extend, don't fork** ([§6.1](#6-the-design-system), [§14.4](#14-component-architecture))

```tsx
/* ✗ */ function ForecastCardLarge() { /* copy of Card with tweaks */ }
/* ✓ */ <Card elevation="floating" accent="quality">…</Card>
```

**Model illegal states away** ([§16](#16-typescript-standards))

```ts
/* ✗ */ interface View { isLoading: boolean; isError: boolean; data?: Forecast }
/* ✓ */ type View =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: Forecast };
```

**Narrow `unknown`, never reach for `any`** ([§16](#16-typescript-standards))

```ts
/* ✗ */ const score = (payload as any).score;
/* ✓ */ if (isForecastPayload(payload)) { const score = payload.score; }
```

**Fetch through the one door** ([§20.1](#20-api-design))

```ts
/* ✗ */ const r = await fetch(`${base}/reports`, { headers: { Authorization: token } });
/* ✓ */ const reports = await apiFetch('/reports'); // owns base URL, auth, errors, cache
```

**Derive during render; effects only synchronise** ([§15.3](#15-react-architecture))

```tsx
/* ✗ */ useEffect(() => { setVerdict(computeVerdict(score)); }, [score]);
/* ✓ */ const verdict = computeVerdict(score); // pure, no effect needed
```

**Stable keys, never indices** ([§15.4](#15-react-architecture))

```tsx
/* ✗ */ reports.map((r, i) => <ReportRow key={i} report={r} />)
/* ✓ */ reports.map((r) => <ReportRow key={r.id} report={r} />)
```

**Empty state that guides** ([§11.1](#11-empty-states-errors--loading))

```tsx
/* ✗ */ <p>No data.</p>
/* ✓ */ <EmptyState title="No reports here today"
          body="Be the first diver to help your local community."
          action={{ label: 'Add a report', onAdd }} />
```

**Reduce thinking — compute for the user** ([§3.4](#3-ux-principles))

```tsx
/* ✗ */ <span>{today} m</span> … <span>{yesterday} m</span>   /* user does the subtraction */
/* ✓ */ <Delta from={yesterday} to={today} unit="m" />        /* we show +1.5 m ▲ */
```

---

## Appendix C — Glossary

Shared vocabulary. Using these terms precisely is part of the **consistency** value — the
same idea should have the same name in code, in copy, and in conversation.

- **Core decision** — the single question a screen exists to answer (see the table in
  [§1](#1-philosophy)). Every screen has exactly one.
- **The five-second test** — a screen must let a first-time user, on a mid-range phone, in
  sunlight, over a weak signal, answer its core decision within five seconds. The product's
  primary acceptance criterion ([§1](#1-philosophy), [§22](#22-performance-budgets)).
- **Dive Quality Score** — the signature 0–100 number that folds visibility, sea state,
  wind, rain and algae into one confident, explainable answer
  ([`diveScore.ts`](../src/lib/diveScore.ts)).
- **Verdict** — the plain-English `Yes — dive / Maybe / Not today` answer paired with the
  score. Always leads; never follows the data.
- **Confidence** — how much to trust the score, computed from report count, forecast age
  and volatility. A first-class output, shown beside every score ([§21](#21-ai-integration-guidelines)).
- **Quality scale** — the six luminance-stepped steps (`--ds-q-excellent … --ds-q-blown`)
  that encode conditions in colour, always paired with a label or glyph
  ([§6.4](#6-the-design-system)).
- **Decision-first** — the inviolable ordering answer → explanation → data
  ([§3.1](#3-ux-principles)).
- **Progressive disclosure** — detail is opt-in behind honest `aria-expanded` controls;
  the first screen answers the question ([§3.2](#3-ux-principles)). Never applied to safety
  caveats.
- **Primitive** — a design-system component in `src/components/ui/`, generic and documented
  at `/design`. The only vocabulary the UI speaks ([§6.1](#6-the-design-system)).
- **The one door** — `src/lib/api.ts → apiFetch()`, the single path from frontend to
  backend that owns auth, errors and caching ([§20.1](#20-api-design)).
- **Community truth** — diver reports that bias-correct the model and are surfaced
  alongside it; where model and reports disagree, the disagreement is shown
  ([§9.4](#9-domain-screens), [§21](#21-ai-integration-guidelines)).
- **The wet-hands baseline** — the assumed operating conditions (wet hands, sunlight, poor
  signal, one thumb) every interaction must survive ([§12](#12-mobile-interaction-patterns)).
- **Amendment** — a deliberate change to a governed rule (a new token, dependency, component
  category or state library), made as a reasoned PR against this document
  ([§27](#27-amending-this-constitution)).

---

## Appendix D — Worked example: adding a "best tide window" card

The constitution is easiest to internalise by watching it decide a real feature. Suppose we
want to help a diver pick _when_ in the day to dive a chosen spot, using tide state. Here is
the whole document applied, in order.

**1 — Is it allowed to exist?** Run the four gate questions ([§24](#24-feature-acceptance-criteria)):
does it improve the decision (yes — _when_ to dive is part of _should I dive_), reduce
friction (yes — it removes mental tide-table math, [§3.4](#3-ux-principles)), increase trust
(yes, if we show the "why"), and simplify (yes — one card replaces the user cross-referencing
a tide chart). It passes. If it had only added a graph the user must interpret, we'd reject
it.

**2 — What's the core decision, and where does it sit?** The card's one question is _"when's
the best window today?"_ — a refinement of the forecast's _"can I dive?"_ It is **supporting
information** in the spine ([§5](#5-information-hierarchy)), so it lives below the verdict and
score, not above them ([§3.1](#3-ux-principles), [§9.1](#9-domain-screens)). It never
outranks the go/no-go answer.

**3 — Decision-first inside the card.** Lead with the answer — _"Best window: 2–4pm, slack
tide"_ — then the because-clause — _"least tidal flow, so the water settles"_ — then, behind
disclosure, the raw tide curve ([§3.1](#3-ux-principles), [§10](#10-copywriting--tone)). One
card, one question ([§6.2](#6-the-design-system)).

**4 — Build it from primitives.** It's a `Card` with a `SectionHeader`, a `StatTile` for the
window, and the tide curve as a chart on the chart tokens — no `TideWindowCardNew`
([§6.1](#6-the-design-system), [§14](#14-component-architecture)). Colour uses the quality
scale, always paired with a label; the chart marks "now" and keeps ~4 axis labels
([§8](#8-data-visualisation-principles)). Every space/radius/colour is a `--ds-*` token
([§7](#7-design-tokens)).

**5 — Layer the code.** The slack-tide math is a pure function in `src/lib/` (call it
`bestTideWindow.ts`) with a co-located `bestTideWindow.test.ts` pinning the edges — spring vs
neap, no-tide-data, windows that straddle midnight ([§15.2](#15-react-architecture),
[§23](#23-testing-standards)). A hook (or the existing `useConditions`) orchestrates it; the
card is presentational and computes nothing ([§15](#15-react-architecture)). Types are
strict: the window is a typed shape, missing data is `null` handled honestly, no `any`
([§16](#16-typescript-standards)).

**6 — Data.** Tide data comes through `apiFetch` — the one door ([§20.1](#20-api-design)) — as
cached server state, not copied into stale local state ([§17](#17-state-management)). If the
API needs a new field, it's an additive contract change coordinated with the backend branch
([§20.3](#20-api-design)).

**7 — The three states.** Loading shows a `Skeleton` shaped like the card, not a spinner.
Empty ("no tide data for this spot yet") explains and points somewhere. Error
(explain/fix/reassure) distinguishes offline from a service gap ([§11](#11-empty-states-errors--loading)).

**8 — Accessibility & mobile.** The disclosure is an `aria-expanded` button; the chart has a
text alternative; contrast passes AA in both themes; the whole thing is keyboard-operable and
its targets are ≥44px for wet hands in sunlight ([§12](#12-mobile-interaction-patterns),
[§13](#13-accessibility)).

**9 — Budget & ship.** The tide curve lazy-loads so it never delays the verdict
([§22](#22-performance-budgets)). The PR names the value it advances (**speed** — faster
time-to-decision; **clarity**), fills the template, ticks Appendix A, and commits
`feat(forecast): best tide-window card` so semantic-release versions it correctly
([§25](#25-git-workflow)).

Notice what never came up: a new colour, a bespoke component, a graph the user has to decode,
a number without a "why", or a decision the card made harder. That absence _is_ the
constitution working.

---

## The final standard

Every screen should feel like it belongs in the same application. Every interaction should
feel intentional. Every animation should communicate. Every colour should have meaning.
Every graph should answer a question. Every page should reduce uncertainty. Every endpoint
should tell the truth about what it knows. And every user should close the app **more
confident than when they opened it** — and safer for having done so.

That is the entire job. Everything above is just how we keep doing it on purpose.
