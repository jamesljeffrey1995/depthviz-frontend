import { useState } from 'react'
import { MLCharts } from '../MLCharts'
import type { MLStatus } from '../../types'
import { formatDateTime, formatNum } from './formatters'
import { StatusChip } from './StatusChip'
import styles from './AdminConsole.module.css'

/**
 * Existing model analytics, reorganised into a collapsible so it doesn't
 * dominate the top of the console. Reuses the MLCharts component — no chart
 * changes needed for this redesign.
 */
export function ModelDiagnostics({ mlStatus }: { mlStatus: MLStatus | null }) {
  const [open, setOpen] = useState(false)
  const cal = mlStatus?.calibration
  const summary = mlStatus?.bias_summary
  const live = mlStatus?.live_metrics

  return (
    <div className={styles.collapse}>
      <button
        type="button"
        className={styles.collapseToggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>Model Diagnostics</span>
        <span className={styles.panelSub}>
          {cal ? `cal-${cal.sample_count}` : 'uncalibrated'} · click to {open ? 'hide' : 'expand'}
        </span>
      </button>
      {open && (
        <div className={styles.collapseBody}>
          {!mlStatus ? (
            <div className={styles.loading}>Loading model status…</div>
          ) : (
            <>
              <div className={styles.healthGrid}>
                <div className={styles.healthCard}>
                  <div className={styles.healthCardLbl}>Calibration multipliers</div>
                  <div className={styles.healthCardVal}>
                    swell {formatNum(cal?.swell_multiplier, 2)}
                  </div>
                  <div className={styles.healthCardMeta}>
                    wind {formatNum(cal?.wind_multiplier, 2)} · rain {formatNum(cal?.rain_multiplier, 2)}
                  </div>
                </div>
                <div className={styles.healthCard}>
                  <div className={styles.healthCardLbl}>Global bias offset</div>
                  <div className={styles.healthCardVal}>
                    {cal ? `${cal.global_bias_offset >= 0 ? '+' : ''}${cal.global_bias_offset.toFixed(2)}m` : '—'}
                  </div>
                  <div className={styles.healthCardMeta}>
                    sample count {cal?.sample_count ?? 0}
                  </div>
                </div>
                <div className={styles.healthCard}>
                  <div className={styles.healthCardLbl}>Live metrics</div>
                  <div className={styles.healthCardVal}>
                    R² {formatNum(live?.r2, 2)}
                  </div>
                  <div className={styles.healthCardMeta}>
                    MAE {formatNum(live?.mae, 2, 'm')} · RMSE {formatNum(live?.rmse, 2, 'm')} · n={live?.n ?? 0}
                  </div>
                </div>
                <div className={styles.healthCard}>
                  <div className={styles.healthCardLbl}>Site bias summary</div>
                  <div className={styles.healthCardVal}>
                    {summary?.count ?? 0} sites
                  </div>
                  <div className={styles.healthCardMeta}>
                    avg R² {formatNum(summary?.avg_r2_score, 2)} · {summary?.total_samples ?? 0} samples
                  </div>
                </div>
                <div className={styles.healthCard}>
                  <div className={styles.healthCardLbl}>Last retrain</div>
                  <div className={styles.healthCardVal}>
                    {formatDateTime(cal?.updated_at)}
                  </div>
                  <div className={styles.healthCardMeta}>
                    {mlStatus.training_log[0]?.trigger ?? '—'}
                  </div>
                </div>
                <div className={styles.healthCard}>
                  <div className={styles.healthCardLbl}>Beats baseline?</div>
                  <div className={styles.healthCardVal}>
                    {baselineChip(live)}
                  </div>
                  <div className={styles.healthCardMeta}>
                    baseline RMSE {formatNum(live?.baseline_rmse, 2, 'm')}
                  </div>
                </div>
              </div>

              {/* Existing chart deck — kept intact so diagnostics don't regress. */}
              <div style={{ marginTop: 12 }}>
                <MLCharts trainingLog={mlStatus.training_log} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function baselineChip(live: MLStatus['live_metrics'] | undefined) {
  if (!live || live.baseline_rmse == null || live.rmse == null) {
    return <StatusChip status="UNKNOWN" dot={false} />
  }
  return <StatusChip status={live.rmse < live.baseline_rmse ? 'TRUSTED' : 'LOW CONFIDENCE'} dot={false} />
}
