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

/**
 * Map a 0–1 impact ratio (penalty ÷ max penalty) to a severity token — the
 * shared colour for factor/meter fills. Thresholds match the legacy bar logic
 * so this is a pure colour-source swap, not a behaviour change.
 */
export function impactToken(ratio: number): string {
  // Defensive: a non-finite ratio (e.g. a zero-max factor divided through)
  // must not fall through to the high-severity band and cry wolf.
  if (!Number.isFinite(ratio) || ratio <= 0) return SEVERITY_TOKEN.safe
  if (ratio < 0.4) return SEVERITY_TOKEN.low
  if (ratio < 0.75) return SEVERITY_TOKEN.moderate
  return SEVERITY_TOKEN.high
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
