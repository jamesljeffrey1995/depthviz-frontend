import { useState, useEffect } from 'react'
import { getBestVisibility } from '../lib/api'
import { metresToFeet } from '../lib/units'
import { safeColorClass } from '../lib/visibilityPalette'
import { normalizeIsoDate } from '../lib/dateOnly'
import type { BestVisSpot } from '../types'
import { PageLayout } from './ui'
import styles from './BestVisibility.module.css'

interface Props {
  onSelectSpot: (lat: number, lon: number, name: string) => void
  units: 'ft' | 'm'
  totalSpotCount?: number
}

// Number of placeholder rows to render while the fan-out resolves (one
// winner-sized skeleton plus these compact rows below it).
const SKELETON_COUNT = 7
// The /forecast/best fan-out is a single (non-streaming) response, so real
// per-spot progress isn't observable. Ramp a bounded bar toward a cap over
// the expected cold-response window to convey motion without overpromising.
const PROGRESS_CAP = 92
const PROGRESS_TIME_CONSTANT_MS = 18000

export function BestVisibility({ onSelectSpot, units, totalSpotCount = 0 }: Props) {
  const [spots, setSpots] = useState<BestVisSpot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [failedCount, setFailedCount] = useState(0)
  const [partial, setPartial] = useState(false)
  const [progress, setProgress] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  // Compute today's date once at mount to avoid drift across midnight
  const [todayISO] = useState(() => new Date().toISOString().slice(0, 10))
  const [rankingDate, setRankingDate] = useState(todayISO)
  const todayDisplay = new Date(rankingDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setProgress(0)

    getBestVisibility({ refresh: reloadKey > 0 })
      .then(response => {
        if (controller.signal.aborted) return
        setSpots(response.spots)
        setFailedCount(response.failedCount ?? 0)
        setPartial(response.partial ?? false)
        setRankingDate(normalizeIsoDate(response.date ?? '') ?? todayISO)
        setLoading(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Unable to load visibility data')
          setLoading(false)
        }
      })

    return () => { controller.abort() }
  }, [reloadKey, todayISO])

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

  const winner = spots[0]
  const rest = spots.slice(1)
  const unitLabel = units === 'ft' ? 'feet' : 'metres'
  const displayVisibility = (metres: number) => units === 'ft' ? metresToFeet(metres) : metres
  const missingCount = totalSpotCount > 0 ? Math.max(0, totalSpotCount - spots.length) : failedCount
  const incomplete = partial || failedCount > 0 || missingCount > 0
  const leaderLabel = incomplete ? `Top of ${spots.length} returned` : 'Best today'

  return (
    <PageLayout
      eyebrow="Today’s coast"
      title="Best visibility"
      subtitle={loading
        ? 'Comparing forecast clarity across UK dive spots.'
        : incomplete
          ? 'Partial ranking — compare the forecasts that returned within the service window.'
          : 'Compare forecast clarity across UK dive spots, ranked with model confidence.'}
      contentClassName={styles.content}
    >
      {loading && (
        <div aria-busy="true">
          <div className={styles.progressBar} aria-hidden="true">
            <div className={styles.progressFill} style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <div className={styles.dateLabel}>{todayDisplay}</div>

          {/* Winner-sized skeleton first, so the leader result doesn't cause
              layout shift once real data resolves. */}
          <div className={styles.winnerSkeleton} aria-hidden="true">
            <div className={styles.skelWinnerBadge} />
            <div className={styles.skelWinnerName} />
            <div className={styles.skelWinnerVis} />
            <div className={styles.skelWinnerVerdict} />
          </div>

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

      {error && (
        <div className={styles.error} role="alert">
          <p>{error}. Your saved forecasts are unchanged.</p>
          <button type="button" className={styles.retryBtn} onClick={() => setReloadKey(key => key + 1)}>Try again</button>
        </div>
      )}

      {!loading && !error && winner && (
        <>
          <div className={styles.dateLabel}>{todayDisplay}</div>

          {incomplete && (
            <div className={styles.coverageNotice} role="status">
              <div>
                <strong>Partial ranking</strong>
                <span>
                  {spots.length}{totalSpotCount > 0 ? ` of ${totalSpotCount}` : ''} spots returned.
                  {missingCount > 0 && ` ${missingCount} forecast${missingCount !== 1 ? 's' : ''} did not finish in time.`}
                  {partial && missingCount === 0 && ' Some forecasts did not finish in time.'}
                </span>
              </div>
              <button type="button" className={styles.retryBtn} onClick={() => setReloadKey(key => key + 1)}>Retry missing spots</button>
            </div>
          )}

          {/* The winner — clear visual priority through type and spacing rather
              than another elevated dashboard card. */}
          {(() => {
            const vis = displayVisibility(winner.day.vis_corrected ?? winner.day.vis_estimate)
            const cc = safeColorClass(winner.day.color_class)
            return (
              <button
                type="button"
                className={styles.winnerCard}
                aria-label={`View forecast for ${winner.name}, ${incomplete ? 'the top returned spot' : 'the best-visibility spot today'} at ${vis.toFixed(1)} ${unitLabel}`}
                onClick={() => onSelectSpot(winner.lat, winner.lon, winner.name)}
              >
                <div className={styles.winnerBadge}>{leaderLabel}</div>
                <div className={styles.winnerBody}>
                  <div className={styles.winnerInfo}>
                    <div className={styles.winnerName}>{winner.name}</div>
                    <div className={`${styles.winnerVerdict} ${styles[cc]}`}>{winner.day.verdict}</div>
                  </div>
                  <div className={styles.winnerVisBlock}>
                    <div className={`${styles.winnerVisValue} ${styles[cc]}`}>{vis.toFixed(1)}</div>
                    <div className={styles.winnerVisUnit}>{unitLabel}</div>
                  </div>
                </div>
              </button>
            )
          })()}

          {rest.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Other spots</div>
              <div className={styles.list}>
                {rest.map((spot, i) => {
                  const vis = displayVisibility(spot.day.vis_corrected ?? spot.day.vis_estimate)
                  const cc = safeColorClass(spot.day.color_class)
                  return (
                    <button
                      type="button"
                      key={`${spot.lat}-${spot.lon}`}
                      className={styles.spotRow}
                      aria-label={`View forecast for ${spot.name} at ${vis.toFixed(1)} ${unitLabel}`}
                      onClick={() => onSelectSpot(spot.lat, spot.lon, spot.name)}
                    >
                      <div className={styles.rank}>{i + 2}</div>
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
                        <div className={styles.visUnit}>{unitLabel}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {!loading && !error && spots.length === 0 && (
        <div className={styles.error}>No visibility data available for today</div>
      )}

    </PageLayout>
  )
}
