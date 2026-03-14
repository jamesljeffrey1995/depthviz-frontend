import { supabase } from './supabase'
import type {
  ForecastResponse,
  GeocodingResult,
  LeaderboardEntry,
  Location,
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

// Geocoding
export async function geocode(query: string): Promise<GeocodingResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
  const res = await fetch(url)
  const data = await res.json()
  return (data.results ?? []) as GeocodingResult[]
}

// Forecast
export async function getForecast(lat: number, lon: number, name: string, locationId?: number): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), name,
    ...(locationId ? { location_id: String(locationId) } : {}),
  })
  return apiFetch<ForecastResponse>(`/forecast?${params}`)
}

// Locations
export async function getLocations(): Promise<Location[]> {
  return apiFetch<Location[]>('/locations')
}

export async function createLocation(name: string, lat: number, lon: number, isPublic = false): Promise<Location> {
  return apiFetch<Location>('/locations', {
    method: 'POST',
    body: JSON.stringify({ name, lat, lon, is_public: isPublic }),
  })
}

export async function deleteLocation(id: number): Promise<void> {
  await apiFetch(`/locations/${id}`, { method: 'DELETE' })
}

// Reports
export async function submitReport(report: ReportCreate): Promise<void> {
  await apiFetch('/reports', { method: 'POST', body: JSON.stringify(report) })
}

export async function getMyReports(): Promise<ReportRead[]> {
  return apiFetch<ReportRead[]>('/reports/mine')
}

export async function getLocationStats(locationId: number) {
  return apiFetch(`/reports/stats/${locationId}`)
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
  return apiFetch<LeaderboardEntry[]>('/profile/leaderboard')
}

// Tides & Currents
export async function getTides(lat: number, lon: number, name: string, date?: string): Promise<TidesResponse> {
  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), name,
    ...(date ? { date } : {}),
  })
  return apiFetch<TidesResponse>(`/tides?${params}`)
}

// Location history
export async function getLocationHistory(locationId: number) {
  return apiFetch<{
    location_id: number
    location_name: string
    report_count: number
    logs: Array<{
      id: number
      date: string
      diver: string
      actual_vis: number
      predicted_vis: number
      error: number
      wave_height: number | null
      swell_height: number | null
      wind_speed: number | null
      notes: string | null
    }>
  }>(`/reports/location/${locationId}/history`)
}