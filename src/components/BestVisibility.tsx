import { useState, useEffect } from 'react'
import { getBestVisibility } from '../lib/api'
import type { BestVisSpot } from '../types'
import styles from './BestVisibility.module.css'

interface Props {
  onSelectSpot: (lat: number, lon: number, name: string) => void
}

const COLOR_CLASSES = new Set(['blocked', 'poor', 'marginal', 'decent', 'good', 'excellent'])
function safeColorClass(cls: string | undefined): string {
  return cls && COLOR_CLASSES.has(cls) ? cls : 'decent'
}

export function BestVisibility({ onSelectSpot }: Props) {
  const [spots, setSpots] = useState<BestVisSpot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Compute today's date once at mount to avoid drift across midnight
  const [todayISO] = useState(() => new Date().toISOString().split('T')[0])
  const todayDisplay = new Date(todayISO + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    const controller = new AbortController()

    getBestVisibility()
      .then(response => {
        if (controller.signal.aborted) return
        setSpots(response.spots)
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>BEST VISIBILITY</div>
      <div className={styles.subtitle}>UK dive spots ranked for today</div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.loadingText}>
            Loading visibility data…
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && spots.length > 0 && (
        <>
          <div className={styles.dateLabel}>{todayDisplay}</div>
          <div className={styles.list}>
            {spots.map((spot, i) => {
              const vis = spot.day.vis_corrected ?? spot.day.vis_estimate
              const cc = safeColorClass(spot.day.color_class)
              return (
                <div
                  key={`${spot.lat}-${spot.lon}`}
                  className={styles.spotRow}
                  role="button"
                  tabIndex={0}
                  aria-label={`View forecast for ${spot.name}`}
                  onClick={() => onSelectSpot(spot.lat, spot.lon, spot.name)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSpot(spot.lat, spot.lon, spot.name) } }}
                >
                  <div className={styles.rank}>{i + 1}</div>
                  <div className={styles.spotInfo}>
                    <div className={styles.spotName}>{spot.name}</div>
                    <div className={styles.verdict}>
                      <span className={styles[cc]}>{spot.day.verdict}</span>
                    </div>
                  </div>
                  <div className={styles.visBlock}>
                    <div className={`${styles.visValue} ${styles[cc]}`}>
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
