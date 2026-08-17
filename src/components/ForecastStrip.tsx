import { memo, useCallback, useEffect, useRef, useState } from 'react'
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
  const [canScrollBack, setCanScrollBack] = useState(false)
  const [canScrollForward, setCanScrollForward] = useState(false)

  const updateScrollState = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const back = strip.scrollLeft > 2
    const forward = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 2
    setCanScrollBack(prev => prev === back ? prev : back)
    setCanScrollForward(prev => prev === forward ? prev : forward)
  }, [])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    updateScrollState()
    strip.addEventListener('scroll', updateScrollState, { passive: true })
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateScrollState)
    observer?.observe(strip)
    window.addEventListener('resize', updateScrollState)
    return () => {
      strip.removeEventListener('scroll', updateScrollState)
      observer?.disconnect()
      window.removeEventListener('resize', updateScrollState)
    }
  }, [days.length, updateScrollState])

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
    requestAnimationFrame(updateScrollState)
  }, [selectedIndex, updateScrollState])

  const scrollByPage = (direction: -1 | 1) => {
    const strip = stripRef.current
    if (!strip) return
    strip.scrollBy({ left: direction * Math.max(180, strip.clientWidth * 0.72), behavior: 'smooth' })
  }

  return (
    <div className={styles.stripShell}>
      <button
        type="button"
        className={styles.scrollButton}
        disabled={!canScrollBack}
        onClick={() => scrollByPage(-1)}
        aria-label="Earlier forecast days"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div className={styles.strip} ref={stripRef} role="region" aria-label="Daily forecast">
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
              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>{formatDate(day.date)}</span>
                {day.algae.risk !== 'low' && (
                  <span
                    className={`${styles.algaeBadge} ${styles[`algae${day.algae.risk.charAt(0).toUpperCase() + day.algae.risk.slice(1)}`]}`}
                    title={`${day.algae.risk} algae risk`}
                    aria-hidden="true"
                  >
                    algae
                  </span>
                )}
              </div>
              <div className={styles.visibility}>
                <span className={styles.visibilityValue}>{vis.toFixed(1)}</span>
                <span className={styles.visibilityUnit}>{units}</span>
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
      <button
        type="button"
        className={styles.scrollButton}
        disabled={!canScrollForward}
        onClick={() => scrollByPage(1)}
        aria-label="Later forecast days"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
})
