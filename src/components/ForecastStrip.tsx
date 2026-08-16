import { memo, useEffect, useRef } from 'react'
import type { DayForecast, VisibilityFactor } from '../types'
import { visibilityInUnits } from '../lib/units'
import styles from './ForecastStrip.module.css'

interface Props {
  days: DayForecast[]
  selectedIndex: number
  onSelect: (i: number) => void
  /** Display unit. Visibility values remain canonical metres and are converted here. */
  units?: 'ft' | 'm'
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
  if (n.startsWith('Swell')) return `Swell ${worst.value}`
  if (n === 'Wind') return `Wind ${worst.value}`
  if (n === 'Precip') return `Rain ${worst.value}`
  if (n === 'Sea Temp') {
    const raw = worst.note?.replace('Algae: ', '') ?? ''
    return `Algae ${raw === 'high' ? 'high' : 'mod'}`
  }
  if (n.startsWith('Turbidity')) return 'Turbid'
  if (n.startsWith('CDM')) return 'CDM'
  if (n.startsWith('Seabed')) return 'Seabed'
  if (n.startsWith('River')) return 'River'
  if (n === 'Cloud Cover') return 'Cloud'
  if (n.startsWith('BGC')) return 'BGC'
  if (n === 'Wind Dir') return 'Onshore'
  return n.slice(0, 9)
}

export const ForecastStrip = memo(function ForecastStrip({ days, selectedIndex, onSelect, units = 'm' }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const strip = stripRef.current
    const activeDay = strip?.querySelector<HTMLElement>('[data-active="true"]')
    if (!strip || !activeDay) return
    const stripRect = strip.getBoundingClientRect()
    const activeDayRect = activeDay.getBoundingClientRect()
    strip.scrollTo({
      left: strip.scrollLeft + (activeDayRect.left - stripRect.left) - (strip.clientWidth - activeDay.clientWidth) / 2,
      behavior: 'auto',
    })
  }, [selectedIndex])

  return (
    <div className={styles.strip} ref={stripRef}>
      <div className={styles.row}>
        {days.map((day, i) => {
          const vis = visibilityInUnits(day.vis_corrected ?? day.vis_estimate, units)
          const colorVar = `var(--sev-${day.color_class})`
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
              data-active={i === selectedIndex}
              onClick={() => onSelect(i)}
              aria-pressed={i === selectedIndex}
              aria-label={`${formatDate(day.date)}: ${vis.toFixed(1)} ${units === 'ft' ? 'feet' : 'metres'} visibility, ${day.verdict}${day.algae.risk !== 'low' ? `, algae risk ${day.algae.risk}` : ''}${driver ? `, main factor: ${driver}` : ''}`}
            >
              <div className={styles.dateLabel}>{formatDate(day.date)}</div>
              <div className={styles.visibility}>
                <span className={styles.visibilityValue}>{vis.toFixed(1)}</span>
                <span className={styles.visibilityUnit}>{units}</span>
                {day.algae.risk !== 'low' && (
                  <span className={`${styles.algaePip} ${styles[`algae${day.algae.risk.charAt(0).toUpperCase() + day.algae.risk.slice(1)}`]}`} />
                )}
              </div>
              <div className={styles.verdict} style={{ color: colorVar }} title={day.verdict}>
                {day.verdict}
              </div>
              {driver && (
                <div className={styles.driver}>{driver}</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
})
