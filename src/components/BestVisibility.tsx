import { useState, useEffect, useRef } from 'react'
import { getForecast } from '../lib/api'
import { UK_DIVE_SPOTS } from './SpotsMap'
import type { DayForecast } from '../types'
import styles from './BestVisibility.module.css'

interface SpotForecast {
  name: string
  lat: number
  lon: number
  day: DayForecast
}

interface Props {
  onSelectSpot: (lat: number, lon: number, name: string) => void
}

/** Concurrency-limited parallel fetch of forecasts for all UK dive spots. */
async function fetchAllForecasts(
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void,
): Promise<SpotForecast[]> {
  const today = new Date().toISOString().split('T')[0]
  const results: SpotForecast[] = []
  let done = 0
  const total = UK_DIVE_SPOTS.length
  const CONCURRENCY = 6

  const queue = [...UK_DIVE_SPOTS]
  async function worker() {
    while (queue.length > 0) {
      if (signal.aborted) return
      const spot = queue.shift()
      if (!spot) return
      try {
        const resp = await getForecast(spot.lat, spot.lon, spot.name)
        const todayForecast = resp.days.find(d => d.date === today)
        if (todayForecast) {
          results.push({ name: spot.name, lat: spot.lat, lon: spot.lon, day: todayForecast })
        }
      } catch {
        // Skip spots whose forecast fails — network / API errors are non-fatal
      }
      done++
      onProgress(done, total)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  return results
}

export function BestVisibility({ onSelectSpot }: Props) {
  const [spots, setSpots] = useState<SpotForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState({ done: 0, total: UK_DIVE_SPOTS.length })
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller

    fetchAllForecasts(controller.signal, (done, total) => {
      setProgress({ done, total })
    })
      .then(results => {
        if (controller.signal.aborted) return
        results.sort((a, b) => {
          const visA = a.day.vis_corrected ?? a.day.vis_estimate
          const visB = b.day.vis_corrected ?? b.day.vis_estimate
          return visB - visA
        })
        setSpots(results)
        setLoading(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Unable to load visibility data')
          setLoading(false)
        }
      })

    return () => { controller.abort() }
  }, [])

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>BEST VISIBILITY</div>
      <div className={styles.subtitle}>UK dive spots ranked for today</div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          <div className={styles.loadingText}>
            Scanning {progress.done} / {progress.total} spots…
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && spots.length > 0 && (
        <>
          <div className={styles.dateLabel}>{today}</div>
          <div className={styles.list}>
            {spots.map((spot, i) => {
              const vis = spot.day.vis_corrected ?? spot.day.vis_estimate
              const colorClass = spot.day.color_class
              return (
                <div
                  key={`${spot.lat}-${spot.lon}`}
                  className={styles.spotRow}
                  onClick={() => onSelectSpot(spot.lat, spot.lon, spot.name)}
                >
                  <div className={styles.rank}>{i + 1}</div>
                  <div className={styles.spotInfo}>
                    <div className={styles.spotName}>{spot.name}</div>
                    <div className={styles.verdict}>
                      <span className={styles[colorClass] ?? ''}>{spot.day.verdict}</span>
                    </div>
                  </div>
                  <div className={styles.visBlock}>
                    <div className={`${styles.visValue} ${styles[colorClass] ?? ''}`}>
                      {vis.toFixed(1)}
                    </div>
                    <div className={styles.visUnit}>metres</div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!loading && !error && spots.length === 0 && (
        <div className={styles.error}>No visibility data available for today</div>
      )}
    </div>
  )
}
