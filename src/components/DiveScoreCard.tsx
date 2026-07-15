import { memo, useState } from 'react'
import type { DayForecast, ForecastResponse } from '../types'
import { computeDiveScore, type ScoreFactor } from '../lib/diveScore'
import { computeConfidence, findBestWindow } from '../lib/diveRating'
import {
  Card, Badge, DiveScore, Meter,
  EyeIcon, WaveIcon, WindIcon, RainIcon, AlgaeIcon, MapPinIcon, ChevronDownIcon, ClockIcon,
} from './ui'
import styles from './DiveScoreCard.module.css'

interface Props {
  day: DayForecast
  locationName: string
  forecast: Pick<ForecastResponse, 'report_count' | 'model_confidence'>
  units?: 'ft' | 'm'
  /** Full series + today's index power the "best upcoming window" shortcut. */
  days?: DayForecast[]
  todayIndex?: number
  onJumpToBestWindow?: (index: number) => void
}

const FACTOR_ICON: Record<ScoreFactor['key'], React.ReactNode> = {
  visibility: <EyeIcon />,
  seaState: <WaveIcon />,
  wind: <WindIcon />,
  rain: <RainIcon />,
  algae: <AlgaeIcon />,
}

const FACTOR_COLOR: Record<ScoreFactor['impact'], string> = {
  positive: 'var(--ds-success)',
  neutral: 'var(--ds-warn)',
  negative: 'var(--ds-danger)',
}

const ANSWER_META = {
  go:    { label: 'Yes — dive',   tone: 'success' as const },
  maybe: { label: 'Maybe',        tone: 'warn' as const },
  skip:  { label: 'Not today',    tone: 'danger' as const },
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

/**
 * The location page's lead — answers "should I dive here today?" before any
 * scrolling. A single prominent Dive Quality Score, a plain-English verdict,
 * and a self-explaining factor breakdown (progressive disclosure keeps the
 * detail one tap away).
 */
export const DiveScoreCard = memo(function DiveScoreCard({
  day, locationName, forecast, units = 'm', days, todayIndex = 0, onJumpToBestWindow,
}: Props) {
  const result = computeDiveScore(day, units)
  const confidence = computeConfidence(day, forecast, units)
  const answer = ANSWER_META[result.answer]
  const [showFactors, setShowFactors] = useState(true)

  const best = days ? findBestWindow(days) : null
  const bestIsNow = !!best && best.startIndex <= todayIndex && best.endIndex >= todayIndex

  return (
    <Card elevation="floating" padding="lg" accent={result.band.color} className={`${styles.card} dv-animate-in`}>
      {/* 1 · Can I dive? — the verdict, stated in words */}
      <div className={styles.verdictRow}>
        <Badge tone={answer.tone} dot>{answer.label}</Badge>
        <span className={styles.location}><MapPinIcon aria-hidden="true" /> {locationName}</span>
        <span className={styles.date}>{formatDate(day.date)}</span>
      </div>

      {/* 2 · Visibility score — the single prominent number */}
      <div className={styles.heroRow}>
        <DiveScore score={result.score} color={result.band.color} label={result.band.label} />
        <div className={styles.heroText}>
          <h2 className={styles.headline}>{result.band.headline}</h2>
          <p className={styles.driver}>{result.keyDriver.note}.</p>
          <div className={styles.confRow}>
            <Badge
              color={confidence.color}
              dot
              title={confidence.reasons.join(' · ')}
            >
              {confidence.label} confidence
            </Badge>
            <span className={styles.reports}>
              {forecast.report_count > 0
                ? `${forecast.report_count} diver report${forecast.report_count === 1 ? '' : 's'}`
                : 'Model forecast'}
            </span>
          </div>
        </div>
      </div>

      {/* 5 · Why — the factor breakdown, expandable */}
      <button
        className={styles.toggle}
        onClick={() => setShowFactors(v => !v)}
        aria-expanded={showFactors}
      >
        Why this score
        <ChevronDownIcon
          className={`${styles.chevron} ${showFactors ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>

      {showFactors && (
        <div className={styles.factors}>
          {result.factors.map(f => (
            <Meter
              key={f.key}
              label={<span className={styles.factorLabel}>{FACTOR_ICON[f.key]} {f.label}</span>}
              value={f.valueLabel}
              percent={f.sub}
              color={FACTOR_COLOR[f.impact]}
              impact={f.impact}
              note={f.note}
            />
          ))}
        </div>
      )}

      {/* Best upcoming window — a one-tap shortcut to the best day this week */}
      {best && (
        <button
          type="button"
          className={`${styles.bestWindow} dv-pressable`}
          onClick={onJumpToBestWindow ? () => onJumpToBestWindow(best.startIndex) : undefined}
          disabled={!onJumpToBestWindow}
          aria-label={`Best upcoming window: ${best.label}, peaking around ${best.bestVis.toFixed(1)} metres`}
        >
          <span className={styles.bestLeft}>
            <ClockIcon aria-hidden="true" />
            <span>
              <span className={styles.bestLabel}>{bestIsNow ? 'Best window · now' : 'Best upcoming window'}</span>
              <span className={styles.bestValue}>{best.label}</span>
            </span>
          </span>
          <span className={styles.bestRight} style={{ color: best.bestRating.color }}>
            {best.bestVis.toFixed(1)}m · {best.bestRating.label}
          </span>
        </button>
      )}
    </Card>
  )
})
