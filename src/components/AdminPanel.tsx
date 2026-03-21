import { useState, useEffect, useCallback } from 'react'
import {
  getAdminStats,
  getOutlierPreview,
  runOutlierCleaning,
  getQuarantinedReports,
  restoreReport,
} from '../lib/api'
import type {
  AdminStats,
  OutlierPreview,
  CleaningResult,
  QuarantinedReport,
} from '../types'
import styles from './AdminPanel.module.css'

interface AdminPanelProps {
  onBack?: () => void
}

type Tab = 'overview' | 'quarantined' | 'clean'

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [preview, setPreview] = useState<OutlierPreview | null>(null)
  const [cleanResult, setCleanResult] = useState<CleaningResult | null>(null)
  const [quarantined, setQuarantined] = useState<QuarantinedReport[]>([])
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

  const handleTabChange = (t: Tab) => {
    setTab(t)
    if (t === 'quarantined') loadQuarantined()
    if (t === 'clean') { setPreview(null); setCleanResult(null) }
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
        {(['overview', 'quarantined', 'clean'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => handleTabChange(t)}
          >
            {t === 'overview' ? 'Overview' : t === 'quarantined' ? 'Quarantined' : 'Clean Outliers'}
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
          {quarantined.map(r => (
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
              <button className={styles.restoreBtn} onClick={() => handleRestore(r.id)}>
                Restore
              </button>
            </div>
          ))}
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
    </div>
  )
}
