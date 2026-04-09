import { useState, useCallback, useRef } from 'react'
import { getForecast, geocode } from '../lib/api'
import { formatLocationName } from '../types'
import type { ForecastResponse } from '../types'

interface State {
  status: 'idle' | 'loading' | 'success' | 'error'
  forecast: ForecastResponse | null
  error: string
  isRevalidating: boolean
}

export function useConditions() {
  const [state, setState] = useState<State>({ status: 'idle', forecast: null, error: '', isRevalidating: false })
  const searchIdRef = useRef(0)

  const search = useCallback(async (query: string) => {
    const id = ++searchIdRef.current
    // Keep previous forecast visible while loading (stale-while-revalidate)
    setState(s => ({ ...s, status: s.forecast ? 'success' : 'loading', error: '', isRevalidating: !!s.forecast }))
    try {
      const results = await geocode(query)
      if (!results.length) throw new Error('Location not found')
      const loc = results[0]
      const name = formatLocationName(loc)
      const forecast = await getForecast(loc.latitude, loc.longitude, name)
      if (id !== searchIdRef.current) return // Stale request — discard
      setState({ status: 'success', forecast, error: '', isRevalidating: false })
    } catch (e) {
      if (id !== searchIdRef.current) return
      const msg = e instanceof Error ? e.message : 'Failed to fetch'
      // If we have a stale forecast, keep showing it (stale-while-revalidate)
      setState(s => ({
        ...s,
        status: s.forecast ? 'success' : 'error',
        error: msg,
        isRevalidating: false,
      }))
    }
  }, [])

  const searchByCoords = useCallback(async (lat: number, lon: number, name?: string, locationId?: number) => {
    const id = ++searchIdRef.current
    // Keep previous forecast visible while loading (stale-while-revalidate)
    setState(s => ({ ...s, status: s.forecast ? 'success' : 'loading', error: '', isRevalidating: !!s.forecast }))
    try {
      const forecast = await getForecast(lat, lon, name ?? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, locationId)
      if (id !== searchIdRef.current) return // Stale request — discard
      setState({ status: 'success', forecast, error: '', isRevalidating: false })
    } catch (e) {
      if (id !== searchIdRef.current) return
      const msg = e instanceof Error ? e.message : 'Failed to fetch'
      setState(s => ({
        ...s,
        status: s.forecast ? 'success' : 'error',
        error: msg,
        isRevalidating: false,
      }))
    }
  }, [])

  return { ...state, search, searchByCoords }
}
