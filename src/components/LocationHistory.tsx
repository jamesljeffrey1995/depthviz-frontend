import { useState, useEffect } from 'react'
import { getLocationHistory } from '../lib/api'
import styles from './LocationHistory.module.css'

interface Props {
  locationId: number
  locationName: string
}

type Log = {
  id: number
  date: string
  diver: string
  actual_vis: number
  predicted_vis: number
  error: number
  wave_height: number | null
  swell_height: number | null
  wind_speed: number | null
  notes: string | null
}

function errorColor(err: number): string {
  const abs = Math.abs(err)
  if (abs <= 1) return 'var(--excellent)'
  if (abs <= 2.5) return 'var(--warn)'
  return 'var(--danger)'
}

/** Month/year heading for a group of logs, e.g. "July 2026". */
function monthLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** Group logs into contiguous runs sharing the same month/year — the log's
 *  existing order (whatever the API returns) is preserved, just clustered
 *  under a heading, so a long history reads as weeks/months rather than
 *  one undifferentiated flat list. */
function groupByMonth(logs: Log[]): { label: string; logs: Log[] }[] {
  const groups: { label: string; logs: Log[] }[] = []
  for (const log of logs) {
    const label = monthLabel(log.date)
    const current = groups[groups.length - 1]
    if (current && current.label === label) {
      current.logs.push(log)
    } else {
      groups.push({ label, logs: [log] })
    }
  }
  return groups
}

export function LocationHistory({ locationId, locationName }: Props) {
  const [logs, setLogs] = useState<Log[]>([])
  const [reportCount, setReportCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(false)
    getLocationHistory(locationId)
      .then(data => {
        setLogs(data.logs)
        setReportCount(data.report_count)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [locationId])

  if (loading) return <div className={styles.loading}>Loading dive logs...</div>

  if (error) return (
    <div className={styles.empty}>
      <div>Failed to load dive logs. Please try again later.</div>
    </div>
  )

  if (logs.length === 0) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>🤿</div>
      <div>No dive logs yet for {locationName}.<br />Be the first to log a dive!</div>
    </div>
  )

  const meanError = logs.reduce((s, l) => s + Math.abs(l.error), 0) / logs.length
  const meanActual = logs.reduce((s, l) => s + l.actual_vis, 0) / logs.length

  return (
    <div className={styles.container}>
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryVal}>{reportCount}</div>
          <div className={styles.summaryLbl}>Dive logs</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryVal}>{meanActual.toFixed(1)}m</div>
          <div className={styles.summaryLbl}>Avg visibility</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryVal} style={{ color: errorColor(-meanError) }}>
            ±{meanError.toFixed(1)}m
          </div>
          <div className={styles.summaryLbl}>Model accuracy</div>
        </div>
      </div>

      <div className={styles.logList}>
        {groupByMonth(logs).map(group => (
          <div key={group.label} className={styles.logGroup}>
            <div className={styles.groupLabel}>{group.label}</div>
            <div className={styles.groupRows}>
              {group.logs.map(log => {
                const isOpen = expanded === log.id
                const dateLabel = new Date(log.date).toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short'
                })
                return (
                  <div
                    key={log.id}
                    className={`${styles.logRow} ${isOpen ? styles.logOpen : ''}`}
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                  >
                    <div className={styles.logMain}>
                      <div className={styles.logPrimary}>
                        <span className={styles.logDate}>{dateLabel}</span>
                        <span className={styles.logActual}>{log.actual_vis.toFixed(1)}m</span>
                      </div>
                      <div className={styles.logSecondary}>
                        <span className={styles.logDiver}>{log.diver}</span>
                        <span className={styles.logPred}>pred {log.predicted_vis.toFixed(1)}m</span>
                        <span className={styles.logError} style={{ color: errorColor(log.error) }}>
                          {log.error > 0 ? '+' : ''}{log.error.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {isOpen && (
                      <div className={styles.logDetail}>
                        {(log.wave_height != null || log.swell_height != null || log.wind_speed != null) && (
                          <div className={styles.conditions}>
                            {log.wave_height != null && <span>Wave {log.wave_height.toFixed(1)}m</span>}
                            {log.swell_height != null && <span>Swell {log.swell_height.toFixed(1)}m</span>}
                            {log.wind_speed != null && <span>Wind {Math.round(log.wind_speed)}kn</span>}
                          </div>
                        )}
                        {log.notes && <div className={styles.notes}>"{log.notes}"</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}