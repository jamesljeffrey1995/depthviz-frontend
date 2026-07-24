/**
 * Water-clarity ramp — colour maths and the invariants the ramp must hold.
 *
 * `--sev-*` in `index.css` is the six-step scale that grades *dive conditions*
 * (see `severity.ts` for why it is kept separate from the alert/status ramp).
 * Five of those steps — poor → excellent — are a magnitude scale: they encode
 * how clear the water is. A magnitude scale has to survive being read by
 * someone with a colour-vision deficiency and, equivalently, has to survive
 * being desaturated: if the ramp only varies in hue, a red→green "bad to good"
 * scale is unreadable for roughly 1 in 14 men, and unreadable for everyone in
 * a screenshot printed in mono.
 *
 * The practical test is that the steps climb monotonically in *relative
 * luminance*, with enough separation between them to stay distinguishable
 * without hue. This module supplies the maths; `conditionRamp.test.ts` reads
 * the shipped CSS and enforces it, so the ramp can't silently regress back
 * into a traffic light.
 *
 * `blocked` is deliberately excluded from the ordering. Per DESIGN.md it stays
 * a neutral grey so a *safety* state is never mistaken for a clarity step, and
 * it always ships with the "STAY ASHORE" label and an alert glyph (see
 * `getVerdict` in `visibility.ts`), so it does not rely on colour at all.
 */

/** The five clarity steps, murkiest → clearest. `blocked` is not one of them. */
export const CLARITY_STEPS = ['poor', 'marginal', 'decent', 'good', 'excellent'] as const

export type ClarityStep = (typeof CLARITY_STEPS)[number]

/**
 * Dark surfaces the ramp is rendered as text on, per register. The chassis
 * register (`--sev-*`) sits on the app's ordinary panels; the face register
 * (`--sev-*-face`) sits on the denser instrument-face panels. A step has to
 * clear WCAG AA against *every* surface in its own register — the tightest
 * one sets the floor, which is why the murky end of the ramp cannot be as
 * dark as murky water actually is.
 */
export const CHASSIS_SURFACES = ['#06121b', '#0a1b27', '#030b11'] as const
export const FACE_SURFACES = ['#0b1622', '#142334'] as const

/** WCAG AA for normal-size text. The ramp is used on values as small as 12px. */
export const AA_CONTRAST = 4.5

/**
 * Minimum luminance gap between adjacent steps. Below roughly 0.1 two steps
 * become the same grey once hue is removed, which is the failure this whole
 * module exists to prevent; 0.1 leaves headroom for the ~0.14 the shipped
 * ramp actually achieves.
 */
export const MIN_STEP_SEPARATION = 0.1

/** Expand `#abc` / `#aabbcc` to three 0–1 channel values. */
function channels(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/, '')
  const full = raw.length === 3 ? raw.replace(/./g, c => c + c) : raw
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex colour: ${hex}`)
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** sRGB companding — the inverse of the display gamma curve. */
function linearise(value: number): number {
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
}

/**
 * WCAG relative luminance (0 = black, 1 = white). This is the number a colour
 * collapses to when you desaturate it, so it is exactly the quantity the
 * "screenshot it and drop saturation to zero" test is measuring by eye.
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linearise) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colours, 1:1 (identical) to 21:1. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (lighter! + 0.05) / (darker! + 0.05)
}

/**
 * How far a colour sits from neutral grey, as the spread across its channels
 * (0 = perfectly neutral, 1 = fully saturated primary). Used to assert that
 * `blocked` really is the neutral DESIGN.md says it is.
 */
export function chroma(hex: string): number {
  const [r, g, b] = channels(hex)
  return Math.max(r!, g!, b!) - Math.min(r!, g!, b!)
}
