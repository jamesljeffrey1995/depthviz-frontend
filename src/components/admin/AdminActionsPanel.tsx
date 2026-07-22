import { useState } from 'react'
import styles from './AdminConsole.module.css'

export interface AdminActionsPanelProps {
  onRefreshForecast: () => Promise<void>
  onRefreshSelectedSite: () => Promise<void>
  onTriggerRetrain: () => Promise<void>
  onRunOutlierCleaning: () => Promise<void>
  onExportReports: () => void
  selectedSiteName: string | null
  busy: boolean
  lastMessage: string | null
}

/**
 * Admin action grid.
 *
 * Actions with existing, wired backends (refresh forecast, retrain, outlier
 * cleaning) call the parent handlers. Actions with no backend yet (disable
 * site, sensor maintenance, clear stale alerts) are rendered as clearly-labelled
 * stubs so we don't ship destructive placeholders. Dangerous actions require a
 * second confirmation click.
 */
export function AdminActionsPanel({
  onRefreshForecast,
  onRefreshSelectedSite,
  onTriggerRetrain,
  onRunOutlierCleaning,
  onExportReports,
  selectedSiteName,
  busy,
  lastMessage,
}: AdminActionsPanelProps) {
  const [confirming, setConfirming] = useState<'retrain' | 'clean' | null>(null)

  const withConfirm = async (
    which: 'retrain' | 'clean',
    action: () => Promise<void>,
  ) => {
    if (confirming !== which) {
      setConfirming(which)
      return
    }
    setConfirming(null)
    await action()
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <span>Admin Actions</span>
        {lastMessage && <span className={styles.panelSub}>{lastMessage}</span>}
      </div>

      <div className={styles.actionGroup}>
        {/* Safe actions */}
        <div className={styles.actionCard}>
          <div className={styles.actionCardTitle}>Force forecast refresh</div>
          <div className={styles.actionCardBody}>
            Invalidate every cached forecast so the next public request re-fetches
            upstream weather / marine data.
          </div>
          <button className={styles.actionBtn} onClick={onRefreshForecast} disabled={busy}>
            Refresh all
          </button>
        </div>

        <div className={styles.actionCard}>
          <div className={styles.actionCardTitle}>Recalculate selected site</div>
          <div className={styles.actionCardBody}>
            {selectedSiteName
              ? `Flush cached forecast for ${selectedSiteName} only.`
              : 'Pick a site in the grid above to enable.'}
          </div>
          <button
            className={styles.actionBtn}
            onClick={onRefreshSelectedSite}
            disabled={busy || !selectedSiteName}
          >
            Recalculate
          </button>
        </div>

        <div className={styles.actionCard}>
          <div className={styles.actionCardTitle}>Export reports CSV</div>
          <div className={styles.actionCardBody}>
            Download the residuals table currently on screen as CSV for offline
            analysis. Runs client-side — no server round-trip.
          </div>
          <button className={styles.actionBtn} onClick={onExportReports}>
            Export CSV
          </button>
        </div>

        {/* Dangerous actions */}
        <div className={`${styles.actionCard} ${styles.actionCardDanger}`}>
          <div className={styles.actionCardTitle}>Trigger model retrain</div>
          <div className={styles.actionCardBody}>
            Runs a full calibration + bias retrain across every location.
            Takes seconds to minutes depending on report volume.
          </div>
          {confirming === 'retrain' ? (
            <div className={styles.actionConfirm}>
              Confirm retrain? This will replace the live calibration.
              <div className={styles.actionConfirmRow}>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={() => withConfirm('retrain', onTriggerRetrain)}
                  disabled={busy}
                >
                  Yes, retrain
                </button>
                <button className={styles.actionCancelBtn} onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => withConfirm('retrain', onTriggerRetrain)}
              disabled={busy}
            >
              Retrain…
            </button>
          )}
        </div>

        <div className={`${styles.actionCard} ${styles.actionCardDanger}`}>
          <div className={styles.actionCardTitle}>Re-run outlier cleaning</div>
          <div className={styles.actionCardBody}>
            Applies the full z-score + IQR cleaning pass and updates trust
            weights across all reports.
          </div>
          {confirming === 'clean' ? (
            <div className={styles.actionConfirm}>
              This can quarantine/restore many reports. Continue?
              <div className={styles.actionConfirmRow}>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={() => withConfirm('clean', onRunOutlierCleaning)}
                  disabled={busy}
                >
                  Yes, run cleaning
                </button>
                <button className={styles.actionCancelBtn} onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => withConfirm('clean', onRunOutlierCleaning)}
              disabled={busy}
            >
              Run cleaning…
            </button>
          )}
        </div>

        {/* Not-yet-wired actions rendered as inert stubs so the operator
            knows the capability is planned but not shippable. */}
        <div className={styles.actionCard}>
          <div className={styles.actionCardTitle}>Disable/enable site</div>
          <div className={styles.actionCardBody}>
            Toggle a site's active state in the forecast rotation.
          </div>
          <div className={styles.actionStub}>Not wired — TODO backend endpoint</div>
        </div>
        <div className={styles.actionCard}>
          <div className={styles.actionCardTitle}>Sensor maintenance mode</div>
          <div className={styles.actionCardBody}>
            Silence stale-sensor alerts while a probe is offline for service.
          </div>
          <div className={styles.actionStub}>Not wired — sensor ingestion pending</div>
        </div>
        <div className={styles.actionCard}>
          <div className={styles.actionCardTitle}>Clear stale alert</div>
          <div className={styles.actionCardBody}>
            Dismiss an alert that's already been triaged.
          </div>
          <div className={styles.actionStub}>Not wired — alerts are derived live</div>
        </div>
      </div>
    </div>
  )
}
