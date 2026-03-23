import { useState, useCallback, useRef } from 'react'
import { getForecast, geocode } from '../lib/api'
import { formatLocationName } from '../types'
import type { ForecastResponse } from '../types'

interface State {
  status: 'idle' | 'loading' | 'success' | 'error'
  forecast: ForecastResponse | null
  error: string
}

export function useConditions() {
  const [state, setState] = useState<State>({ status: 'idle', forecast: null, error: '' })
  const searchIdRef = useRef(0)

  const search = useCallback(async (query: string) => {
    const id = ++searchIdRef.current
    setState(s => ({ ...s, status: 'loading', error: '' }))
    try {
      const results = await geocode(query)
      if (!results.length) throw new Error('Location not found')
      const loc = results[0]
      const name = formatLocationName(loc)
      const forecast = await getForecast(loc.latitude, loc.longitude, name)
      if (id !== searchIdRef.current) return // Stale request — discard
      setState(s => ({ ...s, status: 'success', forecast }))
    } catch (e) {
      if (id !== searchIdRef.current) return
      setState(s => ({ ...s, status: 'error', error: e instanceof Error ? e.message : 'Failed to fetch' }))
    }
  }, [])

  const searchByCoords = useCallback(async (lat: number, lon: number, name?: string, locationId?: number) => {
    const id = ++searchIdRef.current
    setState(s => ({ ...s, status: 'loading', error: '' }))
    try {
      const forecast = await getForecast(lat, lon, name ?? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, locationId)
      if (id !== searchIdRef.current) return // Stale request — discard
      setState(s => ({ ...s, status: 'success', forecast }))
    } catch (e) {
      if (id !== searchIdRef.current) return
      setState(s => ({ ...s, status: 'error', error: e instanceof Error ? e.message : 'Failed to fetch' }))
    }
  }, [])

  return { ...state, search, searchByCoords }
}
