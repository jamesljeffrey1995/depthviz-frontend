/* ============================================================================
   Dive Quality Score
   ----------------------------------------------------------------------------
   Collapses the forecast into a single 0–100 number that answers the user's
   first question — "should I dive here today?" — and, crucially, explains
   itself. The score is a weighted blend of environmental sub-scores, each of
   which is surfaced back to the user as a factor row so the number is never a
   black box.

   Visibility dominates (it is what a diver ultimately cares about), while sea
   state, wind, rainfall and algae temper it and, more importantly, explain
   *why* a day is good or poor. Thresholds are calibrated for North-East UK
   spearfishing / freediving, consistent with getDiveRating().
   ========================================================================== */

import type { DayForecast } from '../types'
import { visForDay } from './visTrend'
import { feetToMetres, type Units } from './units'

export type ScoreImpact = 'positive' | 'neutral' | 'negative'

export interface ScoreFactor {
  key: 'visibility' | 'seaState' | 'wind' | 'rain' | 'algae'
  label: string
  /** Human-readable measured value, e.g. "3.2 m", "12 kn", "Low". */
  valueLabel: string
  /** 0–100 sub-score for this factor. */
  sub: number
  /** Relative weight this factor carries in the blended score (0–1). */
  weight: number
  impact: ScoreImpact
  /** One-line plain-English note on how this factor is affecting the dive. */
  note: string
}

export type ScoreAnswer = 'go' | 'maybe' | 'skip'

export interface ScoreBand {
  key: 'blown' | 'poor' | 'marginal' | 'fair' | 'good' | 'excellent'
  label: string
  color: string
  answer: ScoreAnswer
  /** Short imperative headline shown next to the score. */
  headline: string
}

export interface DiveScore {
  /** 0–100, rounded. */
  score: number
  band: ScoreBand
  answer: ScoreAnswer
  /** The single strongest reason the score is what it is (best/worst factor). */
  keyDriver: ScoreFactor
  factors: ScoreFactor[]
}

/* ── Weights (sum to 1.0; normalised defensively at blend time) ─────────── */
const WEIGHTS = {
  visibility: 0.6,
  seaState: 0.16,
  wind: 0.12,
  rain: 0.07,
  algae: 0.05,
} as const

/* ── Sub-score curves ────────────────────────────────────────────────────
   Each is a monotonic piecewise-linear interpolation over calibrated anchor
   points, so the mapping is transparent and easy to re-tune. */

interface Anchor { x: number; y: number }

function interpolate(x: number, anchors: Anchor[]): number {
  if (!Number.isFinite(x)) return 0
  const first = anchors[0]
  if (!first) return 0
  if (x <= first.x) return first.y
  const last = anchors[anchors.length - 1]
  if (!last) return 0
  if (x >= last.x) return last.y
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    if (!a || !b) continue
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x)
      return a.y + t * (b.y - a.y)
    }
  }
  return last.y
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

/** Visibility (metres) → sub-score. Anchored to the NE-UK rating buckets. */
export function visibilitySub(visM: number): number {
  return clamp(interpolate(visM, [
    { x: 0, y: 0 },
    { x: 1, y: 14 },
    { x: 2, y: 34 },
    { x: 3, y: 52 },
    { x: 4, y: 68 },
    { x: 6, y: 87 },
    { x: 8, y: 96 },
    { x: 12, y: 100 },
  ]))
}

/** Dominant wave/swell height (metres) → sub-score. Calm water = clear water. */
export function seaStateSub(waveM: number): number {
  return clamp(interpolate(waveM, [
    { x: 0.0, y: 100 },
    { x: 0.3, y: 96 },
    { x: 0.5, y: 86 },
    { x: 1.0, y: 60 },
    { x: 1.5, y: 38 },
    { x: 2.0, y: 20 },
    { x: 3.0, y: 6 },
  ]))
}

/** Wind speed (knots) → sub-score. Wind builds chop and stirs the surface. */
export function windSub(knots: number): number {
  return clamp(interpolate(knots, [
    { x: 0, y: 100 },
    { x: 5, y: 96 },
    { x: 10, y: 78 },
    { x: 15, y: 55 },
    { x: 20, y: 32 },
    { x: 25, y: 15 },
    { x: 30, y: 5 },
  ]))
}

/** Rainfall (mm/h) → sub-score. Runoff pushes sediment and freshwater inshore. */
export function rainSub(mmPerH: number): number {
  return clamp(interpolate(mmPerH, [
    { x: 0, y: 100 },
    { x: 0.5, y: 85 },
    { x: 1, y: 70 },
    { x: 2, y: 50 },
    { x: 4, y: 25 },
    { x: 6, y: 8 },
  ]))
}

/** Algae bloom risk → sub-score. */
export function algaeSub(risk: 'low' | 'moderate' | 'high'): number {
  return risk === 'high' ? 25 : risk === 'moderate' ? 60 : 100
}

function impactOf(sub: number): ScoreImpact {
  if (sub >= 70) return 'positive'
  if (sub >= 40) return 'neutral'
  return 'negative'
}

/* ── Score bands ─────────────────────────────────────────────────────────
   Colours reference the water-clarity dive-quality tokens (--ds-q-*) directly:
   murky slate for blown-out water climbing to gin-clear aquamarine, never a
   red–amber–green traffic light. Referencing the tokens (rather than copying
   their hexes) keeps the signature score gauge in sync with the theme and
   removes a second source of truth. */
