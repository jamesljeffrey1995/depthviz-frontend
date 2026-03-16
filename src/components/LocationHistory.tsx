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

export function LocationHistory({ locationId, locationName }: Props) {
  const [logs, setLogs] = useState<Log[]>([])
  const [reportCount, setReportCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    getLocationHistory(locationId)
      .then(data => {
        setLogs(data.logs)
        setReportCount(data.report_count)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId])

  if (loading) return <div className={styles.loading}>Loading dive logs...</div>

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
        {logs.map(log => {
          const isOpen = expanded === log.id
          const dateLabel = new Date(log.date).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
          })
          return (
            <div
              key={log.id}
              className={`${styles.logRow} ${isOpen ? styles.logOpen : ''}`}
              onClick={() => setExpanded(isOpen ? null : log.id)}
            >
              <div className={styles.logMain}>
                <div className={styles.logDate}>{dateLabel}</div>
                <div className={styles.logDiver}>{log.diver}</div>
                <div className={styles.logVis}>
                  <span className={styles.logActual}>{log.actual_vis.toFixed(1)}m</span>
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
  )
}