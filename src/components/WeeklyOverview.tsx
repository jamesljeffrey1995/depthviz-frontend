import { memo } from 'react'
import type { DayForecast } from '../types'
import { WindArrow } from './WindArrow'
import styles from './WeeklyOverview.module.css'

interface Props {
  days: DayForecast[]
  locationName: string
  units: 'ft' | 'm'
  selectedIndex: number
  onSelectDay: (i: number) => void
}

function formatDate(dateStr: string): { day: string; date: string } {
  const todayStr = new Date().toISOString().split('T')[0]
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((d.getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)
  const dayLabel =
    diff === 0 ? 'Today' :
    diff === -1 ? 'Yest' :
    diff === 1 ? 'Tmrw' :
    d.toLocaleDateString('en-GB', { weekday: 'short' })
  const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return { day: dayLabel, date: dateLabel }
}

function bestFutureDayIndex(days: DayForecast[]): number {
  const todayStr = new Date().toISOString().split('T')[0]
  let best = -1
  let bestVis = -1
  for (let i = 0; i < days.length; i++) {
    if (!days[i].is_forecast && days[i].date < todayStr) continue
    const vis = days[i].vis_corrected ?? days[i].vis_estimate
    if (vis > bestVis) { bestVis = vis; best = i }
  }
  return best >= 0 ? best : 0
}

export const WeeklyOverview = memo(function WeeklyOverview({ days, locationName, units, selectedIndex, onSelectDay }: Props) {
  const bestIdx = bestFutureDayIndex(days)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.location}>{locationName}</span>
        <span className={styles.subtitle}>7-day conditions at a glance</span>
      </div>
      <div className={styles.grid} role="list" aria-label="Weekly conditions">
        {days.map((day, i) => {
          const vis = day.vis_corrected ?? day.vis_estimate
          const { day: dayLabel, date: dateLabel } = formatDate(day.date)
          const isBest = i === bestIdx
          const isSelected = i === selectedIndex
          const colorCls = styles[day.color_class as keyof typeof styles] ?? ''

          const windSpeed = Math.round(day.wind_speed)
          const gust = day.wind_gust != null ? Math.round(day.wind_gust) : null
          const showGust = gust != null && gust > windSpeed
          const windDesc =
            `${windSpeed}${showGust ? `–${gust}` : ''}kn` +
            (day.wind_dir_label ? ` from ${day.wind_dir_label}` : '')

          return (
            <button
              key={day.date}
              role="listitem"
              className={[
                styles.dayCard,
                colorCls,
                isBest ? styles.best : '',
                isSelected ? styles.selected : '',
                !day.is_forecast ? styles.historical : '',
              ].join(' ')}
              onClick={() => onSelectDay(i)}
              aria-label={`${dayLabel} ${dateLabel}: ${vis.toFixed(1)} metres visibility, ${day.verdict}, wind ${windDesc}${isBest ? ', best day this week' : ''}`}
              aria-pressed={isSelected}
            >
              {isBest && <div className={styles.bestBadge} aria-hidden="true">BEST</div>}
              {!day.is_forecast && <div className={styles.histBadge} aria-hidden="true">LOG</div>}

              <div className={styles.dayName}>{dayLabel}</div>
              <div className={styles.dayDate}>{dateLabel}</div>

              <div className={styles.vis}>{vis.toFixed(1)}<span className={styles.visUnit}>m</span></div>
              <div className={styles.verdict}>{day.verdict}</div>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Wave</span>
                  <span className={styles.metricVal}>{day.wave_height.toFixed(1)}{units}</span>
                </div>
                <div className={styles.windRow} title={windDesc}>
                  <span className={styles.metricLabel}>Wind</span>
                  <span className={styles.windVal}>
                    <WindArrow dir={day.wind_dir} size={12} title={`Wind from ${day.wind_dir_label}`} />
                    <span className={styles.windSpeed}>
                      {windSpeed}{showGust && <span className={styles.gust}>–{gust}</span>}<span className={styles.windUnit}>kn</span>
                    </span>
                    {day.wind_dir_label && <span className={styles.windDirLabel}>{day.wind_dir_label}</span>}
                  </span>
                </div>
                {day.sea_temp != null && (
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Sea</span>
                    <span className={styles.metricVal}>{day.sea_temp.toFixed(0)}°C</span>
                  </div>
                )}
                {day.algae.risk !== 'low' && (
                  <div className={styles.metric}>
                    <span className={`${styles.metricLabel} ${styles.algae}`} title={`Algae risk: ${day.algae.risk}`}>
                      Algae
                    </span>
                    <span className={`${styles.metricVal} ${styles[`algae${day.algae.risk}` as keyof typeof styles] ?? ''}`}>
                      {day.algae.risk}
                    </span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <p className={styles.hint}>Tap a day to view the full forecast breakdown</p>
    </div>
  )
})
