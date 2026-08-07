import { useState, useCallback, useRef, useEffect } from 'react'
import { getForecast, geocode } from '../lib/api'
import { formatLocationName } from '../types'
import type { ForecastResponse } from '../types'
import { isAbortError, toUserFacingError } from '../lib/frontendErrors'
import { trackClientEvent } from '../lib/telemetry'

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
  const activeControllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    activeControllerRef.current?.abort()
  }, [])

  /** Pre-populate forecast state from a stored snapshot so the stale-while-revalidate
   *  path is taken on startup instead of the full loading spinner. */
  const init = useCallback((initialForecast: ForecastResponse, units: 'ft' | 'm') => {
    setState({ status: 'success', forecast: initialForecast, forecastUnits: initialForecast.units ?? units, error: '', isRevalidating: false })
  }, [])

  const search = useCallback(async (query: string, units: 'ft' | 'm' = 'ft') => {
    activeControllerRef.current?.abort()
    const controller = new AbortController()
    activeControllerRef.current = controller
    const id = ++searchIdRef.current
    // Keep previous forecast visible while loading (stale-while-revalidate)
    setState(s => ({ ...s, status: s.forecast ? 'success' : 'loading', error: '', isRevalidating: !!s.forecast }))
    try {
      const results = await geocode(query, controller.signal)
      const loc = results[0]
      if (!loc) throw new Error('Location not found')
      const name = formatLocationName(loc)
      const forecast = await getForecast(loc.latitude, loc.longitude, name, units, undefined, controller.signal)
      if (id !== searchIdRef.current) return // Stale request — discard
      setState({ status: 'success', forecast, forecastUnits: forecast.units ?? units, error: '', isRevalidating: false })
    } catch (e) {
      if (isAbortError(e)) return
      if (id !== searchIdRef.current) return
      const failure = toUserFacingError(e, 'forecast')
      trackClientEvent('forecast.fetch_failed', {
        code: failure.telemetryCode,
        status: failure.status,
      })
      // If we have a stale forecast, keep showing it (stale-while-revalidate)
      setState(s => ({
        ...s,
        status: s.forecast ? 'success' : 'error',
        error: failure.message,
        isRevalidating: false,
      }))
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = null
    }
  }, [])

  const searchByCoords = useCallback(async (lat: number, lon: number, name?: string, locationId?: number, units: 'ft' | 'm' = 'ft') => {
    activeControllerRef.current?.abort()
    const controller = new AbortController()
    activeControllerRef.current = controller
    const id = ++searchIdRef.current
    // Keep previous forecast visible while loading (stale-while-revalidate)
    setState(s => ({ ...s, status: s.forecast ? 'success' : 'loading', error: '', isRevalidating: !!s.forecast }))
    try {
      const forecast = await getForecast(
        lat,
        lon,
        name ?? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
        units,
        locationId,
        controller.signal,
      )
      if (id !== searchIdRef.current) return // Stale request — discard
      setState({ status: 'success', forecast, forecastUnits: forecast.units ?? units, error: '', isRevalidating: false })
    } catch (e) {
      if (isAbortError(e)) return
      if (id !== searchIdRef.current) return
      const failure = toUserFacingError(e, 'forecast')
      trackClientEvent('forecast.fetch_failed', {
        code: failure.telemetryCode,
        status: failure.status,
      })
      setState(s => ({
        ...s,
        status: s.forecast ? 'success' : 'error',
        error: failure.message,
        isRevalidating: false,
      }))
    } finally {
      if (activeControllerRef.current === controller) activeControllerRef.current = null
    }
  }, [])

  return { ...state, search, searchByCoords, init }
}
