import { memo } from 'react'
import type { DayForecast, ForecastResponse } from '../types'
import { summariseDrivers, computeConfidence } from '../lib/diveRating'
import { buildVisSummary } from '../lib/visTrend'
import styles from './ForecastExplanation.module.css'

interface Props {
  day: DayForecast
  days: DayForecast[]
  forecast: Pick<ForecastResponse, 'report_count' | 'model_confidence'>
}

/** Public-friendly "Why?" panel — a plain-English breakdown of what's
 *  helping and hurting visibility, plus the trend and confidence context. */
export const ForecastExplanation = memo(function ForecastExplanation({ day, days, forecast }: Props) {
  const { helping, hurting } = summariseDrivers(day)
  const trend = days.length > 1 ? buildVisSummary(days) : ''
  const confidence = computeConfidence(day, forecast)

  return (
    <section className={styles.panel} aria-label="Why is visibility this way?">
      <div className={styles.title}>Why?</div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <h4>Helping visibility</h4>
          {helping.length === 0 ? (
            <div className={styles.empty}>Nothing clearly working in your favour today.</div>
          ) : (
            <ul className={styles.list}>
              {helping.map((d, i) => (
                <li key={i} className={styles.item}>
                  <span className={`${styles.dot} ${styles.dotGood}`} aria-hidden="true" />
                  <span><span className={styles.label}>{d.label}:</span>{d.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.column}>
          <h4>Hurting visibility</h4>
          {hurting.length === 0 ? (
            <div className={styles.empty}>No significant negatives right now.</div>
          ) : (
            <ul className={styles.list}>
              {hurting.map((d, i) => (
                <li key={i} className={styles.item}>
                  <span className={`${styles.dot} ${styles.dotBad}`} aria-hidden="true" />
                  <span><span className={styles.label}>{d.label}:</span>{d.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {trend && (
        <div className={styles.confidenceStrip}>
          <span className={styles.confidenceLevel} style={{ color: 'var(--accent)' }}>Trend</span>
          {trend}
        </div>
      )}

      <div className={styles.confidenceStrip}>
        <span className={styles.confidenceLevel} style={{ color: confidence.color }}>
          {confidence.label} confidence
        </span>
        {confidence.reasons.join(' · ')}.
      </div>
    </section>
  )
})
