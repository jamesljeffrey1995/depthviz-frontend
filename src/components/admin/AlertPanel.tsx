import type { AdminAlert, AdminHealth, AdminSiteRow } from '../../types'
import styles from './AdminConsole.module.css'

interface Props {
  alerts: AdminAlert[]
}

/** Grouped Critical → Warning → Info list. The console derives alerts client-side
 *  from the health + sites payloads (see ``deriveAlerts``) — no separate backend
 *  call needed. */
export function AlertPanel({ alerts }: Props) {
  const grouped: Record<'critical' | 'warning' | 'info', AdminAlert[]> = {
    critical: alerts.filter(a => a.severity === 'critical'),
    warning: alerts.filter(a => a.severity === 'warning'),
    info: alerts.filter(a => a.severity === 'info'),
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <span>Attention Needed</span>
        <span className={styles.panelSub}>
          {alerts.length === 0 ? 'all clear' : `${alerts.length} open`}
        </span>
      </div>

      {alerts.length === 0 && (
        <div className={styles.alertEmpty}>No open alerts. Pipelines look healthy.</div>
      )}

      {(['critical', 'warning', 'info'] as const).map(sev => (
        grouped[sev].length > 0 && (
          <div className={styles.alertList} key={sev}>
            {grouped[sev].map(a => (
              <div
                key={a.id}
                className={`${styles.alert} ${
                  sev === 'critical' ? styles.alertCritical
                  : sev === 'warning' ? styles.alertWarning
                  : styles.alertInfo
                }`}
              >
                <div>
                  <div>{a.message}</div>
                  {a.hint && <div className={styles.alertHint}>{a.hint}</div>}
                </div>
              </div>
            ))}
          </div>
        )
      ))}
    </div>
  )
}

/** Build the alert list from health + sites data. Keeps alerting rules in one
 *  place so the operator sees the same story on every panel. */
export function deriveAlerts(
  health: AdminHealth | null,
  sites: AdminSiteRow[],
): AdminAlert[] {
  const out: AdminAlert[] = []
  if (!health) return out

  // Upstream services — critical if any are FAILED.
  for (const [name, probe] of Object.entries(health.services)) {
    if (probe.chip === 'FAILED') {
      out.push({
        id: `svc-${name}`,
        severity: 'critical',
        message: `${name} upstream probe is failing`,
        hint: 'Forecast fetches for this upstream will fall back to cached values until it recovers.',
      })
    }
  }

  // Data streams — degraded > stale > failed → escalating severity.
  const streams: [string, keyof AdminHealth['data_streams']][] = [
    ['Weather / marine data', 'weather'],
    ['CMEMS optical data', 'cmems'],
    ['User reports', 'reports'],
  ]
  for (const [label, key] of streams) {
    const s = health.data_streams[key]
    if (s.chip === 'FAILED') {
      out.push({
        id: `stream-${key}-failed`,
        severity: 'critical',
        message: `${label} pipeline is stale beyond fail threshold`,
        hint: 'Re-run data ingestion or check upstream credentials.',
      })
    } else if (s.chip === 'STALE') {
      out.push({
        id: `stream-${key}-stale`,
        severity: 'warning',
        message: `${label} data is stale`,
      })
    }
  }

  // Model confidence.
  if (health.model.confidence_chip === 'LOW CONFIDENCE') {
    out.push({
      id: 'model-low-conf',
      severity: 'warning',
      message: 'Forecast model confidence is low',
      hint: 'Sample count or R² is below the trust threshold — schedule a retrain when enough new reports arrive.',
    })
  }

  // Sensor gap — informational until sensor ingestion ships.
  if (!health.sensors.configured) {
    out.push({
      id: 'sensor-not-wired',
      severity: 'info',
      message: 'Sensor telemetry ingestion is not yet wired up',
      hint: 'The Seaton Sluice sensor will surface here once the backend feed is deployed.',
    })
  }

  // Sites with no recent reports — warn on the top-3 most-stale sites.
  const staleSites = sites
    .filter(s => s.days_since_report === null || (s.days_since_report ?? 0) > 30)
    .sort((a, b) => (b.days_since_report ?? Infinity) - (a.days_since_report ?? Infinity))
    .slice(0, 3)
  for (const s of staleSites) {
    out.push({
      id: `site-stale-${s.id}`,
      severity: (s.days_since_report ?? 0) > 90 ? 'warning' : 'info',
      message: `${s.name} — ${s.days_since_report === null ? 'no reports on file' : `no reports in ${s.days_since_report} days`}`,
    })
  }

  // Sites where reports disagree with model strongly (bias offset > 2m).
  const biasedSites = sites.filter(s => Math.abs(s.bias_offset ?? 0) > 2.0)
  for (const s of biasedSites.slice(0, 3)) {
    out.push({
      id: `site-bias-${s.id}`,
      severity: 'warning',
      message: `${s.name} — reports diverge from model by ${(s.bias_offset ?? 0).toFixed(1)}m`,
      hint: 'Consider retraining or reviewing the site bias.',
    })
  }

  return out
}
