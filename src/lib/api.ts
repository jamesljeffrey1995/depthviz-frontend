import { supabase } from './supabase'
import { cacheGet, cacheSet, cacheDelete } from './cache'
import type {
  AdminStats,
  BestVisResponse,
  CleaningResult,
  ForecastResponse,
  GeocodingResult,
  LeaderboardEntry,
  Location,
  LocationHistoryResponse,
  OutlierPreview,
  QuarantinedListResponse,
  ReportCreate,
  ReportRead,
  TidesResponse,
  UserProfile,
} from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  // Get current session token and attach it
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> ?? {}),
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

const TTL = {
  GEOCODE: 60 * 60 * 1000,      // 1 hour  – geocoding data rarely changes
  FORECAST: 5 * 60 * 1000,      // 5 min   – forecasts update periodically
  LOCATIONS: 5 * 60 * 1000,     // 5 min
  TIDES: 30 * 60 * 1000,        // 30 min  – tide predictions are stable
  HISTORY: 5 * 60 * 1000,       // 5 min
  STATS: 2 * 60 * 1000,         // 2 min   – community data changes often
  LEADERBOARD: 5 * 60 * 1000,   // 5 min
}

// Geocoding
export async function geocode(query: string): Promise<GeocodingResult[]> {
  const key = `geocode:${query.toLowerCase().trim()}`
  const cached = cacheGet<GeocodingResult[]>(key)
  if (cached) return cached

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  const res = await fetch(url)
  const data = await res.json()
  const results = (data.results ?? []) as GeocodingResult[]
  cacheSet(key, results, TTL.GEOCODE)
  return results
}

// Forecast
export async function getForecast(lat: number, lon: number, name: string, locationId?: number): Promise<ForecastResponse> {
  const key = `forecast:${lat}:${lon}:${locationId ?? ''}`
  const cached = cacheGet<ForecastResponse>(key)
  if (cached) return cached

  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), name,
    ...(locationId ? { location_id: String(locationId) } : {}),
  })
  const result = await apiFetch<ForecastResponse>(`/forecast?${params}`)
  cacheSet(key, result, TTL.FORECAST)
  return result
}

// Locations
export async function getLocations(): Promise<Location[]> {
  const key = 'locations'
  const cached = cacheGet<Location[]>(key)
  if (cached) return cached

  const result = await apiFetch<Location[]>('/locations')
  cacheSet(key, result, TTL.LOCATIONS)
  return result
}

export async function createLocation(name: string, lat: number, lon: number, isPublic = false): Promise<Location> {
  const result = await apiFetch<Location>('/locations', {
    method: 'POST',
    body: JSON.stringify({ name, lat, lon, is_public: isPublic }),
  })
  cacheDelete('locations')
  return result
}

export async function deleteLocation(id: number): Promise<void> {
  await apiFetch(`/locations/${id}`, { method: 'DELETE' })
  cacheDelete('locations')
}

export async function voteLocation(id: number, direction: 'up' | 'down'): Promise<Location> {
  const result = await apiFetch<Location>(`/locations/${id}/vote`, {
    method: 'PUT',
    body: JSON.stringify({ direction }),
  })
  cacheDelete('locations')
  return result
}

export async function removeVote(id: number): Promise<Location> {
  const result = await apiFetch<Location>(`/locations/${id}/vote`, { method: 'DELETE' })
  cacheDelete('locations')
  return result
}

// Reports
export async function submitReport(report: ReportCreate): Promise<void> {
  await apiFetch('/reports', { method: 'POST', body: JSON.stringify(report) })
  // Invalidate stats and history for the location this report targets
  cacheDelete(`stats:${report.location_id}`)
  cacheDelete(`history:${report.location_id}`)
  cacheDelete('leaderboard')
}

export async function getMyReports(): Promise<ReportRead[]> {
  return apiFetch<ReportRead[]>('/reports/mine')
}

export async function getLocationStats(locationId: number) {
  const key = `stats:${locationId}`
  const cached = cacheGet(key)
  if (cached) return cached

  const result = await apiFetch(`/reports/stats/${locationId}`)
  cacheSet(key, result, TTL.STATS)
  return result
}

// Profile
export async function getMyProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/profile/me')
}

export async function updateProfile(displayName: string) {
  return apiFetch('/profile/me', {
    method: 'PATCH',
    body: JSON.stringify({ display_name: displayName }),
  })
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const key = 'leaderboard'
  const cached = cacheGet<LeaderboardEntry[]>(key)
  if (cached) return cached

  const result = await apiFetch<LeaderboardEntry[]>('/profile/leaderboard')
  cacheSet(key, result, TTL.LEADERBOARD)
  return result
}

// Tides & Currents
export async function getTides(lat: number, lon: number, name: string, date?: string): Promise<TidesResponse> {
  const key = `tides:${lat}:${lon}:${date ?? 'today'}`
  const cached = cacheGet<TidesResponse>(key)
  if (cached) return cached

  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), name,
    ...(date ? { date } : {}),
  })
  const result = await apiFetch<TidesResponse>(`/tides?${params}`)
  cacheSet(key, result, TTL.TIDES)
  return result
}

// Location history
export async function getLocationHistory(locationId: number): Promise<LocationHistoryResponse> {
  const key = `history:${locationId}`
  const cached = cacheGet<LocationHistoryResponse>(key)
  if (cached) return cached

  const result = await apiFetch<LocationHistoryResponse>(`/reports/location/${locationId}/history`)
  cacheSet(key, result, TTL.HISTORY)
  return result
}

// Best Visibility
export async function getBestVisibility(): Promise<BestVisResponse> {
  const key = 'best-vis'
  const cached = cacheGet<BestVisResponse>(key)
  if (cached) return cached

  const result = await apiFetch<BestVisResponse>('/forecast/best')
  cacheSet(key, result, TTL.FORECAST)
  return result
}

// Admin — Outlier Management
export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>('/admin/stats')
}

export async function getOutlierPreview(): Promise<OutlierPreview> {
  return apiFetch<OutlierPreview>('/admin/outliers/preview')
}

export async function runOutlierCleaning(): Promise<CleaningResult> {
  return apiFetch<CleaningResult>('/admin/outliers/clean', { method: 'POST' })
}

export async function getQuarantinedReports(locationId?: number): Promise<QuarantinedListResponse> {
  const params = locationId ? `?location_id=${locationId}` : ''
  return apiFetch<QuarantinedListResponse>(`/admin/outliers/quarantined${params}`)
}

export async function restoreReport(reportId: number): Promise<void> {
  await apiFetch(`/admin/outliers/restore/${reportId}`, { method: 'POST' })
}

export async function quarantineReport(reportId: number): Promise<void> {
  await apiFetch(`/admin/outliers/quarantine/${reportId}`, { method: 'POST' })
}