const BANDS: ScoreBand[] = [
  { key: 'excellent', label: 'Excellent', color: 'var(--ds-q-excellent)', answer: 'go',    headline: 'Prime conditions — go' },
  { key: 'good',      label: 'Good',      color: 'var(--ds-q-good)',      answer: 'go',    headline: 'A good day to dive' },
  { key: 'fair',      label: 'Fair',      color: 'var(--ds-q-workable)',  answer: 'maybe', headline: 'Diveable if you know the spot' },
  { key: 'marginal',  label: 'Marginal',  color: 'var(--ds-q-marginal)',  answer: 'maybe', headline: 'Marginal — manage expectations' },
  { key: 'poor',      label: 'Poor',      color: 'var(--ds-q-poor)',      answer: 'skip',  headline: 'Poor — consider waiting' },
  { key: 'blown',     label: 'Blown out', color: 'var(--ds-q-blown)',     answer: 'skip',  headline: 'Blown out — sit this one out' },
]

export function bandForScore(score: number): ScoreBand {
  if (score >= 82) return BANDS[0]!
  if (score >= 64) return BANDS[1]!
  if (score >= 48) return BANDS[2]!
  if (score >= 30) return BANDS[3]!
  if (score >= 14) return BANDS[4]!
  return BANDS[5]!
}

/** Dominant wave height in metres, normalised from the forecast's display unit. */
function dominantWaveMetres(day: DayForecast, units: Units): number {
  const dom = Math.max(day.wave_height ?? 0, day.swell_height ?? 0)
  return units === 'ft' ? feetToMetres(dom) : dom
}

/**
 * Compute the blended Dive Quality Score plus its explainable factor rows.
 *
 * @param day    the selected day's forecast
 * @param units  the unit wave/swell heights are expressed in (for normalisation)
 */
export function computeDiveScore(day: DayForecast, units: Units = 'm'): DiveScore {
  const visM = visForDay(day)
  const waveM = dominantWaveMetres(day, units)
  const knots = day.wind_speed ?? 0
  const rain = day.precipitation ?? 0
  const algaeRisk = day.algae?.risk ?? 'low'

  const factors: ScoreFactor[] = [
    {
      key: 'visibility',
      label: 'Visibility',
      valueLabel: `${visM.toFixed(1)} m`,
      sub: visibilitySub(visM),
      weight: WEIGHTS.visibility,
      impact: impactOf(visibilitySub(visM)),
      note: visM >= 4
        ? 'Clear enough to enjoy the ground'
        : visM >= 3 ? 'Workable if you know the spot' : 'Murky — hard to see much',
    },
    {
      key: 'seaState',
      label: 'Sea state',
      valueLabel: `${waveM.toFixed(1)} m`,
      sub: seaStateSub(waveM),
      weight: WEIGHTS.seaState,
      impact: impactOf(seaStateSub(waveM)),
      note: waveM <= 0.5
        ? 'Calm — little sediment being stirred'
        : waveM <= 1 ? 'Some movement on the surface' : 'Swell is stirring the bottom',
    },
    {
      key: 'wind',
      label: 'Wind',
      valueLabel: `${Math.round(knots)} kn`,
      sub: windSub(knots),
      weight: WEIGHTS.wind,
      impact: impactOf(windSub(knots)),
      note: knots <= 10
        ? 'Light — easy entries and flat surface'
        : knots <= 18 ? 'Breezy — expect some chop' : 'Strong wind — tough surface conditions',
    },
    {
      key: 'rain',
      label: 'Rainfall',
      valueLabel: `${rain.toFixed(1)} mm/h`,
      sub: rainSub(rain),
      weight: WEIGHTS.rain,
      impact: impactOf(rainSub(rain)),
      note: rain < 0.5
        ? 'Dry — no runoff pushing sediment in'
        : rain < 2 ? 'Light rain — minor runoff inshore' : 'Heavy rain — runoff clouds the shallows',
    },
    {
      key: 'algae',
      label: 'Algae bloom',
      valueLabel: algaeRisk === 'low' ? 'Low' : algaeRisk === 'moderate' ? 'Moderate' : 'High',
      sub: algaeSub(algaeRisk),
      weight: WEIGHTS.algae,
      impact: impactOf(algaeSub(algaeRisk)),
      note: algaeRisk === 'low'
        ? 'No significant bloom expected'
        : algaeRisk === 'moderate' ? 'Some bloom risk — patchy green water' : 'High bloom risk — green, milky water',
    },
  ]

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const blended = factors.reduce((s, f) => s + f.sub * f.weight, 0) / totalWeight
  const score = Math.round(clamp(blended))
  const band = bandForScore(score)

  // Key driver: if the score is poor, the worst factor explains it; if good,
  // the best factor is the headline. Weight the "surprise" by contribution.
  const sorted = [...factors].sort((a, b) =>
    band.answer === 'skip'
      ? a.sub * a.weight - b.sub * b.weight   // worst contributor first
      : b.sub * b.weight - a.sub * a.weight,  // best contributor first
  )

  return { score, band, answer: band.answer, keyDriver: sorted[0]!, factors }
}
