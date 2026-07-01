import type { AdminForecastDebug } from '../../types'
import { StatusChip } from './StatusChip'
import { formatRelative, signedNum } from './formatters'
import styles from './AdminConsole.module.css'

/**
 * "Why this prediction?" panel — a walk-through of the model math for the
 * selected site: base visibility, each penalty term, ML corrections, final
 * prediction, plus a plain-English summary and report-agreement note.
 */
export function ForecastBreakdown({ debug, loading }: { debug: AdminForecastDebug | null; loading: boolean }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <span>Why This Prediction?</span>
        {debug && <StatusChip status={debug.confidence} />}
      </div>

      {loading && !debug && <div className={styles.loading}>Calculating breakdown…</div>}
      {!loading && !debug && <div className={styles.emptyMsg}>Select a site to see the model breakdown.</div>}

      {debug && (
        <>
          <div className={styles.panelSub}>
            {debug.location_name} · obs {debug.obs_date ? formatRelative(debug.obs_date + 'T00:00:00Z') : 'n/a'}
          </div>

          <div className={styles.breakdown}>
            {debug.steps.map((s, i) => (
              <div
                key={`${s.label}-${i}`}
                className={`${styles.breakdownStep} ${stepClass(s.kind)}`}
              >
                <span className={styles.breakdownLbl}>{s.label}</span>
                <span className={styles.breakdownVal}>
                  {s.kind === 'base' || s.kind === 'final' || s.kind === 'info'
                    ? `${s.value.toFixed(2)}m`
                    : signedNum(s.value, 2, 'm')}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.driverGroup}>
            <div>
              <div className={styles.driverGroupTitle}>Main negative drivers</div>
              {(debug.main_negative_drivers ?? []).map(d => (
                <div className={styles.driverItem} key={`neg-${d.label}`}>
                  {d.label}: {signedNum(d.value, 2, 'm')}
                </div>
              ))}
              {(debug.main_negative_drivers ?? []).length === 0 && (
                <div className={styles.driverItem} style={{ opacity: 0.5 }}>none</div>
              )}
            </div>
            <div>
              <div className={styles.driverGroupTitle}>Main positive drivers</div>
              {(debug.main_positive_drivers ?? []).map(d => (
                <div className={styles.driverItem} key={`pos-${d.label}`}>
                  {d.label}: {signedNum(d.value, 2, 'm')}
                </div>
              ))}
              {(debug.main_positive_drivers ?? []).length === 0 && (
                <div className={styles.driverItem} style={{ opacity: 0.5 }}>none</div>
              )}
            </div>
          </div>

          <div className={styles.summary}>{summarise(debug)}</div>
        </>
      )}
    </div>
  )
}

function stepClass(kind: AdminForecastDebug['steps'][number]['kind']): string {
  switch (kind) {
    case 'base':       return styles.stepBase
    case 'penalty':    return styles.stepPenalty
    case 'correction': return styles.stepCorrection
    case 'final':      return styles.stepFinal
    default:           return ''
  }
}

function summarise(debug: AdminForecastDebug): string {
  if (debug.summary) return debug.summary
  const parts: string[] = []
  parts.push(
    `Final ${debug.final_prediction.toFixed(1)}m; confidence ${debug.confidence.toLowerCase()}.`,
  )
  if (debug.main_negative_drivers && debug.main_negative_drivers.length > 0) {
    const top = debug.main_negative_drivers[0]
    parts.push(`Biggest reduction: ${top.label.toLowerCase()} (${signedNum(top.value, 1, 'm')}).`)
  }
  if (debug.reports_note) {
    parts.push(debug.reports_note)
  } else if (debug.site_sample_count === 0) {
    parts.push('No local reports yet — model runs on physics + global calibration only.')
  }
  return parts.join(' ')
}
