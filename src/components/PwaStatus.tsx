import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import styles from './PwaStatus.module.css'

/** Human-readable "x minutes/hours ago" for the offline data-age hint. */
function formatAge(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  const mins = Math.round(diff / 60_000)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** Reads the timestamp persisted alongside dv_last_forecast (see App.tsx). */
function lastForecastSavedAt(): number | null {
  try {
    const raw = localStorage.getItem('dv_last_forecast')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: number }
    return typeof parsed.savedAt === 'number' ? parsed.savedAt : null
  } catch {
    return null
  }
}

/**
 * Renders the two PWA-related pieces of UI:
 *  1. An offline indicator banner ("Offline — showing saved data from …").
 *  2. A service-worker update prompt when a new version has been installed.
 *
 * Mounting this component also registers the service worker (via the
 * useRegisterSW hook), so the SW lifecycle is owned in one place. Registration
 * happens here rather than via an injected inline script to stay within the
 * app's CSP (script-src 'self', no 'unsafe-inline').
 */
export default function PwaStatus() {
  const online = useOnlineStatus()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  // Auto-dismiss the one-time "ready to work offline" confirmation.
  useEffect(() => {
    if (!offlineReady) return
    const id = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(id)
  }, [offlineReady, setOfflineReady])

  // A stale app shell can contain route code that no longer matches the live
  // API. Apply an installed update promptly instead of letting the user defer
  // it and continue navigating through an incompatible build.
  useEffect(() => {
    if (!needRefresh) return
    const id = setTimeout(() => {
      void updateServiceWorker(true)
    }, 1000)
    return () => clearTimeout(id)
  }, [needRefresh, updateServiceWorker])

  const savedAt = !online ? lastForecastSavedAt() : null

  return (
    <>
      {!online && (
        <div className={styles.offlineBanner} role="status" aria-live="polite">
          <span aria-hidden="true">⚡</span>{' '}
          {savedAt
            ? `Offline — showing saved data from ${formatAge(savedAt)}`
            : 'Offline — no saved forecast yet; reconnect to load conditions'}
        </div>
      )}

      {needRefresh && (
        <div className={styles.updateToast} role="status" aria-live="polite">
          <span className={styles.updatePulse} aria-hidden="true" />
          <span>Updating DepthViz to the latest forecast build…</span>
        </div>
      )}

      {offlineReady && !needRefresh && (
        <div className={styles.readyToast} role="status">
          Ready to work offline
        </div>
      )}
    </>
  )
}
