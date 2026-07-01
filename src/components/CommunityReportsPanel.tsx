import { useEffect, useState } from 'react'
import { getLocationHistory } from '../lib/api'
import type { LocationHistoryLog } from '../types'
import styles from './CommunityReportsPanel.module.css'

interface Props {
  locationId: number | null
  locationName: string
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

function daysAgo(dateStr: string): number {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  const t = new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
  return Math.round((Date.now() - t) / 86400000)
}

function deltaClass(delta: number): string {
  const abs = Math.abs(delta)
  if (abs <= 1) return styles.deltaGood
  if (abs <= 2.5) return styles.deltaBad
  return styles.deltaVeryBad
}

/** Recent community reports for the currently selected spot. Renders a short
 *  summary line comparing reports vs the model so users can gauge trust. */
export function CommunityReportsPanel({ locationId, locationName }: Props) {
  const [logs, setLogs] = useState<LocationHistoryLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (locationId == null) { setLogs([]); return }
    let cancelled = false
    // Drop the previous location's logs before the new fetch resolves so the
    // summary line never briefly shows another spot's numbers.
    setLogs([])
    setLoading(true)
    setError(false)
    getLocationHistory(locationId)
      .then((data) => { if (!cancelled) setLogs(data.logs.slice(0, 6)) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [locationId])

  if (locationId == null) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>Community reports</div>
        </div>
        <div className={styles.empty}>
          Save this spot to see and log community reports.
          <div className={styles.emptyHint}>Reports sharpen the model with real dive observations.</div>
        </div>
      </div>
    )
  }

  const recent = logs.filter((l) => daysAgo(l.date) <= 30)
  const agree = recent.filter((l) => Math.abs(l.error) <= 1.5).length
  const summary = recent.length === 0
    ? 'No community reports in the last 30 days — model relies on satellite + swell data only.'
    : agree >= recent.length * 0.66
      ? `${recent.length} recent report${recent.length === 1 ? '' : 's'} near ${locationName} broadly agree with the model.`
      : `${recent.length} recent report${recent.length === 1 ? '' : 's'} — some disagree with the model, so treat the number as a guide.`

  return (
    <div className={styles.panel} aria-label={`Community reports for ${locationName}`}>
      <div className={styles.header}>
        <div className={styles.title}>Community reports</div>
        {logs.length > 0 && <div className={styles.meta}>{logs.length} most recent</div>}
      </div>

      <div className={styles.summary}>{summary}</div>

      {loading && <div className={styles.empty}>Loading recent reports…</div>}
      {error && <div className={styles.empty}>Could not load reports right now.</div>}

      {!loading && !error && logs.length > 0 && (
        <ul className={styles.list}>
          {logs.map((log) => (
            <li key={log.id} className={styles.item}>
              <div className={styles.date} title={log.date}>
                {formatDate(log.date)}
              </div>
              <div className={styles.body}>
                <span className={styles.diver}>{log.diver}</span>
                <span>reported</span>
                {log.notes && <span className={styles.note}>“{log.notes}”</span>}
              </div>
              <div>
                <div className={styles.vis}>{log.actual_vis.toFixed(1)}m</div>
                <div className={styles.visUnit}>Reported</div>
                <div className={`${styles.delta} ${deltaClass(log.error)}`}>
                  {log.error === 0 ? 'matches model' : `${log.error > 0 ? '+' : ''}${log.error.toFixed(1)}m vs model`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
