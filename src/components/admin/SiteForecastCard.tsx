import type { AdminSiteRow, AdminForecastDebug } from '../../types'
import { StatusChip } from './StatusChip'
import { formatRelative, signedNum } from './formatters'
import styles from './AdminConsole.module.css'

interface Props {
  site: AdminSiteRow
  selected: boolean
  onSelect: (id: number) => void
  /** When available, use the live per-site breakdown to show the current-driver
   *  string — otherwise fall back to the bias/stale hint from ``site``. */
  debug?: AdminForecastDebug | null
}

/**
 * One site card. Click to select — parent updates the detail panels below.
 * Kept small on purpose: at a glance you see status chips, the current call,
 * and the primary driver ("Swell penalty", "Reports disagree" …).
 */
export function SiteForecastCard({ site, selected, onSelect, debug }: Props) {
  const driver = pickDriver(site, debug)
  return (
    <button
      type="button"
      className={`${styles.siteCard} ${selected ? styles.siteCardSelected : ''}`}
      onClick={() => onSelect(site.id)}
      aria-pressed={selected}
    >
      <div className={styles.siteCardHead}>
        <span className={styles.siteCardName} title={site.name}>{site.name}</span>
        <StatusChip status={site.trust_chip} dot={false} />
      </div>

      <div className={styles.siteChipRow}>
        <StatusChip status={site.report_chip} dot={false} />
        {debug && (
          <span className={styles.chip + ' ' + styles.chipOk}>
            {debug.final_prediction.toFixed(1)}m
          </span>
        )}
      </div>

      <div className={styles.siteDriver} title={driver}>{driver}</div>

      <div className={styles.siteMeta}>
        <span>reports: {site.active_reports}</span>
        <span>last: {site.latest_report ? formatRelative(site.latest_report) : '—'}</span>
      </div>
      <div className={styles.siteMeta}>
        <span>bias {signedNum(site.bias_offset ?? 0, 2, 'm')}</span>
        <span>R² {site.r2_score == null ? '—' : site.r2_score.toFixed(2)}</span>
      </div>
    </button>
  )
}

function pickDriver(site: AdminSiteRow, debug?: AdminForecastDebug | null): string {
  if (debug?.main_negative_drivers && debug.main_negative_drivers.length > 0) {
    return debug.main_negative_drivers[0].label
  }
  if (Math.abs(site.bias_offset ?? 0) > 2.0) {
    return `Reports disagree ${signedNum(site.bias_offset ?? 0, 1, 'm')}`
  }
  if (site.report_chip === 'STALE') return 'Stale reporting cadence'
  if (site.trust_chip === 'LOW CONFIDENCE') return 'Low sample confidence'
  return 'Stable conditions'
}
