import { useEffect, useState, useCallback } from 'react'
import type { DayForecast, Location } from '../types'
import { getForecast } from '../lib/api'
import { decryptCoords } from '../lib/spotCrypto'
import styles from './PlacesDashboard.module.css'

interface PlaceConditions {
  status: 'idle' | 'loading' | 'done' | 'error' | 'private_no_key'
  today: DayForecast | null
  days: DayForecast[]
  bestDayIdx: number
  /** Decrypted lat/lon for private spots — resolved during fetch and reused on click */
  resolvedLat: number
  resolvedLon: number
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

/** Returns the index of the best day within a (already-sliced) days array. */
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
    setConditions(prev => ({
      ...prev,
      [loc.id]: { status: 'loading', today: null, days: [], bestDayIdx: 0, resolvedLat: loc.lat, resolvedLon: loc.lon },
    }))
    try {
      let lat = loc.lat
      let lon = loc.lon
      if (loc.encrypted_lat && loc.encrypted_lon) {
        try {
          const decrypted = await decryptCoords(loc.encrypted_lat, loc.encrypted_lon, userUid)
          lat = decrypted.lat
          lon = decrypted.lon
        } catch (decryptErr) {
          const isMissingKey = decryptErr instanceof Error && decryptErr.message.startsWith('Missing spot encryption key')
          setConditions(prev => ({
            ...prev,
            [loc.id]: { status: isMissingKey ? 'private_no_key' : 'error', today: null, days: [], bestDayIdx: 0, resolvedLat: loc.lat, resolvedLon: loc.lon },
          }))
          return
        }
      }
      const forecast = await getForecast(lat, lon, loc.name, units, loc.id)
      const todayStr = new Date().toISOString().split('T')[0]
      const todayIdx = forecast.days.findIndex(d => d.date === todayStr)
      // Slice to 7 days from today so the mini strip shows a clean 7-day window
      const startIdx = todayIdx >= 0 ? todayIdx : 0
      const displayDays = forecast.days.slice(startIdx, startIdx + 7)
      const today = displayDays[0] ?? null
      setConditions(prev => ({
        ...prev,
        [loc.id]: {
          status: 'done',
          today,
          days: displayDays,
          bestDayIdx: bestDayIndex(displayDays),
          resolvedLat: lat,
          resolvedLon: lon,
        },
      }))
    } catch {
      setConditions(prev => ({
        ...prev,
        [loc.id]: { status: 'error', today: null, days: [], bestDayIdx: 0, resolvedLat: loc.lat, resolvedLon: loc.lon },
      }))
    }
  }, [userUid, units])

  useEffect(() => {
    const toFetch = locations.slice(0, 8)
    for (const loc of toFetch) {
      fetchConditionsForPlace(loc)
    }
  }, [locations, fetchConditionsForPlace])

  /** Navigate to forecast, decrypting private spot coords if not yet resolved. */
  const handleView = useCallback(async (loc: Location) => {
    const cond = conditions[loc.id]
    // If we've already fetched (and decrypted), use the resolved coords
    if (cond?.status === 'done') {
      onSelectLocation(cond.resolvedLat, cond.resolvedLon, loc.name, loc.id)
      return
    }
    // Decrypt on-demand for private spots where fetch hasn't completed yet
    if (loc.encrypted_lat && loc.encrypted_lon) {
      try {
        const { lat, lon } = await decryptCoords(loc.encrypted_lat, loc.encrypted_lon, userUid)
        onSelectLocation(lat, lon, loc.name, loc.id)
      } catch {
        onSelectLocation(loc.lat, loc.lon, loc.name, loc.id)
      }
      return
    }
    onSelectLocation(loc.lat, loc.lon, loc.name, loc.id)
  }, [conditions, userUid, onSelectLocation])

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

              {cond?.status === 'private_no_key' && (
                <div className={styles.condError}>Saved on another device — open there to view</div>
              )}

              {/* Mini 7-day strip */}
              {cond?.status === 'done' && cond.days.length > 0 && (
                <MiniStrip days={cond.days} bestDayIdx={cond.bestDayIdx} />
              )}

              <button
                className={styles.viewBtn}
                onClick={() => handleView(loc)}
                disabled={cond?.status === 'private_no_key'}
                aria-label={cond?.status === 'private_no_key' ? `${loc.name} — encryption key not available on this device` : `View full forecast for ${loc.name}`}
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
