import { memo } from 'react'
import type { DayForecast, VisibilityFactor } from '../types'
import styles from './ForecastStrip.module.css'

interface Props {
  days: DayForecast[]
  selectedIndex: number
  onSelect: (i: number) => void
}

function formatDate(dateStr: string): string {
  const todayStr = new Date().toISOString().split('T')[0]
  const todayDate = new Date(todayStr + 'T00:00:00')
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((d.getTime() - todayDate.getTime()) / 86400000)
  if (diff === 0)  return 'Today'
  if (diff === -1) return 'Yest'
  if (diff === 1)  return 'Tmrw'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

function primaryDriver(factors: VisibilityFactor[]): string | null {
  const negative = factors.filter(f => f.penalty <= -0.5)
  if (!negative.length) return null
  const worst = negative.reduce((a, b) => b.penalty < a.penalty ? b : a)
  const n = worst.name
  if (n.startsWith('Swell')) return `SWELL ${worst.value}`
  if (n === 'Wind') return `WIND ${worst.value}`
  if (n === 'Precip') return `RAIN ${worst.value}`
  if (n === 'Sea Temp') {
    const raw = worst.note?.replace('Algae: ', '') ?? ''
    return `ALGAE ${raw === 'high' ? 'HIGH' : 'MOD'}`
  }
  if (n.startsWith('Turbidity')) return 'TURBID'
  if (n.startsWith('CDM')) return 'CDM'
  if (n.startsWith('Seabed')) return 'SEABED'
  if (n.startsWith('River')) return 'RIVER'
  if (n === 'Cloud Cover') return 'CLOUD'
  if (n.startsWith('BGC')) return 'BGC'
  if (n === 'Wind Dir') return 'ONSHORE'
  return n.slice(0, 7).toUpperCase()
}

export const ForecastStrip = memo(function ForecastStrip({ days, selectedIndex, onSelect }: Props) {
  return (
    <div className={styles.strip}>
      <div className={styles.row}>
        {days.map((day, i) => {
          const vis = day.vis_corrected ?? day.vis_estimate
          const colorClass = styles[day.color_class as keyof typeof styles] ?? ''
          const cls = [
            styles.day,
            i === selectedIndex ? styles.active : '',
            day.is_forecast ? styles.forecast : '',
          ].join(' ')
          const driver = primaryDriver(day.factors)

          return (
            <button
              key={day.date}
              className={cls}
              onClick={() => onSelect(i)}
              aria-pressed={i === selectedIndex}
              aria-label={`${formatDate(day.date)}: ${vis.toFixed(1)} metres visibility, ${day.verdict}${day.algae.risk !== 'low' ? `, algae risk ${day.algae.risk}` : ''}${driver ? `, main factor: ${driver}` : ''}`}
            >
              <div className={styles.dateLabel}>{formatDate(day.date)}</div>
              <div className={`${styles.vis} ${colorClass}`} aria-hidden="true">{vis.toFixed(1)}</div>
              <div className={styles.unit} aria-hidden="true">metres</div>
              <div className={`${styles.verdict} ${colorClass}`} title={day.verdict} aria-hidden="true">
                {day.verdict}
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
