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

// Number of placeholder rows to render while the fan-out resolves.
const SKELETON_COUNT = 8
// The /forecast/best fan-out is a single (non-streaming) response, so real
// per-spot progress isn't observable. Ramp a bounded bar toward a cap over
// the expected cold-response window to convey motion without overpromising.
const PROGRESS_CAP = 92
const PROGRESS_TIME_CONSTANT_MS = 18000

export function BestVisibility({ onSelectSpot }: Props) {
  const [spots, setSpots] = useState<BestVisSpot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [failedCount, setFailedCount] = useState(0)
  const [progress, setProgress] = useState(0)

  // Compute today's date once at mount to avoid drift across midnight
  const [todayISO] = useState(() => new Date().toISOString().split('T')[0])
  const todayDisplay = new Date(todayISO + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    const controller = new AbortController()

    getBestVisibility()
      .then(response => {
        if (controller.signal.aborted) return
        setSpots(response.spots)
        setFailedCount(response.failedCount ?? 0)
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

  // Drive the bounded progress bar while loading.
  useEffect(() => {
    if (!loading) return
    const start = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = (1 - Math.exp(-elapsed / PROGRESS_TIME_CONSTANT_MS)) * 100
      setProgress(Math.min(PROGRESS_CAP, pct))
    }, 400)
    return () => clearInterval(id)
  }, [loading])

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>BEST VISIBILITY</div>
      <div className={styles.subtitle}>UK dive spots ranked for today</div>

      {loading && (
        <div aria-busy="true">
          <div className={styles.progressBar} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.dateLabel}>{todayDisplay}</div>
          <div className={styles.list} aria-hidden="true">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.skelRank} />
                <div className={styles.skelInfo}>
                  <div className={styles.skelName} />
                  <div className={styles.skelVerdict} />
                </div>
                <div className={styles.skelVisBlock}>
                  <div className={styles.skelVisValue} />
                  <div className={styles.skelVisUnit} />
                </div>
              </div>
            ))}
          </div>
          {/* Live region holds only static text so the ticking % doesn't spam AT */}
          <div className={styles.loadingText} role="status" aria-live="polite">
            Reading conditions across UK dive spots…
            <span aria-hidden="true"> {Math.round(progress)}%</span>
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

      {!loading && failedCount > 0 && (
        <div className={styles.failedNote}>
          {failedCount} spot{failedCount !== 1 ? 's' : ''} could not be loaded — try refreshing
        </div>
      )}
    </div>
  )
}
