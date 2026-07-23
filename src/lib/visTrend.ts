import type { DayForecast } from '../types'

export type VisCategory = 'good' | 'marginal' | 'poor'

const RANK: Record<VisCategory, number> = { good: 2, marginal: 1, poor: 0 }

/** Predicted visibility shown to the diver: AI-corrected value when present,
 *  otherwise the raw model estimate. */
export function visForDay(day: DayForecast): number {
  return day.vis_corrected ?? day.vis_estimate
}

/** Three-bucket category aligned with getVerdict() thresholds:
 *  good ≥ 8 m (DECENT/GOOD/EXCELLENT), marginal 5–8 m, poor < 5 m. */
export function categoriseVis(vis: number): VisCategory {
  if (vis >= 8) return 'good'
  if (vis >= 5) return 'marginal'
  return 'poor'
}

export function categoryColor(cat: VisCategory): string {
  if (cat === 'good') return 'var(--sev-good)'
  if (cat === 'marginal') return 'var(--sev-marginal)'
  return 'var(--sev-poor)'
}

function shortDay(dateStr: string): string {
  return weekdayShort(dateStr)
}

/** Parse a `YYYY-MM-DD` (or ISO) forecast date into a *local* Date.
 *  `new Date('YYYY-MM-DD')` is parsed as UTC midnight, which can shift the
 *  weekday by a day for users west of UTC — so build the date from its parts
 *  in local time instead, keeping the calendar day stable everywhere. */
function parseLocalDate(dateStr: string): Date {
  const datePart = dateStr.split('T')[0] ?? dateStr
  const parts = datePart.split('-').map(Number)
  // Validate with Number.isFinite so a malformed part (Number('foo') === NaN)
  // falls back to a sane default instead of producing new Date(NaN, …).
  const y = Number.isFinite(parts[0]) ? (parts[0] as number) : 1970
  const m = Number.isFinite(parts[1]) ? (parts[1] as number) : 1
  const d = Number.isFinite(parts[2]) ? (parts[2] as number) : 1
  return new Date(y, m - 1, d)
}

export function weekdayShort(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-GB', { weekday: 'short' })
}

export function weekdayLong(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-GB', { weekday: 'long' })
}

function formatRange(series: { date: string }[], start: number, end: number): string {
  const startDate = series[start]?.date ?? ''
  const endDate = series[end]?.date ?? ''
  return start === end
    ? shortDay(startDate)
    : `${shortDay(startDate)}–${shortDay(endDate)}`
}

/**
 * One-line, plain-language summary of how predicted visibility moves across the
 * forecast — e.g. "Good visibility expected Fri–Sat, deteriorating Sun."
 *
 * Always returns a sentence for any forecast state (good / marginal / poor) so
 * the DayDetail panel never shows an empty summary slot.
 */
export function buildVisSummary(days: DayForecast[]): string {
  if (!days || days.length === 0) return ''

  const series = days.map(d => ({ date: d.date, cat: categoriseVis(visForDay(d)) }))
  const n = series.length
  const has = (c: VisCategory) => series.some(s => s.cat === c)
  const best: VisCategory = has('good') ? 'good' : has('marginal') ? 'marginal' : 'poor'

  if (best === 'poor') {
    return 'Poor visibility expected across the forecast — conditions look unsuitable.'
  }

  // First contiguous run of the best category present.
  const start = series.findIndex(s => s.cat === best)
  let end = start
  while (end + 1 < n && series[end + 1]?.cat === best) end++

  const label = best === 'good' ? 'Good' : 'Marginal'
  const range = formatRange(series, start, end)

  const after = end + 1 < n ? series[end + 1] : null
  const before = start > 0 ? series[start - 1] : null

  if (after && RANK[after.cat] < RANK[best]) {
    return `${label} visibility expected ${range}, deteriorating ${shortDay(after.date)}.`
  }
  if (before && RANK[before.cat] < RANK[best]) {
    return `Improving — ${label.toLowerCase()} visibility expected from ${shortDay(series[start]?.date ?? '')}.`
  }
  return `${label} visibility expected ${range}.`
}
