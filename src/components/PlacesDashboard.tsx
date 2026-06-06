import { useEffect, useState, useCallback } from 'react'
import type { DayForecast, Location } from '../types'
import { getForecast } from '../lib/api'
import { decryptCoords } from '../lib/spotCrypto'
import styles from './PlacesDashboard.module.css'

interface PlaceConditions {
  status: 'idle' | 'loading' | 'done' | 'error'
  today: DayForecast | null
  days: DayForecast[]
  bestDayIdx: number
}

interface Props {
  locations: Location[]
  userUid: string
  units: 'ft' | 'm'
  onSelectLocation: (lat: number, lon: number, name: string, locationId?: number) => void
}

function MiniStrip({ days, bestDayIdx }: { days: DayForecast[]; bestDayIdx: number }) {
  return (
    <div className={styles.miniStrip} aria-label="7-day conditions strip">
      {days.map((day, i) => {
        const d = new Date(day.date + 'T00:00:00')
        const label = d.toLocaleDateString('en-GB', { weekday: 'narrow' })
        const vis = day.vis_corrected ?? day.vis_estimate
        return (
          <div
            key={day.date}
            className={`${styles.miniDay} ${styles[day.color_class as keyof typeof styles] ?? ''} ${i === bestDayIdx ? styles.miniDayBest : ''}`}
            title={`${label}: ${vis.toFixed(1)}m — ${day.verdict}`}
            aria-label={`${label}: ${vis.toFixed(1)} metres, ${day.verdict}`}
          >
            <div className={styles.miniDayLabel}>{label}</div>
            <div className={styles.miniDayVis}>{vis.toFixed(1)}</div>
          </div>
        )
      })}
    </div>
  )
}

function bestDayIndex(days: DayForecast[]): number {
  let best = 0
  let bestVis = -1
  for (let i = 0; i < days.length; i++) {
    const vis = days[i].vis_corrected ?? days[i].vis_estimate
    if (vis > bestVis) { bestVis = vis; best = i }
  }
  return best
}

export function PlacesDashboard({ locations, userUid, units, onSelectLocation }: Props) {
  const [conditions, setConditions] = useState<Record<number, PlaceConditions>>({})

  const fetchConditionsForPlace = useCallback(async (loc: Location) => {
    setConditions(prev => ({ ...prev, [loc.id]: { status: 'loading', today: null, days: [], bestDayIdx: 0 } }))
    try {
      let lat = loc.lat
      let lon = loc.lon
      if (loc.encrypted_lat && loc.encrypted_lon) {
        const decrypted = await decryptCoords(loc.encrypted_lat, loc.encrypted_lon, userUid)
        lat = decrypted.lat
        lon = decrypted.lon
      }
      const forecast = await getForecast(lat, lon, loc.name, units, loc.id)
      const todayStr = new Date().toISOString().split('T')[0]
      const todayIdx = forecast.days.findIndex(d => d.date === todayStr)
      const today = todayIdx >= 0 ? forecast.days[todayIdx] : forecast.days[0] ?? null
      const futureDays = forecast.days.filter(d => d.is_forecast || d.date >= todayStr)
      setConditions(prev => ({
        ...prev,
        [loc.id]: {
          status: 'done',
          today,
          days: forecast.days,
          bestDayIdx: bestDayIndex(futureDays),
        },
      }))
    } catch {
      setConditions(prev => ({ ...prev, [loc.id]: { status: 'error', today: null, days: [], bestDayIdx: 0 } }))
    }
  }, [userUid, units])

  useEffect(() => {
    const toFetch = locations.slice(0, 8)
    for (const loc of toFetch) {
      fetchConditionsForPlace(loc)
    }
  }, [locations, fetchConditionsForPlace])

  if (locations.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📍</div>
        <div className={styles.emptyText}>No saved places yet<br />Search for a location and tap + Save</div>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.heading}>My Places</div>
      <div className={styles.grid}>
        {locations.map(loc => {
          const cond = conditions[loc.id]
          const isPrivate = Boolean(loc.encrypted_lat && loc.encrypted_lon)
          const today = cond?.today

          return (
            <div key={loc.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.placeName}>{loc.name}</div>
                <div className={styles.placeMeta}>
                  {isPrivate ? (
                    <span className={styles.privateBadge}>Private</span>
                  ) : (
                    <span className={styles.publicBadge}>Public</span>
                  )}
                </div>
              </div>

              {/* Today's conditions */}
              {cond?.status === 'loading' && (
                <div className={styles.loadingPulse}>
                  <div className={styles.skeletonVis} />
                  <div className={styles.skeletonStrip} />
                </div>
              )}

              {cond?.status === 'done' && today && (
                <div className={styles.todayBlock}>
                  <div className={`${styles.todayVis} ${styles[today.color_class as keyof typeof styles] ?? ''}`}>
                    {(today.vis_corrected ?? today.vis_estimate).toFixed(1)}
                    <span className={styles.todayVisUnit}>m</span>
                  </div>
                  <div className={`${styles.todayVerdict} ${styles[today.color_class as keyof typeof styles] ?? ''}`}>
                    {today.verdict}
                  </div>
                  <div className={styles.todayMeta}>
                    {today.wave_height != null && (
                      <span title="Wave height">↕ {today.wave_height.toFixed(1)}{units}</span>
                    )}
                    {today.sea_temp != null && (
                      <span title="Sea temperature">🌡 {today.sea_temp.toFixed(0)}°C</span>
                    )}
                    {today.wind_speed != null && (
                      <span title="Wind speed">💨 {Math.round(today.wind_speed)}kn</span>
                    )}
                  </div>
                </div>
              )}

              {cond?.status === 'error' && (
                <div className={styles.condError}>Conditions unavailable</div>
              )}

              {/* Mini 7-day strip */}
              {cond?.status === 'done' && cond.days.length > 0 && (
                <MiniStrip days={cond.days} bestDayIdx={cond.bestDayIdx} />
              )}

              <button
                className={styles.viewBtn}
                onClick={() => onSelectLocation(loc.lat, loc.lon, loc.name, loc.id)}
                aria-label={`View full forecast for ${loc.name}`}
              >
                View Forecast →
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
