import { useState, useCallback, useRef } from 'react'
import { getForecast, geocode } from '../lib/api'
import { formatLocationName } from '../types'
import type { ForecastResponse } from '../types'

interface State {
  status: 'idle' | 'loading' | 'success' | 'error'
  forecast: ForecastResponse | null
  /** Units the current `forecast` numbers are expressed in. Tracked here — set
   *  atomically with `forecast` — so that during stale-while-revalidate the
   *  displayed data always carries its own unit, even for forecasts the API
   *  didn't stamp with a `units` field (older caches / pre-deploy responses).
   *  Prevents labelling stale numbers with the newly-toggled unit. */
  forecastUnits?: 'ft' | 'm'
  error: string
  isRevalidating: boolean
}

export function useConditions() {
  const [state, setState] = useState<State>({ status: 'idle', forecast: null, error: '', isRevalidating: false })
  const searchIdRef = useRef(0)

  /** Pre-populate forecast state from a stored snapshot so the stale-while-revalidate
   *  path is taken on startup instead of the full loading spinner. */
  const init = useCallback((initialForecast: ForecastResponse, units: 'ft' | 'm') => {
    setState({ status: 'success', forecast: initialForecast, forecastUnits: initialForecast.units ?? units, error: '', isRevalidating: false })
  }, [])

  const search = useCallback(async (query: string, units: 'ft' | 'm' = 'ft') => {
    const id = ++searchIdRef.current
    // Keep previous forecast visible while loading (stale-while-revalidate)
    setState(s => ({ ...s, status: s.forecast ? 'success' : 'loading', error: '', isRevalidating: !!s.forecast }))
    try {
      const results = await geocode(query)
      const loc = results[0]
      if (!loc) throw new Error('Location not found')
      const name = formatLocationName(loc)
      const forecast = await getForecast(loc.latitude, loc.longitude, name, units)
      if (id !== searchIdRef.current) return // Stale request — discard
      setState({ status: 'success', forecast, forecastUnits: forecast.units ?? units, error: '', isRevalidating: false })
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

  const searchByCoords = useCallback(async (lat: number, lon: number, name?: string, locationId?: number, units: 'ft' | 'm' = 'ft') => {
    const id = ++searchIdRef.current
    // Keep previous forecast visible while loading (stale-while-revalidate)
    setState(s => ({ ...s, status: s.forecast ? 'success' : 'loading', error: '', isRevalidating: !!s.forecast }))
    try {
      const forecast = await getForecast(lat, lon, name ?? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, units, locationId)
      if (id !== searchIdRef.current) return // Stale request — discard
      setState({ status: 'success', forecast, forecastUnits: forecast.units ?? units, error: '', isRevalidating: false })
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

  return { ...state, search, searchByCoords, init }
}
