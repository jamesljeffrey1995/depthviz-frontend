import { useState, useEffect } from 'react'
import { getServiceStatus } from '../lib/api'
import type { ServiceStatusResponse } from '../lib/api'

const POLL_MS = 10 * 60 * 1000 // re-fetch every 10 minutes

export function useServiceStatus(): ServiceStatusResponse {
  const [status, setStatus] = useState<ServiceStatusResponse>({})

  useEffect(() => {
    let cancelled = false

    const fetch = async () => {
      try {
        const data = await getServiceStatus()
        if (!cancelled) setStatus(data)
      } catch {
        // Best-effort — don't surface hook errors to users
      }
    }

    fetch()
    const id = setInterval(fetch, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return status
}
