import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getAdminStats,
  getDataOverview,
  getOutlierPreview,
  runOutlierCleaning,
  getQuarantinedReports,
  restoreReport,
  getMLStatus,
  forceRetrain,
} from '../lib/api'
import type {
  AdminStats,
  DataOverview,
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

// Log the diagnostic and return a user-facing message. Previously every
// `catch (e)` discarded `e` entirely (issue #169) — losing the real cause and
// tripping the unused-binding lint.
function describeError(e: unknown, fallback: string): string {
  console.error(fallback, e)
  return e instanceof Error && e.message ? `${fallback}: ${e.message}` : fallback
}

const NF = new Intl.NumberFormat()

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [overview, setOverview] = useState<DataOverview | null>(null)
  const [preview, setPreview] = useState<OutlierPreview | null>(null)
  const [cleanResult, setCleanResult] = useState<CleaningResult | null>(null)
  const [quarantined, setQuarantined] = useState<QuarantinedReport[]>([])
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null)
  const [retrainResult, setRetrainResult] = useState<MLRetrainResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Monotonic request id. A tab switch (or reload) bumps this; each async
  // loader captures the value at start and only writes state/clears `loading`
  // if it is still the latest in-flight request. Prevents a slow earlier
  // request's `finally` from clearing the spinner for a newer one, or stale
  // data from one tab landing in another (issue #169).
  const reqId = useRef(0)
  // Stable across renders (only touch the ref and stable state setters) so
  // they can be safely listed in the memoized loaders' dependency arrays.
  const beginRequest = useCallback(() => {
    setError(null)
    setLoading(true)
    reqId.current += 1
    return reqId.current
  }, [])
  const isCurrent = useCallback((id: number) => reqId.current === id, [])
  const endRequest = useCallback((id: number) => {
    if (reqId.current === id) setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    try {
      setStats(await getAdminStats())
    } catch (e) {
      setError(describeError(e, 'Failed to load admin stats'))
    }
  }, [])

  const loadOverview = useCallback(async () => {
    const id = beginRequest()
    try {
      const data = await getDataOverview()
      if (isCurrent(id)) setOverview(data)
    } catch (e) {
      if (isCurrent(id)) setError(describeError(e, 'Failed to load data overview'))
    } finally {
      endRequest(id)
    }
  }, [beginRequest, isCurrent, endRequest])

  useEffect(() => { loadStats(); loadOverview() }, [loadStats, loadOverview])

  const handlePreview = async () => {
    const id = beginRequest()
    try {
      const p = await getOutlierPreview()
      if (isCurrent(id)) setPreview(p)
    } catch (e) {
      if (isCurrent(id)) setError(describeError(e, 'Failed to load outlier preview'))
    } finally {
      endRequest(id)
    }
  }

  const handleClean = async () => {
    const id = beginRequest()
    setCleanResult(null)
    try {
      const result = await runOutlierCleaning()
      if (isCurrent(id)) setCleanResult(result)
      await loadStats()
    } catch (e) {
      if (isCurrent(id)) setError(describeError(e, 'Failed to run outlier cleaning'))
    } finally {
      endRequest(id)
    }
  }

  const loadQuarantined = async () => {
    const id = beginRequest()
    try {
      const data = await getQuarantinedReports()
      if (isCurrent(id)) setQuarantined(data.reports)
    } catch (e) {
      if (isCurrent(id)) setError(describeError(e, 'Failed to load quarantined reports'))
    } finally {
      endRequest(id)
    }
  }

  const handleRestore = async (id: number) => {
    try {
      await restoreReport(id)
      setQuarantined(prev => prev.filter(r => r.id !== id))
      await loadStats()
    } catch (e) {
      setError(describeError(e, 'Failed to restore report'))
    }
  }

  const loadMLStatus = async () => {
    const id = beginRequest()
    try {
      const data = await getMLStatus()
      if (isCurrent(id)) setMlStatus(data)
    } catch (e) {
      if (isCurrent(id)) setError(describeError(e, 'Failed to load ML status'))
    } finally {
      endRequest(id)
    }
  }

  const handleRetrain = async () => {
    const id = beginRequest()
    setRetrainResult(null)
    try {
      const result = await forceRetrain()
      if (isCurrent(id)) setRetrainResult(result)
      await loadMLStatus()
    } catch (e) {
      if (isCurrent(id)) setError(describeError(e, 'Failed to retrain model'))
    } finally {
      endRequest(id)
    }
  }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    // Bump the request id so any in-flight loader from the previous tab is
    // ignored when it resolves.
    reqId.current += 1
    setLoading(false)
    setError(null)
    if (t === 'overview') loadOverview()
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
      {tab === 'overview' && (
        <div className={styles.section}>
          {loading && !overview && <div className={styles.loading}>Loading data overview...</div>}

          {overview && <DataOverviewDashboard data={overview} />}

          <p className={styles.info}>
            The outlier detection system uses a two-pass approach: z-score analysis within
            sliding time windows (&plusmn;3 days) and IQR-based detection across all reports
            per location. Reports beyond 2.5 standard deviations or 2&times; IQR are quarantined.
          </p>
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
                    {mlStatus.training_log.map(lg => (
                      <div key={`${lg.created_at}-${lg.trigger}`} className={styles.previewItem}>
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

// ── Data overview dashboard ──────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function daysAgo(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff}d ago`
}

interface DataOverviewDashboardProps {
  data: DataOverview
}

function DataOverviewDashboard({ data }: DataOverviewDashboardProps) {
  const { volume, growth, freshness, quality, disputes_by_status, coverage, contributors, activity } = data
  const maxActivity = Math.max(1, ...activity.map(a => a.count))
  const maxLocReports = Math.max(1, ...coverage.top_locations.map(l => l.report_count))

  const metrics: { val: string; lbl: string; sub?: string }[] = [
    { val: NF.format(volume.total_reports), lbl: 'Reports', sub: `+${growth.reports_7d} this week` },
    { val: NF.format(volume.total_locations), lbl: 'Locations', sub: `${coverage.locations_with_reports} with data` },
    { val: NF.format(volume.total_users), lbl: 'Users', sub: `+${growth.new_users_30d} in 30d` },
    { val: NF.format(contributors.total), lbl: 'Contributors', sub: 'reported visibility' },
    { val: NF.format(volume.total_catches), lbl: 'Catches', sub: `+${growth.catches_30d} in 30d` },
    { val: NF.format(volume.weather_observations), lbl: 'Weather Obs', sub: 'accumulated history' },
  ]

  return (
    <>
      {/* Headline metrics */}
      <div className={styles.metricGrid}>
        {metrics.map(m => (
          <div key={m.lbl} className={styles.metricCard}>
            <div className={styles.metricVal}>{m.val}</div>
            <div className={styles.metricLbl}>{m.lbl}</div>
            {m.sub && <div className={styles.metricSub}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* 14-day activity sparkline */}
      <div className={styles.previewResult}>
        <div className={styles.previewHeader}>Report Activity — last 14 days</div>
        <div className={styles.spark}>
          {activity.map(a => (
            <div key={a.date} className={styles.sparkCol} title={`${fmtDate(a.date)}: ${a.count} report${a.count === 1 ? '' : 's'}`}>
              <div
                className={styles.sparkBar}
                style={{ height: `${Math.round((a.count / maxActivity) * 100)}%`, opacity: a.count > 0 ? 1 : 0.15 }}
              />
            </div>
          ))}
        </div>
        <div className={styles.sparkAxis}>
          <span>{fmtDate(activity[0]?.date ?? null)}</span>
          <span>{NF.format(growth.reports_30d)} in last 30d</span>
          <span>today</span>
        </div>
      </div>

      {/* Data quality */}
      <div className={styles.previewResult}>
        <div className={styles.previewHeader}>Data Quality</div>
        <div className={styles.previewStats}>
          <div>Active reports: <strong>{NF.format(volume.active_reports)}</strong> ({NF.format(volume.quarantined_reports)} quarantined)</div>
          <div>With video analysis: <strong>{NF.format(quality.reports_with_video)}</strong> ({quality.video_coverage_pct}%)</div>
          <div>With satellite chl-a: <strong>{NF.format(quality.reports_with_satellite)}</strong> ({quality.satellite_coverage_pct}%)</div>
          <div>Avg trust weight: <strong>{quality.avg_trust_weight?.toFixed(3) ?? '—'}</strong></div>
          <div>Avg user accuracy: <strong>{quality.avg_user_accuracy != null ? `${quality.avg_user_accuracy.toFixed(2)}m` : '—'}</strong> mean error</div>
        </div>
      </div>

      {/* Freshness */}
      <div className={styles.previewResult}>
        <div className={styles.previewHeader}>Data Freshness</div>
        <div className={styles.previewStats}>
          <div>Latest report: <strong>{fmtDate(freshness.latest_report)}</strong> <span style={{ opacity: 0.5 }}>{daysAgo(freshness.latest_report)}</span></div>
          <div>Latest catch: <strong>{fmtDate(freshness.latest_catch)}</strong> <span style={{ opacity: 0.5 }}>{daysAgo(freshness.latest_catch)}</span></div>
          <div>Latest weather obs: <strong>{fmtDate(freshness.latest_observation)}</strong> <span style={{ opacity: 0.5 }}>{daysAgo(freshness.latest_observation)}</span></div>
        </div>
      </div>

      {/* Disputes */}
      <div className={styles.previewResult}>
        <div className={styles.previewHeader}>Disputes ({NF.format(volume.total_disputes)})</div>
        {Object.keys(disputes_by_status).length === 0 ? (
          <div style={{ fontSize: 11, opacity: 0.5 }}>No disputes submitted</div>
        ) : (
          <div className={styles.pillRow}>
            {Object.entries(disputes_by_status).map(([status, count]) => (
              <span
                key={status}
                className={styles.pill}
                style={{ color: status === 'pending' ? 'var(--accent)' : status === 'accepted' ? 'var(--excellent)' : 'var(--danger)' }}
              >
                {status}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Top locations by report count */}
      <div className={styles.previewResult}>
        <div className={styles.previewHeader}>Top Locations by Data</div>
        {coverage.top_locations.length === 0 ? (
          <div style={{ fontSize: 11, opacity: 0.5 }}>No reports yet</div>
        ) : (
          coverage.top_locations.map(loc => (
            <div key={loc.location_id} className={styles.barRow}>
              <span className={styles.barLabel} title={loc.location_name}>{loc.location_name}</span>
              <span className={styles.barTrack}>
                <span className={styles.barFill} style={{ width: `${Math.round((loc.report_count / maxLocReports) * 100)}%` }} />
              </span>
              <span className={styles.barCount}>{loc.report_count}</span>
            </div>
          ))
        )}
        {coverage.locations_without_reports > 0 && (
          <div className={styles.previewMore}>{coverage.locations_without_reports} location(s) have no reports yet</div>
        )}
      </div>

      {/* Top contributors */}
      <div className={styles.previewResult}>
        <div className={styles.previewHeader}>Top Contributors</div>
        {contributors.top.length === 0 ? (
          <div style={{ fontSize: 11, opacity: 0.5 }}>No contributors yet</div>
        ) : (
          contributors.top.map(c => (
            <div key={c.user_id} className={styles.barRow}>
              <span className={styles.barLabel}>
                {c.name}{c.trusted && <span className={styles.trustedTag}> trusted</span>}
              </span>
              <span className={styles.barMeta}>
                {c.mean_accuracy != null ? `±${c.mean_accuracy.toFixed(1)}m` : '—'}
              </span>
              <span className={styles.barCount}>{c.report_count}</span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
