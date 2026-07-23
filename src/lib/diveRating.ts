import type { DayForecast, ForecastResponse } from '../types'
import { visForDay } from './visTrend'
import { feetToMetres, type Units } from './units'

/** Wave/swell heights on a DayForecast are in the display unit the forecast was
 *  fetched with. The sea-state thresholds below are calibrated in metres, so
 *  normalise before comparing. */
function dominantWaveMetres(day: DayForecast, units: Units): number {
  const dom = Math.max(day.wave_height ?? 0, day.swell_height ?? 0)
  return units === 'ft' ? feetToMetres(dom) : dom
}

/** Locally calibrated visibility buckets for North East UK spearfishing /
 *  freediving. Deliberately NOT tropical-scuba thresholds — 3m is workable
 *  here, not "very poor". */
export type DiveRating =
  | 'blown_out'
  | 'poor'
  | 'marginal'
  | 'workable'
  | 'good'
  | 'excellent'

export interface DiveRatingInfo {
  key: DiveRating
  label: string
  short: string
  /** Legacy color_class bucket used by existing CSS (blocked/poor/marginal/decent/good/excellent). */
  colorClass: 'blocked' | 'poor' | 'marginal' | 'decent' | 'good' | 'excellent'
  /** Design-token reference (e.g. `var(--sev-good)`) for chips/markers —
   *  usable in any CSS/inline-SVG context, but not a hex to parse or suffix. */
  color: string
  description: string
}

const RATINGS: DiveRatingInfo[] = [
  { key: 'blown_out', label: 'Blown out',  short: 'Blown out',  colorClass: 'blocked',   color: 'var(--sev-blocked)',   description: 'Under 1m — not worth getting wet.' },
  { key: 'poor',      label: 'Poor',       short: 'Poor',       colorClass: 'poor',      color: 'var(--sev-poor)',      description: '1–2m — very murky, only worthwhile for local knowledge.' },
  { key: 'marginal',  label: 'Marginal',   short: 'Marginal',   colorClass: 'marginal',  color: 'var(--sev-marginal)', description: '2–3m — patchy visibility, doable for experienced local divers.' },
  { key: 'workable',  label: 'Workable',   short: 'Workable',   colorClass: 'decent',    color: 'var(--sev-decent)',    description: '3–4m — usable for spearos who know the ground.' },
  { key: 'good',      label: 'Good',       short: 'Good',       colorClass: 'good',      color: 'var(--sev-good)',      description: '4–6m — a proper North East good day.' },
  { key: 'excellent', label: 'Excellent',  short: 'Excellent',  colorClass: 'excellent', color: 'var(--sev-excellent)', description: '6m+ — rare and worth dropping everything for.' },
]

