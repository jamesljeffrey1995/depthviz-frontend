import type { DayForecast } from '../types'
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

export function ForecastStrip({ days, selectedIndex, onSelect }: Props) {
  return (
    <div className={styles.strip}>
      <div className={styles.row}>
        {days.map((day, i) => {
          const vis = day.vis_corrected ?? day.vis_estimate
          const cls = [
            styles.day,
            i === selectedIndex ? styles.active : '',
            day.is_forecast ? styles.forecast : '',
          ].join(' ')

          return (
            <div key={day.date} className={cls} onClick={() => onSelect(i)}>
              <div className={styles.dateLabel}>{formatDate(day.date)}</div>
              <div className={`${styles.vis} ${styles[day.color_class]}`}>{vis.toFixed(1)}</div>
              <div className={styles.unit}>metres</div>
              <div className={styles.verdict}>
                {day.verdict.split(' ')[0]}
                {day.algae.risk !== 'low' && (
                  <span className={`${styles.algaePip} ${styles[`algae${day.algae.risk.charAt(0).toUpperCase() + day.algae.risk.slice(1)}`]}`} title={`Algae risk: ${day.algae.risk}`} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
