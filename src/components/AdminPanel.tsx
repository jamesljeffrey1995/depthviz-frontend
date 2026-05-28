import { useState, useEffect, useCallback } from 'react'
import {
  getAdminStats,
  getOutlierPreview,
  runOutlierCleaning,
  getQuarantinedReports,
  restoreReport,
  getMLStatus,
  forceRetrain,
} from '../lib/api'
import type {
  AdminStats,
  OutlierPreview,
  CleaningResult,
  QuarantinedReport,
  MLStatus,
  MLRetrainResult,
} from '../types'
import { MLCharts } from './MLCharts'
import styles from './AdminPanel.module.css'

interface AdminPanelProps {
  onBack?: () => void
}

type Tab = 'overview' | 'quarantined' | 'clean' | 'ml'

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [preview, setPreview] = useState<OutlierPreview | null>(null)
  const [cleanResult, setCleanResult] = useState<CleaningResult | null>(null)
  const [quarantined, setQuarantined] = useState<QuarantinedReport[]>([])
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null)
  const [retrainResult, setRetrainResult] = useState<MLRetrainResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const s = await getAdminStats()
      setStats(s)
    } catch (e) {
      setError('Failed to load admin stats')
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const handlePreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const p = await getOutlierPreview()
      setPreview(p)
    } catch (e) {
      setError('Failed to load outlier preview')
    } finally {
      setLoading(false)
    }
  }

  const handleClean = async () => {
    setLoading(true)
    setError(null)
    setCleanResult(null)
    try {
      const result = await runOutlierCleaning()
      setCleanResult(result)
      await loadStats()
    } catch (e) {
      setError('Failed to run outlier cleaning')
    } finally {
      setLoading(false)
    }
  }

  const loadQuarantined = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getQuarantinedReports()
      setQuarantined(data.reports)
    } catch (e) {
      setError('Failed to load quarantined reports')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (id: number) => {
    try {
      await restoreReport(id)
      setQuarantined(prev => prev.filter(r => r.id !== id))
      await loadStats()
    } catch (e) {
      setError('Failed to restore report')
    }
  }

  const loadMLStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMLStatus()
      setMlStatus(data)
    } catch (e) {
      setError('Failed to load ML status')
    } finally {
      setLoading(false)
    }
  }

  const handleRetrain = async () => {
    setLoading(true)
    setError(null)
    setRetrainResult(null)
    try {
      const result = await forceRetrain()
      setRetrainResult(result)
      await loadMLStatus()
    } catch (e) {
      setError('Failed to retrain model')
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    if (t === 'quarantined') loadQuarantined()
    if (t === 'clean') { setPreview(null); setCleanResult(null) }
    if (t === 'ml') { setRetrainResult(null); loadMLStatus() }
  }

  return (
    <div className={styles.panel}>
      {onBack && (
        <button className={styles.backBtn} onClick={onBack}>
          &larr; Back
        </button>
      )}

      <h2 className={styles.title}>Data Admin</h2>

      {/* Stats overview */}
      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statVal}>{stats.total_reports}</div>
            <div className={styles.statLbl}>Total Reports</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>{stats.active_reports}</div>
            <div className={styles.statLbl}>Active</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal} style={{ color: stats.quarantined_reports > 0 ? 'var(--danger)' : 'var(--text-bright)' }}>
              {stats.quarantined_reports}
            </div>
            <div className={styles.statLbl}>Quarantined</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>{stats.quarantine_rate}%</div>
            <div className={styles.statLbl}>Rate</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['overview', 'quarantined', 'clean', 'ml'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => handleTabChange(t)}
          >
            {t === 'overview' ? 'Overview' : t === 'quarantined' ? 'Quarantined' : t === 'clean' ? 'Clean Outliers' : 'ML Model'}
          </button>
        ))}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Overview tab */}
      {tab === 'overview' && stats && (
        <div className={styles.section}>
          <p className={styles.info}>
            The outlier detection system uses a two-pass approach: z-score analysis within
            sliding time windows (&plusmn;3 days) and IQR-based detection across all reports
            per location. Reports beyond 2.5 standard deviations or 2&times; IQR are quarantined.
          </p>
          <div className={styles.statDetail}>
            <span>Total locations:</span>
            <span className={styles.statDetailVal}>{stats.total_locations}</span>
          </div>
        </div>
      )}

      {/* Quarantined tab */}
      {tab === 'quarantined' && (
        <div className={styles.section}>
          {loading && <div className={styles.loading}>Loading...</div>}
          {!loading && quarantined.length === 0 && (
            <div className={styles.empty}>No quarantined reports</div>
          )}
          {quarantined.map(r => {
            const delta = r.actual_vis - r.predicted_vis
            const deltaStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}m vs predicted`
            return (
              <div key={r.id} className={styles.reportRow}>
                <div className={styles.reportMeta}>
                  <span className={styles.reportLoc}>{r.location_name}</span>
                  <span className={styles.reportDate}>{r.report_date}</span>
                </div>
                <div className={styles.reportData}>
                  <span className={styles.reportVis}>{r.actual_vis.toFixed(1)}m</span>
                  <span className={styles.reportPred}>pred: {r.predicted_vis.toFixed(1)}m</span>
                  {r.notes && <span className={styles.reportNotes}>{r.notes.slice(0, 60)}</span>}
                </div>
                <div className={styles.quarantineReason}>
                  {r.quarantine_reason ?? deltaStr}
                </div>
                <button className={styles.restoreBtn} onClick={() => handleRestore(r.id)}>
                  Restore
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Clean tab */}
      {tab === 'clean' && (
        <div className={styles.section}>
          <div className={styles.actionRow}>
            <button
              className={styles.previewBtn}
              onClick={handlePreview}
              disabled={loading}
            >
              {loading ? 'Working...' : 'Preview Changes'}
            </button>
            <button
              className={styles.cleanBtn}
              onClick={handleClean}
              disabled={loading}
            >
              {loading ? 'Working...' : 'Run Cleaning'}
            </button>
          </div>

          {preview && !cleanResult && (
            <div className={styles.previewResult}>
              <div className={styles.previewHeader}>Preview — dry run</div>
              <div className={styles.previewStats}>
                <div>Reports scanned: <strong>{preview.total_reports}</strong></div>
                <div>Locations: <strong>{preview.locations}</strong></div>
                <div style={{ color: preview.would_quarantine_count > 0 ? 'var(--danger)' : 'var(--text)' }}>
                  Would quarantine: <strong>{preview.would_quarantine_count}</strong>
                </div>
                <div style={{ color: preview.would_restore_count > 0 ? 'var(--excellent)' : 'var(--text)' }}>
                  Would restore: <strong>{preview.would_restore_count}</strong>
                </div>
              </div>
              {preview.would_quarantine.length > 0 && (
                <div className={styles.previewList}>
                  <div className={styles.previewListHeader}>Would quarantine:</div>
                  {preview.would_quarantine.slice(0, 20).map(item => (
                    <div key={item.id} className={styles.previewItem}>
                      #{item.id} — {item.report_date} — {item.actual_vis.toFixed(1)}m
                    </div>
                  ))}
                  {preview.would_quarantine.length > 20 && (
                    <div className={styles.previewMore}>...and {preview.would_quarantine.length - 20} more</div>
                  )}
                </div>
              )}
              {preview.would_restore.length > 0 && (
                <div className={styles.previewList}>
                  <div className={styles.previewListHeader} style={{ color: 'var(--excellent)' }}>Would restore:</div>
                  {preview.would_restore.slice(0, 20).map(item => (
                    <div key={item.id} className={styles.previewItem}>
                      #{item.id} — {item.report_date} — {item.actual_vis.toFixed(1)}m
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {cleanResult && (
            <div className={styles.cleanResult}>
              <div className={styles.cleanHeader}>Cleaning Complete</div>
              <div className={styles.cleanStats}>
                <div>Reports scanned: <strong>{cleanResult.total_reports_scanned}</strong></div>
                <div>Locations: <strong>{cleanResult.locations_scanned}</strong></div>
                <div style={{ color: cleanResult.newly_quarantined > 0 ? 'var(--danger)' : 'var(--text)' }}>
                  Newly quarantined: <strong>{cleanResult.newly_quarantined}</strong>
                </div>
                <div style={{ color: cleanResult.newly_restored > 0 ? 'var(--excellent)' : 'var(--text)' }}>
                  Restored: <strong>{cleanResult.newly_restored}</strong>
                </div>
                <div>Trust weights updated: <strong>{cleanResult.trust_weights_updated}</strong></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ML Model tab */}
      {tab === 'ml' && (
        <div className={styles.section}>
          {loading && !mlStatus && <div className={styles.loading}>Loading ML status...</div>}

          {mlStatus && (
            <>
              {/* Global calibration multipliers */}
              <div className={styles.previewResult}>
                <div className={styles.previewHeader}>Calibration Multipliers</div>
                {mlStatus.calibration ? (
                  <div className={styles.previewStats}>
                    <div>Swell: <strong style={{ color: Math.abs(mlStatus.calibration.swell_multiplier - 1.0) > 0.2 ? 'var(--danger)' : 'var(--text-bright)' }}>
                      {mlStatus.calibration.swell_multiplier.toFixed(3)}
                    </strong></div>
                    <div>Wind: <strong style={{ color: Math.abs(mlStatus.calibration.wind_multiplier - 1.0) > 0.2 ? 'var(--danger)' : 'var(--text-bright)' }}>
                      {mlStatus.calibration.wind_multiplier.toFixed(3)}
                    </strong></div>
                    <div>Rain: <strong style={{ color: Math.abs(mlStatus.calibration.rain_multiplier - 1.0) > 0.2 ? 'var(--danger)' : 'var(--text-bright)' }}>
                      {mlStatus.calibration.rain_multiplier.toFixed(3)}
                    </strong></div>
                    <div>Global AI offset: <strong style={{ color: Math.abs(mlStatus.calibration.global_bias_offset) > 0.5 ? 'var(--danger)' : 'var(--text-bright)' }}>
                      {mlStatus.calibration.global_bias_offset > 0 ? '+' : ''}{mlStatus.calibration.global_bias_offset.toFixed(3)}m
                    </strong></div>
                    <div>Training samples: <strong>{mlStatus.calibration.sample_count}</strong></div>
                    {mlStatus.calibration.updated_at && (
                      <div style={{ opacity: 0.5 }}>Last trained: {new Date(mlStatus.calibration.updated_at).toLocaleString()}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ opacity: 0.5, fontSize: '11px' }}>No calibration data yet — not enough reports</div>
                )}
              </div>

              {/* Evaluation metrics */}
              <div className={styles.previewResult}>
                <div className={styles.previewHeader}>Evaluation Metrics (held-out, cross-validated)</div>
                <div className={styles.previewStats}>
                  <div>MAE: <strong>{mlStatus.live_metrics.mae?.toFixed(3) ?? '—'}</strong> m</div>
                  <div>RMSE: <strong>{mlStatus.live_metrics.rmse?.toFixed(3) ?? '—'}</strong> m</div>
                  <div>R²: <strong style={{ color: (mlStatus.live_metrics.r2 ?? 0) > 0.3 ? 'var(--excellent)' : (mlStatus.live_metrics.r2 ?? 0) > 0 ? 'var(--text-bright)' : 'var(--danger)' }}>
                    {mlStatus.live_metrics.r2?.toFixed(3) ?? '—'}
                  </strong></div>
                  <div>Evaluated on: <strong>{mlStatus.live_metrics.n}</strong> reports</div>
                </div>
                {mlStatus.live_metrics.baseline_rmse != null && (() => {
                  const lm = mlStatus.live_metrics
                  const baseRmse = lm.baseline_rmse as number
                  const corrRmse = lm.rmse
                  const improves = corrRmse != null && corrRmse < baseRmse
                  const deltaPct = corrRmse != null && baseRmse > 0
                    ? ((baseRmse - corrRmse) / baseRmse) * 100
                    : null
                  return (
                    <>
                      <div className={styles.previewHeader} style={{ marginTop: 8 }}>
                        Baseline (no correction)
                      </div>
                      <div className={styles.previewStats}>
                        <div>MAE: <strong>{lm.baseline_mae?.toFixed(3) ?? '—'}</strong> m</div>
                        <div>RMSE: <strong>{baseRmse.toFixed(3)}</strong> m</div>
                        <div>R²: <strong>{lm.baseline_r2?.toFixed(3) ?? '—'}</strong></div>
                      </div>
                      <div style={{ marginTop: 6, color: improves ? 'var(--excellent)' : 'var(--danger)' }}>
                        {improves
                          ? `Correction improves RMSE by ${deltaPct?.toFixed(0)}% vs raw physics`
                          : 'Correction does NOT beat raw physics — likely overfitting / too little data'}
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Charts */}
              <MLCharts trainingLog={mlStatus.training_log} />

              {/* Bias summary */}
              <div className={styles.previewResult}>
                <div className={styles.previewHeader}>Per-Location Bias</div>
                <div className={styles.previewStats}>
                  <div>Locations with bias: <strong>{mlStatus.bias_summary.count}</strong></div>
                  <div>Avg bias offset: <strong>{mlStatus.bias_summary.avg_bias_offset?.toFixed(3) ?? '—'}</strong> m</div>
                  <div>Avg R²: <strong>{mlStatus.bias_summary.avg_r2_score?.toFixed(3) ?? '—'}</strong></div>
                  <div>Total bias samples: <strong>{mlStatus.bias_summary.total_samples}</strong></div>
                </div>
                {mlStatus.bias_details.length > 0 && (
                  <div className={styles.previewList}>
                    <div className={styles.previewListHeader} style={{ color: 'var(--accent)' }}>Per-location detail:</div>
                    {mlStatus.bias_details.slice(0, 20).map(b => (
                      <div key={b.location_id} className={styles.previewItem}>
                        {b.location_name}: offset={b.bias_offset.toFixed(2)}m, R²={b.r2_score?.toFixed(3) ?? '—'}, n={b.sample_count}
                      </div>
                    ))}
                    {mlStatus.bias_details.length > 20 && (
                      <div className={styles.previewMore}>...and {mlStatus.bias_details.length - 20} more</div>
                    )}
                  </div>
                )}
              </div>

              {/* Training log */}
              {mlStatus.training_log.length > 0 && (
                <div className={styles.previewResult}>
                  <div className={styles.previewHeader}>Recent Training Runs</div>
                  <div className={styles.previewList}>
                    {mlStatus.training_log.map((lg, i) => (
                      <div key={i} className={styles.previewItem}>
                        [{lg.trigger}] {new Date(lg.created_at).toLocaleString()} — MAE={lg.global_mae?.toFixed(3) ?? '—'}, {lg.locations_updated} locs, {lg.duration_ms}ms
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Retrain button */}
              <div className={styles.actionRow}>
                <button
                  className={styles.previewBtn}
                  onClick={handleRetrain}
                  disabled={loading}
                >
                  {loading ? 'Retraining...' : 'Force Retrain'}
                </button>
              </div>

              {retrainResult && (
                <div className={styles.cleanResult}>
                  <div className={styles.cleanHeader}>Retraining Complete</div>
                  <div className={styles.cleanStats}>
                    <div>Locations updated: <strong>{retrainResult.locations_updated}</strong></div>
                    <div>Duration: <strong>{retrainResult.duration_ms}ms</strong></div>
                    <div>MAE: <strong>{retrainResult.metrics.mae?.toFixed(3) ?? '—'}</strong></div>
                    <div>RMSE: <strong>{retrainResult.metrics.rmse?.toFixed(3) ?? '—'}</strong></div>
                    <div>R²: <strong>{retrainResult.metrics.r2?.toFixed(3) ?? '—'}</strong></div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
