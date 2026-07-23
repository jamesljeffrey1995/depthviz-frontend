import type { AdminStatusChip } from '../../types'
import styles from './AdminConsole.module.css'

/**
 * Colour-coded operational status pill. Kept dumb so it can be reused for
 * services, data streams, sites, forecast confidence, etc. Every visible chip
 * variant in the console flows through this component.
 */
export function StatusChip({ status, dot = true }: { status: AdminStatusChip; dot?: boolean }) {
  const cls = classFor(status)
  return (
    <span className={`${styles.chip} ${cls}`} aria-label={status}>
      {dot && <span className={styles.chipDot} aria-hidden="true" />}
      {status}
    </span>
  )
}

function classFor(status: AdminStatusChip): string {
  switch (status) {
    case 'HEALTHY':        return styles.chipHealthy ?? ''
    case 'TRUSTED':        return styles.chipTrusted ?? ''
    case 'OK':             return styles.chipOk ?? ''
    case 'STALE':          return styles.chipStale ?? ''
    case 'DEGRADED':       return styles.chipDegraded ?? ''
    case 'LOW CONFIDENCE': return styles.chipLow ?? ''
    case 'FAILED':         return styles.chipFailed ?? ''
    default:               return styles.chipUnknown ?? ''
  }
}
