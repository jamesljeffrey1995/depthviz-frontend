import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  forceRetrain,
  getAdminForecastDebug,
  getAdminHealth,
  getAdminSites,
  getMLPredictions,
  getMLStatus,
  getQuarantinedReports,
  quarantineReport,
  refreshAdminForecast,
  restoreReport,
  runOutlierCleaning,
} from '../lib/api'
import type {
  AdminForecastDebug,
  AdminHealth,
  AdminSiteRow,
  MLPredictions,
  MLResidual,
  MLStatus,
  QuarantinedReport,
} from '../types'
import { AdminActionsPanel } from './admin/AdminActionsPanel'
import { AlertPanel, deriveAlerts } from './admin/AlertPanel'
import { ForecastBreakdown } from './admin/ForecastBreakdown'
import { HealthSummaryCard } from './admin/HealthSummaryCard'
import { ModelDiagnostics } from './admin/ModelDiagnostics'
import { ReportsTable } from './admin/ReportsTable'
import { SensorStatusPanel } from './admin/SensorStatusPanel'
import { SiteForecastCard } from './admin/SiteForecastCard'
import { IconChevronLeft } from './icons'
import styles from './admin/AdminConsole.module.css'

interface AdminPanelProps {
  onBack?: () => void
}

/**
 * DepthViz admin operational console.
 *
 * Layout hierarchy (top → bottom):
 *   1. System health strip     — is DepthViz healthy?
 *   2. Alerts                  — what needs attention?
 *   3. Sites grid              — per-site trust + status
 *   4. Forecast breakdown      — why this prediction? (for the selected site)
 *   5. Model diagnostics       — collapsed by default
 *   6. Reports + sensors       — reports admin table, sensor placeholder
 *   7. Admin actions           — refresh, retrain, cleaning; danger actions
 *                                behind confirm; unimplemented actions
 *                                labelled as stubs
 *
 * Public-user forecast UX intentionally not reused — this page is admin-only.
 */
