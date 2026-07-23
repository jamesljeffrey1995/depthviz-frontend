/**
 * Alert-severity → design-token map: the single source of truth for grading
 * *risk* colour across the location page — algae bloom, turbidity, seabed
 * resuspension, river discharge and the temperature/humidity advisories.
 *
 * These are genuine alert semantics, so they ride the DS status ramp
 * (`success → warn → caution → danger`), never the water-clarity quality ramp
 * (`--ds-q-*`), which grades dive conditions rather than warnings. Keeping the
 * two ramps separate is deliberate: a murky-but-safe day and a hazardous day
 * must not read in the same language.
 *
 * Colour is never the only signal — every consumer pairs these tokens with a
 * text label ("MODERATE", "HIGH") and, in meters, a fill length. The values are
 * `var(--ds-*)` references (not literals) so a single theme switch retunes them
 * everywhere and no component reintroduces an invented hex.
 */

export type Severity = 'safe' | 'low' | 'moderate' | 'high'

/** The four-step status ramp, as token references usable in any CSS context. */
export const SEVERITY_TOKEN: Record<Severity, string> = {
  safe: 'var(--ds-success)',
  low: 'var(--ds-warn)',
  moderate: 'var(--ds-caution)',
  high: 'var(--ds-danger)',
}

/** The four impact bands a 0–1 ratio falls into, low → high. */
export type ImpactBand = 'none' | 'low' | 'moderate' | 'high'

/**
 * Classify a 0–1 impact ratio (penalty ÷ max penalty) into a band — the single
 * source of the threshold boundaries every ratio → colour mapping shares, so the
 * status ramp (alert text) and the clarity ramp (meter fill) can never drift
 * apart. Defensive: a non-finite ratio (e.g. a zero-max factor divided through)
 * must not fall through to the high band and cry wolf.
 */
export function impactBand(ratio: number): ImpactBand {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'none'
  if (ratio < 0.4) return 'low'
  if (ratio < 0.75) return 'moderate'
  return 'high'
}

/** Band → status token, for grading *alert* colour (algae, turbidity, …). */
const BAND_STATUS: Record<ImpactBand, Severity> = {
  none: 'safe',
  low: 'low',
  moderate: 'moderate',
  high: 'high',
}

/**
 * Band → six-step clarity token, for a factor/meter *fill*. A distinct ramp
 * from the status one on purpose: a murky-but-safe day and a hazardous day
 * must not read in the same language.
 */
const BAND_CLARITY: Record<ImpactBand, string> = {
  none: 'var(--sev-good)',
  low: 'var(--sev-decent)',
  moderate: 'var(--sev-marginal)',
  high: 'var(--sev-poor)',
}

/**
 * Map a 0–1 impact ratio to a status token — the shared colour for factor/meter
 * *alert text*. Thresholds live in `impactBand`, so this is a pure band → token
 * lookup, not a behaviour change.
 */
export function impactToken(ratio: number): string {
  return SEVERITY_TOKEN[BAND_STATUS[impactBand(ratio)]]
}

/**
 * Map a 0–1 impact ratio to a step on the six-step clarity ramp (`--sev-*`) —
 * the *fill* colour for factor/meter bars. Shares `impactBand`'s thresholds
 * with `impactToken` but rides the clarity ramp rather than the status ramp,
 * so the two never drift.
 */
export function clarityFillToken(ratio: number): string {
  return BAND_CLARITY[impactBand(ratio)]
}

/** Map a named risk level (`none` | `low` | `moderate` | `high`) to a token. */
export function riskToken(level: string): string {
  switch (level) {
    case 'high': return SEVERITY_TOKEN.high
    case 'moderate': return SEVERITY_TOKEN.moderate
    case 'low': return SEVERITY_TOKEN.low
    case 'none': return SEVERITY_TOKEN.safe
    default: return SEVERITY_TOKEN.safe
  }
}
