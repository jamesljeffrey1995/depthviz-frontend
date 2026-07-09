import { memo } from 'react'
import type { DayForecast, ForecastResponse, VisibilityExplanation } from '../types'
import { summariseDrivers, computeConfidence } from '../lib/diveRating'
import { buildVisSummary } from '../lib/visTrend'
import styles from './ForecastExplanation.module.css'

interface Props {
  day: DayForecast
  days: DayForecast[]
  forecast: Pick<ForecastResponse, 'report_count' | 'model_confidence'>
}

// Keyed by the confidence union so a new/renamed level is a compile error here
// rather than silently falling through to a default colour.
const CONFIDENCE_COLORS: Record<VisibilityExplanation['confidence'], string> = {
  high: 'var(--good)',
  medium: 'var(--accent)',
  low: 'var(--warn)',
}

/** Public-friendly "Why?" panel — a plain-English breakdown of what's
 *  helping and hurting visibility, plus the trend and confidence context. */
export const ForecastExplanation = memo(function ForecastExplanation({ day, days, forecast }: Props) {
  const { helping, hurting } = summariseDrivers(day)
  const trend = days.length > 1 ? buildVisSummary(days) : ''
  const confidence = computeConfidence(day, forecast)
  const summary = day.explanation

  return (
    <section className={styles.panel} aria-label="Why is visibility this way?">
      <div className={styles.title}>Why?</div>

      {summary && (
        <div className={styles.summary}>
          <div className={styles.summaryHead}>
            <div className={styles.visBlock}>
              <span className={styles.visValue}>{summary.visibility_m.toFixed(1)}</span>
              <span className={styles.visUnit}>m</span>
            </div>
            <span
              className={styles.confChip}
              style={{ color: CONFIDENCE_COLORS[summary.confidence] }}
            >
              {summary.confidence} confidence
            </span>
          </div>

          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}>
              <dt>Main reason</dt>
              <dd>{summary.main_reason}</dd>
            </div>
            {summary.satellite_signal && (
              <div className={styles.summaryRow}>
                <dt>Satellite signal</dt>
                <dd>{summary.satellite_signal}</dd>
              </div>
            )}
            {summary.local_reports && (
              <div className={styles.summaryRow}>
                <dt>Local reports</dt>
                <dd>{summary.local_reports}</dd>
              </div>
            )}
            {summary.model_agreement && (
              <div className={styles.summaryRow}>
                <dt>Model agreement</dt>
                <dd>{summary.model_agreement}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

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

      {/* Legacy client-side confidence strip. Suppressed when the richer
          server-side summary card is shown so the panel never displays two
          differently-derived "confidence" figures that could contradict. */}
      {!summary && (
        <div className={styles.confidenceStrip}>
          <span className={styles.confidenceLevel} style={{ color: confidence.color }}>
            {confidence.label} confidence
          </span>
          {confidence.reasons.join(' · ')}.
        </div>
      )}
    </section>
  )
})
