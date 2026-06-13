import { useEffect, useState } from 'react'

/**
 * Tracks browser connectivity via the `online`/`offline` events.
 *
 * `navigator.onLine` is a coarse signal (it only reflects whether the device
 * has *a* network interface, not whether our API is reachable), but it's the
 * standard, zero-cost way to drive an offline indicator and is accurate enough
 * for the "you're offline — showing saved data" UX.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
