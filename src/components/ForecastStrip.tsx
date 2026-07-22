import { memo, useMemo } from 'react'
import type { DayForecast, VisibilityFactor } from '../types'
import { getDiveRating, findBestWindow } from '../lib/diveRating'
import { visForDay } from '../lib/visTrend'
import styles from './ForecastStrip.module.css'

interface Props {
  days: DayForecast[]
  selectedIndex: number
  onSelect: (i: number) => void
}

function formatDate(dateStr: string): string {
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayDate = new Date(todayStr + 'T00:00:00')
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((d.getTime() - todayDate.getTime()) / 86400000)
  if (diff === 0)  return 'Today'
  if (diff === -1) return 'Yest'
  if (diff === 1)  return 'Tmrw'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

/** Short one-word warning surfaced beside the rating chip when a factor is
 *  dominant. Kept concise so cards stay scannable. */
function primaryDriver(factors: VisibilityFactor[]): string | null {
  const negative = factors.filter(f => f.penalty <= -0.5)
  if (!negative.length) return null
  const worst = negative.reduce((a, b) => b.penalty < a.penalty ? b : a)
  const n = worst.name
  if (n.startsWith('Swell')) return `SWELL ${worst.value}`
  if (n === 'Wind') return `WIND ${worst.value}`
  if (n === 'Precip') return `RAIN ${worst.value}`
  if (n === 'Sea Temp') return 'ALGAE'
  if (n.startsWith('Turbidity')) return 'TURBID'
  if (n.startsWith('CDM')) return 'CDM'
  if (n.startsWith('Seabed')) return 'SEABED'
  if (n.startsWith('River')) return 'RIVER'
  if (n === 'Cloud Cover') return 'CLOUD'
  if (n.startsWith('BGC')) return 'BGC'
  if (n === 'Wind Dir') return 'ONSHORE'
  return n.slice(0, 7).toUpperCase()
}

/** Compare two consecutive days to give an ↑/↓ trend indicator. */
function trendMarker(prevVis: number | null, vis: number): '↑' | '↓' | '·' {
  if (prevVis == null) return '·'
  if (vis - prevVis >= 0.5) return '↑'
  if (prevVis - vis >= 0.5) return '↓'
  return '·'
}

export const ForecastStrip = memo(function ForecastStrip({ days, selectedIndex, onSelect }: Props) {
  const bestWindow = useMemo(() => findBestWindow(days), [days])
  const todayISO = new Date().toISOString().slice(0, 10)

  return (
    <div className={styles.strip}>
      <div className={styles.row}>
        {days.map((day, i) => {
          const vis = visForDay(day)
          const rating = getDiveRating(vis)
          const colorClass = styles[rating.colorClass as keyof typeof styles] ?? ''
          const isBest =
            bestWindow != null && i >= bestWindow.startIndex && i <= bestWindow.endIndex
          const isToday = day.date === todayISO
          const cls = [
            styles.day,
            i === selectedIndex ? styles.active : '',
            day.is_forecast ? styles.forecast : '',
            isBest ? styles.best : '',
            isToday ? styles.today : '',
          ].filter(Boolean).join(' ')
          const driver = primaryDriver(day.factors)
          const prevDay = i > 0 ? days[i - 1] : undefined
          const trend = trendMarker(prevDay ? visForDay(prevDay) : null, vis)

          return (
            <button
              key={day.date}
              className={cls}
              onClick={() => onSelect(i)}
              aria-pressed={i === selectedIndex}
              aria-label={`${formatDate(day.date)}: ${vis.toFixed(1)} metres visibility, rated ${rating.label}${isBest ? ', best window' : ''}${day.algae.risk !== 'low' ? `, algae risk ${day.algae.risk}` : ''}${driver ? `, main factor: ${driver}` : ''}`}
            >
              {isBest && <span className={styles.bestPip} aria-hidden="true">BEST</span>}
              <div className={styles.dateLabel}>{formatDate(day.date)}</div>
              <div className={`${styles.vis} ${colorClass}`} aria-hidden="true">
                {vis.toFixed(1)}
                {trend !== '·' && <span className={styles.trend}>{trend}</span>}
              </div>
              <div className={styles.unit} aria-hidden="true">metres</div>
              <div className={`${styles.verdict} ${colorClass}`} title={rating.description} aria-hidden="true">
                {rating.label}
                {day.algae.risk !== 'low' && (
                  <span className={`${styles.algaePip} ${styles[`algae${day.algae.risk.charAt(0).toUpperCase() + day.algae.risk.slice(1)}`]}`} />
                )}
              </div>
              {driver && (
                <div className={styles.driver} aria-hidden="true">{driver}</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
})