export function AdminPanel({ onBack }: AdminPanelProps) {
  const [health, setHealth] = useState<AdminHealth | null>(null)
  const [sites, setSites] = useState<AdminSiteRow[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [debug, setDebug] = useState<AdminForecastDebug | null>(null)
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null)
  const [predictions, setPredictions] = useState<MLPredictions | null>(null)
  const [quarantined, setQuarantined] = useState<QuarantinedReport[]>([])
  const [loading, setLoading] = useState({ health: true, sites: true, debug: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Monotonic in-flight request id per stream — mirrors the old panel's guard
  // so tab-switch / fast reselection can't leave stale data behind.
  const debugReqId = useRef(0)

  const setLoad = useCallback(<K extends keyof typeof loading>(key: K, v: boolean) => {
    setLoading(prev => ({ ...prev, [key]: v }))
  }, [])

  const loadHealth = useCallback(async () => {
    setLoad('health', true)
    try {
      setHealth(await getAdminHealth())
      setError(null)
    } catch (e) {
      setError(describe(e, 'Failed to load admin health'))
    } finally {
      setLoad('health', false)
    }
  }, [setLoad])

  const loadSites = useCallback(async () => {
    setLoad('sites', true)
    try {
      const data = await getAdminSites()
      setSites(data.sites)
      // First site is a reasonable default so the breakdown panel has state.
      setSelectedId(prev => prev ?? data.sites[0]?.id ?? null)
    } catch (e) {
      setError(describe(e, 'Failed to load sites'))
    } finally {
      setLoad('sites', false)
    }
  }, [setLoad])

  const loadDebug = useCallback(async (locationId: number) => {
    const id = ++debugReqId.current
    setLoad('debug', true)
    try {
      const data = await getAdminForecastDebug(locationId)
      if (id === debugReqId.current) setDebug(data)
    } catch (e) {
      if (id === debugReqId.current) {
        setDebug(null)
        setError(describe(e, 'Failed to load forecast breakdown'))
      }
    } finally {
      if (id === debugReqId.current) setLoad('debug', false)
    }
  }, [setLoad])

  const loadModel = useCallback(async () => {
    try {
      const [status, preds, q] = await Promise.all([
        getMLStatus().catch(() => null),
        getMLPredictions().catch(() => null),
        getQuarantinedReports().catch(() => ({ count: 0, reports: [] })),
      ])
      if (status) setMlStatus(status)
      if (preds) setPredictions(preds)
      setQuarantined(q.reports)
    } catch (e) {
      setError(describe(e, 'Failed to load model diagnostics'))
    }
  }, [])

  // Fan-out the initial load in parallel — none of them depend on each other.
  useEffect(() => {
    loadHealth()
    loadSites()
    loadModel()
  }, [loadHealth, loadSites, loadModel])

  useEffect(() => {
    if (selectedId != null) loadDebug(selectedId)
  }, [selectedId, loadDebug])

  const selectedSite = useMemo(
    () => sites.find(s => s.id === selectedId) ?? null,
    [sites, selectedId],
  )

  const alerts = useMemo(() => deriveAlerts(health, sites), [health, sites])

  const residuals: MLResidual[] = predictions?.residuals ?? []

  // ── Actions ────────────────────────────────────────────────────────────
  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true)
    setMessage(`${label}…`)
    setError(null)
    try {
      await fn()
      setMessage(`${label} — done`)
    } catch (e) {
      const msg = describe(e, `${label} failed`)
      setMessage(null)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleRefreshAll = () =>
    runAction('Refresh all forecasts', async () => {
      await refreshAdminForecast()
      await loadHealth()
    })

  const handleRefreshSelected = () =>
    runAction('Recalculate site', async () => {
      if (selectedId == null) return
      await refreshAdminForecast(selectedId)
      await loadDebug(selectedId)
    })

  const handleRetrain = () =>
    runAction('Trigger retrain', async () => {
      await forceRetrain()
      await loadModel()
      await loadHealth()
    })

  const handleCleanOutliers = () =>
    runAction('Run outlier cleaning', async () => {
      await runOutlierCleaning()
      await loadModel()
    })

  const handleQuarantine = async (id: number) => {
    try {
      await quarantineReport(id)
      // ``loadModel`` refetches both residuals and the quarantined list, so
      // any local optimistic append would just be duplicated — skip it.
      await loadModel()
    } catch (e) {
      setError(describe(e, 'Failed to quarantine report'))
    }
  }

  const handleRestore = async (id: number) => {
    try {
      await restoreReport(id)
      setQuarantined(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      setError(describe(e, 'Failed to restore report'))
    }
  }

  const handleExportCsv = () => {
    const header = 'date,site,actual_m,predicted_m,error_m,trust_weight\n'
    const rows = residuals
      .map(r => [r.date, csvSafe(r.location), r.actual, r.predicted, r.error, r.trust_weight].join(','))
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `depthviz-residuals-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.wrap}>
      {(onBack || error) && (
        <div className={`${styles.rowFull} ${styles.metaRow}`}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={styles.actionCancelBtn}
            >
              <IconChevronLeft width={14} height={14} /> Back
            </button>
          )}
          <span style={{ flex: 1 }} />
          {error && (
            <span style={{ color: 'var(--sev-poor)' }} role="alert">
              {error}
            </span>
          )}
        </div>
      )}

      {/* Row 1 — Health (wide) + Model summary is baked into health strip. */}
      <div className={styles.colHealth}>
        <HealthSummaryCard health={health} loading={loading.health} />
      </div>
      <div className={styles.colModel}>
        <AlertPanel alerts={alerts} />
      </div>

      {/* Row 2 — Site grid + selected-site breakdown */}
      <div className={styles.colSites}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}>
            <span>Sites</span>
            <span className={styles.panelSub}>
              {sites.length} monitored{selectedSite ? ` · selected: ${selectedSite.name}` : ''}
            </span>
          </div>
          {loading.sites && sites.length === 0 ? (
            <div className={styles.loading}>Loading sites…</div>
          ) : sites.length === 0 ? (
            <div className={styles.emptyMsg}>No sites configured.</div>
          ) : (
            <div className={styles.siteGrid}>
              {sites.map(site => (
                <SiteForecastCard
                  key={site.id}
                  site={site}
                  selected={site.id === selectedId}
                  onSelect={setSelectedId}
                  debug={site.id === selectedId ? debug : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={styles.colBreakdown}>
        <ForecastBreakdown debug={debug} loading={loading.debug} />
      </div>

      {/* Row 3 — Model diagnostics collapsible */}
      <div className={styles.colDiag}>
        <ModelDiagnostics mlStatus={mlStatus} />
      </div>

      {/* Row 4 — Reports + Sensor */}
      <div className={styles.colReports}>
        <ReportsTable
          residuals={residuals}
          quarantined={quarantined}
          onQuarantine={handleQuarantine}
          onRestore={handleRestore}
        />
      </div>
      <div className={styles.colSensors}>
        <SensorStatusPanel health={health} />
      </div>

      {/* Row 5 — Admin actions */}
      <div className={styles.colActions}>
        <AdminActionsPanel
          selectedSiteName={selectedSite?.name ?? null}
          busy={busy}
          lastMessage={message}
          onRefreshForecast={handleRefreshAll}
          onRefreshSelectedSite={handleRefreshSelected}
          onTriggerRetrain={handleRetrain}
          onRunOutlierCleaning={handleCleanOutliers}
          onExportReports={handleExportCsv}
        />
      </div>
    </div>
  )
}

function describe(e: unknown, fallback: string): string {
  console.error(fallback, e)
  return e instanceof Error && e.message ? `${fallback}: ${e.message}` : fallback
}

function csvSafe(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}
