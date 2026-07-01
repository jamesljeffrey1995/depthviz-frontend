import type { QuarantinedReport, MLResidual } from '../../types'
import { StatusChip } from './StatusChip'
import { signedNum } from './formatters'
import styles from './AdminConsole.module.css'

interface Props {
  /** Worst-fitting residuals surface disagreement between the model and recent
   *  reports — the most operationally useful "reports admin" view we can build
   *  from data already exposed by /admin/ml/predictions. */
  residuals: MLResidual[]
  /** Currently-quarantined reports live under a separate feed. */
  quarantined: QuarantinedReport[]
  onQuarantine: (id: number) => void
  onRestore: (id: number) => void
}

/**
 * Combined reports admin panel. Column set is deliberately dense —
 * date, site, actual vs predicted, error, trust weight, action buttons —
 * so an operator can scan a long list and act row-by-row.
 */
export function ReportsTable({ residuals, quarantined, onQuarantine, onRestore }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <span>Reports Admin</span>
        <span className={styles.panelSub}>
          {residuals.length} worst-fitting · {quarantined.length} quarantined
        </span>
      </div>

      <div className={styles.panelSub}>Worst-fitting active reports</div>
      {residuals.length === 0 ? (
        <div className={styles.emptyMsg}>No residuals to review.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.reportsTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th className={styles.num}>Actual</th>
                <th className={styles.num}>Predicted</th>
                <th className={styles.num}>Δ</th>
                <th className={styles.num}>Trust</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {residuals.slice(0, 10).map(r => {
                const disagrees = Math.abs(r.error) >= 2.0
                return (
                  <tr key={r.id} className={disagrees ? styles.reportRowDisagree : ''}>
                    <td>{r.date}</td>
                    <td>{r.location}</td>
                    <td className={styles.num}>{r.actual.toFixed(1)}m</td>
                    <td className={styles.num}>{r.predicted.toFixed(1)}m</td>
                    <td className={styles.num}>{signedNum(r.error, 1, 'm')}</td>
                    <td className={styles.num}>{r.trust_weight.toFixed(2)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={styles.rowActionBtn}
                          onClick={() => onQuarantine(r.id)}
                          title="Mark as suspicious (quarantine)"
                        >
                          Quarantine
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {quarantined.length > 0 && (
        <>
          <div className={styles.panelSub} style={{ marginTop: 8 }}>Quarantined</div>
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.reportsTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Site</th>
                  <th className={styles.num}>Actual</th>
                  <th className={styles.num}>Predicted</th>
                  <th>Reason</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {quarantined.slice(0, 10).map(r => (
                  <tr key={r.id}>
                    <td>{r.report_date}</td>
                    <td>{r.location_name}</td>
                    <td className={styles.num}>{r.actual_vis.toFixed(1)}m</td>
                    <td className={styles.num}>{r.predicted_vis.toFixed(1)}m</td>
                    <td>
                      {/* FAILED = hard-rejection chip; the actual cause (outlier,
                          manual triage, etc.) is shown next to it so operators
                          don't misread "STALE" as merely old data. */}
                      <StatusChip status="FAILED" dot={false} />
                      <span style={{ marginLeft: 6, opacity: 0.7 }}>
                        {r.quarantine_reason ?? 'outlier'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={styles.rowActionBtn}
                          onClick={() => onRestore(r.id)}
                          title="Restore to active reports"
                        >
                          Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
