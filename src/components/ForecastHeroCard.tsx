import { memo } from 'react'
import type { DayForecast, ForecastResponse } from '../types'
import {
  getDiveRating,
  computeConfidence,
  findBestWindow,
  buildMainReason,
  buildRecommendation,
  type DiveRatingInfo,
  type ConfidenceInfo,
} from '../lib/diveRating'
import { visForDay } from '../lib/visTrend'
import styles from './ForecastHeroCard.module.css'

interface Props {
  day: DayForecast
  days: DayForecast[]
  todayIndex: number
  locationName: string
  forecast: Pick<ForecastResponse, 'report_count' | 'model_confidence'>
  onJumpToBestWindow?: (index: number) => void
}

/** Small pill showing the NE-UK-calibrated rating. Colour follows the rating. */
export function DiveRatingChip({ rating }: { rating: DiveRatingInfo }) {
  return (
    <span
      className={`${styles.ratingChip} ${styles[rating.colorClass]}`}
      title={rating.description}
      aria-label={`Rating: ${rating.label}`}
    >
      <span className={styles.ratingDot} aria-hidden="true" />
      {rating.label}
    </span>
  )
}

/** Confidence badge — colour-coded dot + label. Reasons are surfaced in the
 *  hero body so the badge itself stays compact. */
export function ConfidenceBadge({ confidence }: { confidence: ConfidenceInfo }) {
  return (
    <span
      className={styles.confidenceBadge}
      title={confidence.reasons.join(' · ')}
      aria-label={`Confidence: ${confidence.label}. ${confidence.reasons.join('. ')}`}
    >
      <span className={styles.confidenceDot} style={{ background: confidence.color }} aria-hidden="true" />
      {confidence.label} confidence
    </span>
  )
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export const ForecastHeroCard = memo(function ForecastHeroCard({
  day, days, todayIndex, locationName, forecast, onJumpToBestWindow,
}: Props) {
  const vis = visForDay(day)
  const rating = getDiveRating(vis)
  const confidence = computeConfidence(day, forecast)
  const best = findBestWindow(days)
  const mainReason = buildMainReason(day, best, todayIndex)
  const recommendation = buildRecommendation(vis, rating, confidence, best, todayIndex)

  return (
    <section className={styles.hero} aria-label={`Forecast summary for ${locationName}`}>
      <div className={styles.topRow}>
        <div className={styles.siteBlock}>
          <div className={styles.siteName} title={locationName}>{locationName}</div>
          <div className={styles.siteMeta}>{formatDate(day.date)}</div>
        </div>
        <div className={styles.visBlock}>
          <div className={`${styles.visNumber} ${styles[rating.colorClass]}`}>{vis.toFixed(1)}m</div>
          <div className={styles.visUnit}>Visibility</div>
        </div>
      </div>

      <div className={styles.chipRow}>
        <DiveRatingChip rating={rating} />
        <ConfidenceBadge confidence={confidence} />
      </div>

      <div className={styles.recBlock}>{recommendation}</div>
      <div className={styles.reasonLine}>{mainReason}</div>

      {best && (
        <BestWindowRow
          best={best}
          isNow={best.startIndex <= todayIndex && best.endIndex >= todayIndex}
          onClick={onJumpToBestWindow ? () => onJumpToBestWindow(best.startIndex) : undefined}
        />
      )}
    </section>
  )
})

interface BestWindowRowProps {
  best: NonNullable<ReturnType<typeof findBestWindow>>
  isNow: boolean
  onClick?: () => void
}

function BestWindowRow({ best, isNow, onClick }: BestWindowRowProps) {
  const clickable = !!onClick
  return (
    <div
      className={styles.bestWindow}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!() } } : undefined}
      aria-label={`Best upcoming window: ${best.label}, peaking around ${best.bestVis.toFixed(1)} metres`}
    >
      <div>
        <div className={styles.bestWindowLabel}>{isNow ? 'Best window · now' : 'Best upcoming window'}</div>
        <div className={styles.bestWindowValue}>{best.label}</div>
      </div>
      <div className={styles.bestWindowRight}>
        <div className={`${styles.bestWindowVis} ${styles[best.bestRating.colorClass]}`}>
          {best.bestVis.toFixed(1)}m
        </div>
        <div className={styles.bestWindowUnit}>{best.bestRating.label}</div>
      </div>
    </div>
  )
}