/** Bucket a visibility value (metres) into a NE-UK spearfishing rating. */
export function getDiveRating(visM: number): DiveRatingInfo {
  if (!Number.isFinite(visM) || visM < 1) return RATINGS[0]!
  if (visM < 2) return RATINGS[1]!
  if (visM < 3) return RATINGS[2]!
  if (visM < 4) return RATINGS[3]!
  if (visM < 6) return RATINGS[4]!
  return RATINGS[5]!
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ConfidenceInfo {
  level: ConfidenceLevel
  label: string
  color: string
  /** Short reasons a user can read to understand the level. */
  reasons: string[]
}

// Confidence is a trust signal, not a risk grade, so it reads on the status
// ramp directly: high trust = success, low trust = danger.
const CONF_COLORS: Record<ConfidenceLevel, string> = {
  high: 'var(--sev-good)',
  medium: 'var(--sev-marginal)',
  low: 'var(--sev-poor)',
}

/** Confidence blend — starts from the API's model_confidence and softens it
 *  based on report count, forecast age and conditions volatility. */
export function computeConfidence(
  day: DayForecast,
  forecast: Pick<ForecastResponse, 'report_count' | 'model_confidence'>,
  units: Units = 'm',
): ConfidenceInfo {
  const reasons: string[] = []
  const reports = forecast.report_count ?? 0

  // Start from the AI/bias correction confidence signal the API already exposes.
  let level: ConfidenceLevel =
    forecast.model_confidence === 'high' ? 'high'
    : forecast.model_confidence === 'medium' ? 'medium'
    : 'low'

  if (reports >= 5) reasons.push(`${reports} recent community reports`)
  else if (reports >= 1) reasons.push(`${reports} recent report${reports === 1 ? '' : 's'}`)
  else reasons.push('no recent community reports')

  // If we've never had reports, keep confidence at low unless conditions are
  // very stable and swell is low. Otherwise medium at best.
  if (reports === 0 && level === 'high') level = 'medium'

  // Big swell or high wind — model gates in and out; treat as lower confidence.
  const dominantWave = dominantWaveMetres(day, units)
  if (dominantWave > 2 || (day.wind_speed ?? 0) > 25) {
    reasons.push('unsettled surface conditions')
    if (level === 'high') level = 'medium'
  } else {
    reasons.push('surface conditions look settled')
  }

  // Satellite/BGC data staleness widens the uncertainty band.
  if (!day.water_quality || (day.water_quality.erddap_obs_date == null && day.water_quality.bgc_kd == null)) {
    reasons.push('limited satellite water-clarity data')
    if (level === 'high') level = 'medium'
  }

  const label = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'
  return { level, label, color: CONF_COLORS[level], reasons }
}

export interface BestWindow {
  startIndex: number
  endIndex: number
  startDate: string
  endDate: string
  bestVis: number
  bestRating: DiveRatingInfo
  /** Human label like "Sunday morning – Monday afternoon". Coarse: we only
   *  know daily granularity, so it says day names (start = single, or range). */
  label: string
}

function longDay(dateStr: string): string {
  const datePart = dateStr.split('T')[0] ?? dateStr
  const [y, m, d] = datePart.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-GB', { weekday: 'long' })
}

/** Find the best contiguous window of forecast days above a threshold rating.
 *  Prefers a day flagged 'good' or better; falls back to the best 'workable'
 *  cluster; if the whole week is poor/marginal, returns the single best day. */
export function findBestWindow(days: DayForecast[]): BestWindow | null {
  if (!days || days.length === 0) return null

  const rated = days.map((d) => {
    const vis = visForDay(d)
    return { vis, rating: getDiveRating(vis) }
  })

  const goodOrBetter = (i: number) => {
    const k = rated[i]?.rating.key
    return k === 'good' || k === 'excellent'
  }
  const workableOrBetter = (i: number) => {
    const k = rated[i]?.rating.key
    return k === 'workable' || k === 'good' || k === 'excellent'
  }

  const findRun = (predicate: (i: number) => boolean): [number, number] | null => {
    let bestStart = -1
    let bestLen = 0
    let bestPeak = -Infinity
    for (let i = 0; i < rated.length; ) {
      if (!predicate(i)) { i++; continue }
      let j = i
      let peak = -Infinity
      while (j < rated.length && predicate(j)) {
        const rj = rated[j]
        if (rj && rj.vis > peak) peak = rj.vis
        j++
      }
      const len = j - i
      if (len > bestLen || (len === bestLen && peak > bestPeak)) {
        bestStart = i
        bestLen = len
        bestPeak = peak
      }
      i = j
    }
    return bestStart >= 0 ? [bestStart, bestStart + bestLen - 1] : null
  }

  const run = findRun(goodOrBetter) ?? findRun(workableOrBetter)

  if (!run) {
    // Nothing workable: report the single best day so users still see when it
    // peaks, even if that peak is only "marginal".
    let bestI = 0
    for (let i = 1; i < rated.length; i++) {
      const ri = rated[i]
      const rb = rated[bestI]
      if (ri && rb && ri.vis > rb.vis) bestI = i
    }
    const day = days[bestI]
    const rb = rated[bestI]
    if (!day || !rb) return null
    return {
      startIndex: bestI,
      endIndex: bestI,
      startDate: day.date,
      endDate: day.date,
      bestVis: rb.vis,
      bestRating: rb.rating,
      label: longDay(day.date),
    }
  }

  const [s, e] = run
  const rs = rated[s]
  let peak = rs ? rs.vis : 0
  for (let i = s + 1; i <= e; i++) {
    const ri = rated[i]
    if (ri && ri.vis > peak) peak = ri.vis
  }
  const bestRating = getDiveRating(peak)
  const ds = days[s]
  const de = days[e]
  const sLabel = ds ? longDay(ds.date) : ''
  const eLabel = de ? longDay(de.date) : ''
  const label = s === e ? sLabel : `${sLabel} – ${eLabel}`

  return {
    startIndex: s,
    endIndex: e,
    startDate: ds?.date ?? '',
    endDate: de?.date ?? '',
    bestVis: peak,
    bestRating,
    label,
  }
}

export interface DriverImpact {
  label: string
  helping: boolean
  detail: string
}

/** Break the forecast into the top helping/hurting drivers a diver can act on.
 *  Uses factors + algae + resuspension + river discharge. */
export function summariseDrivers(day: DayForecast, units: Units = 'm'): { helping: DriverImpact[]; hurting: DriverImpact[] } {
  const helping: DriverImpact[] = []
  const hurting: DriverImpact[] = []

  const push = (list: DriverImpact[], label: string, detail: string) => {
    list.push({ label, helping: list === helping, detail })
  }

  // Swell/wave. Thresholds are in metres; the displayed number stays in the
  // user's unit so it matches the wave/swell figures elsewhere on the card.
  const domM = dominantWaveMetres(day, units)
  const domDisplay = Math.max(day.wave_height ?? 0, day.swell_height ?? 0)
  if (domM < 0.6) push(helping, 'Swell', `low swell (${domDisplay.toFixed(1)}${units})`)
  else if (domM > 1.5) push(hurting, 'Swell', `${domDisplay.toFixed(1)}${units} swell stirring the surface`)

  // Wind
  const wind = day.wind_speed ?? 0
  if (wind < 10) push(helping, 'Wind', `light wind (${Math.round(wind)}kn)`)
  else if (wind > 20) push(hurting, 'Wind', `${Math.round(wind)}kn wind${day.wind_dir_label ? ` from ${day.wind_dir_label}` : ''}`)

  // Rain / runoff
  const rain = day.precipitation ?? 0
  if (rain < 0.3) push(helping, 'Rain', 'little rain / low runoff')
  else if (rain > 2) push(hurting, 'Rain', `${rain.toFixed(1)}mm/h — runoff likely`)

  // Algae
  if (day.algae?.risk === 'high') push(hurting, 'Algae', 'high bloom risk in the water column')
  else if (day.algae?.risk === 'moderate') push(hurting, 'Algae', 'moderate bloom risk — expect greener water')
  else if (day.algae?.risk === 'low') push(helping, 'Algae', 'low bloom risk')

  // Resuspension
  if (day.resuspension && (day.resuspension.risk_level === 'high' || day.resuspension.risk_level === 'moderate')) {
    push(hurting, 'Seabed', `${day.resuspension.risk_level} resuspension risk`)
  }

  // River plume
  if (day.river_discharge && (day.river_discharge.risk_level === 'high' || day.river_discharge.risk_level === 'moderate')) {
    push(hurting, 'River', `${day.river_discharge.risk_level} discharge nearby`)
  }

  // Turbidity
  if (day.turbidity_penalty != null && day.turbidity_penalty > 1) {
    push(hurting, 'Turbidity', 'satellite shows suspended sediment')
  }

  return { helping: helping.slice(0, 3), hurting: hurting.slice(0, 3) }
}

/** Build the single-sentence "main reason" for the rating, e.g. for the hero.
 *  Combines the dominant driver + trend hint. */
export function buildMainReason(day: DayForecast, best: BestWindow | null, todayIdx: number, units: Units = 'm'): string {
  const { helping, hurting } = summariseDrivers(day, units)
  const primaryHurt = hurting[0]
  const primaryHelp = helping[0]

  const parts: string[] = []
  if (primaryHurt) parts.push(`limited by ${primaryHurt.detail}`)
  else if (primaryHelp) parts.push(`helped by ${primaryHelp.detail}`)
  else parts.push('conditions are middling with no strong driver')

  if (best && best.startIndex > todayIdx) {
    parts.push(`improving toward ${best.label}`)
  } else if (best && best.startIndex <= todayIdx && best.endIndex >= todayIdx) {
    parts.push("today is in the week's best window")
  }
  return parts.join(', ') + '.'
}

/** Practical UK spearo phrasing for the top-line recommendation. */
export function buildRecommendation(
  vis: number,
  rating: DiveRatingInfo,
  confidence: ConfidenceInfo,
  best: BestWindow | null,
  todayIdx: number,
): string {
  const waitForBetter =
    best &&
    best.startIndex > todayIdx &&
    best.bestVis - vis >= 1.0

  switch (rating.key) {
    case 'blown_out':
      return best && waitForBetter
        ? `Not worth it today. Hold out for ${best.label}.`
        : 'Not worth it today — sea state is against you.'
    case 'poor':
      return waitForBetter
        ? `Better to wait for ${best.label} if you can.`
        : 'Only really worthwhile for a scouting dip if you know the ground.'
    case 'marginal':
      if (waitForBetter) return `Diveable but not great — hold for ${best!.label} if possible.`
      return confidence.level === 'low'
        ? 'Diveable if you know the spot, but low confidence in the number.'
        : 'Doable for experienced local spearos. Manage expectations.'
    case 'workable':
      return confidence.level === 'low'
        ? 'Workable on paper, but limited data — trust local eyes on the water.'
        : `Worth a look — a solid North East ${rating.short.toLowerCase()} day.`
    case 'good':
      return 'Get in — a proper good day for the North East coast.'
    case 'excellent':
      return 'Drop everything. Rare visibility for this coast.'
  }
}
