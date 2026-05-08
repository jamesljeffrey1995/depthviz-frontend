import { supabase } from './supabase'
import { cacheGet, cacheSet, cacheDelete } from './cache'
import type {
  AdminStats,
  BestVisResponse,
  CatchCreate,
  CatchRead,
  CleaningResult,
  FeedItem,
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

// --- Error types for granular handling ---
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class AuthError extends ApiError {
  constructor(message: string) {
    super(401, message)
    this.name = 'AuthError'
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string) {
    super(429, message)
    this.name = 'RateLimitError'
  }
}

export class ServerError extends ApiError {
  constructor(status: number, message: string) {
    super(status, message)
    this.name = 'ServerError'
  }
}

// --- Request deduplication ---
const pendingRequests = new Map<string, Promise<unknown>>()

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

  const method = options?.method ?? 'GET'
  const isRead = method === 'GET'

  // Deduplicate identical in-flight GET requests
  const dedupeKey = isRead ? `${method}:${path}` : ''
  if (isRead && pendingRequests.has(dedupeKey)) {
    return pendingRequests.get(dedupeKey) as Promise<T>
  }

  const doFetch = async (): Promise<T> => {
    let lastError: Error | null = null
    const maxAttempts = isRead ? 2 : 1 // Retry reads once on server/network error

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

        if (!res.ok) {
          const body = await res.text()
          if (res.status === 401) throw new AuthError(body || 'Not authenticated')
          if (res.status === 429) throw new RateLimitError('Too many requests — please wait a moment')
          if (res.status >= 500) {
            lastError = new ServerError(res.status, body || 'Server error')
            if (attempt < maxAttempts - 1) {
              await new Promise(r => setTimeout(r, 1000))
              continue
            }
            throw lastError
          }
          throw new ApiError(res.status, body || `Request failed (${res.status})`)
        }

        if (res.status === 204) return undefined as T
        return res.json()
      } catch (e) {
        if (e instanceof ApiError) throw e
        // Network error — retry reads
        lastError = e instanceof Error ? e : new Error('Network error')
        if (attempt < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 1000))
          continue
        }
        throw lastError
      }
    }

    throw lastError ?? new Error('Request failed')
  }

  if (isRead) {
    const promise = doFetch().finally(() => pendingRequests.delete(dedupeKey))
    pendingRequests.set(dedupeKey, promise)
    return promise
  }

  return doFetch()
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
export async function getForecast(lat: number, lon: number, name: string, units: 'ft' | 'm' = 'ft', locationId?: number): Promise<ForecastResponse> {
  const key = `forecast:${lat}:${lon}:${locationId ?? ''}:${units}`
  const cached = cacheGet<ForecastResponse>(key)
  if (cached) return cached

  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon), name, units,
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

export async function createLocation(
  name: string, lat: number, lon: number,
  isPublic = false,
  encryptedCoords?: { encrypted_lat: string; encrypted_lon: string },
): Promise<Location> {
  const result = await apiFetch<Location>('/locations', {
    method: 'POST',
    body: JSON.stringify({
      name,
      is_public: isPublic,
      ...(isPublic ? { lat, lon } : {}),
      ...(!isPublic && encryptedCoords ? encryptedCoords : {}),
    }),
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
  const result = await apiFetch<CleaningResult>('/admin/outliers/clean', { method: 'POST' })
  // Outlier cleaning changes report quarantine state; invalidate related cached views
  cacheDelete('stats:')
  cacheDelete('history:')
  cacheDelete('leaderboard')
  return result
}

export async function getQuarantinedReports(locationId?: number): Promise<QuarantinedListResponse> {
  const params = locationId
    ? `?${new URLSearchParams({ location_id: String(locationId) }).toString()}`
    : ''
  return apiFetch<QuarantinedListResponse>(`/admin/outliers/quarantined${params}`)
}

export async function restoreReport(reportId: number): Promise<void> {
  await apiFetch(`/admin/outliers/restore/${reportId}`, { method: 'POST' })
  // Restoring a report can affect stats, history, and leaderboard views.
  // Invalidate relevant cached entries so subsequent reads are fresh.
  cacheDelete('stats:')
  cacheDelete('history:')
  cacheDelete('leaderboard')
}

export async function quarantineReport(reportId: number): Promise<void> {
  await apiFetch(`/admin/outliers/quarantine/${reportId}`, { method: 'POST' })
}

// Admin — ML Model
export async function getMLStatus(): Promise<import('../types').MLStatus> {
  return apiFetch('/admin/ml/status')
}

export async function forceRetrain(): Promise<import('../types').MLRetrainResult> {
  return apiFetch('/admin/ml/retrain', { method: 'POST' })
}

export async function getMLPredictions(): Promise<import('../types').MLPredictions> {
  return apiFetch('/admin/ml/predictions')
}

export async function getFeatureImportance(): Promise<import('../types').FeatureImportanceResponse> {
  return apiFetch('/admin/ml/feature-importance')
}

// ML Weights (public, cached)
export interface ModelWeights {
  swell_multiplier: number
  wind_multiplier: number
  rain_multiplier: number
  updated_at: string | null
}

let _cachedWeights: ModelWeights | null = null

export async function getModelWeights(): Promise<ModelWeights> {
  if (_cachedWeights) return _cachedWeights

  const key = 'ml-weights'
  const cached = cacheGet<ModelWeights>(key)
  if (cached) {
    _cachedWeights = cached
    return cached
  }

  const result = await apiFetch<ModelWeights>('/forecast/weights')
  cacheSet(key, result, TTL.FORECAST)
  _cachedWeights = result
  return result
}

// Catches
export async function getCatches(params?: { species?: string; location_id?: string }): Promise<CatchRead[]> {
  const qs = params ? '?' + new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  ).toString() : ''
  return apiFetch(`/catches${qs}`)
}

export async function getMyCatches(): Promise<CatchRead[]> {
  return apiFetch('/catches/mine')
}

export async function logCatch(data: CatchCreate): Promise<CatchRead> {
  const result = await apiFetch<CatchRead>('/catches', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return result
}

export async function deleteCatch(id: number): Promise<void> {
  await apiFetch(`/catches/${id}`, { method: 'DELETE' })
}

export async function getCatchSpecies(): Promise<{ species: string; count: number }[]> {
  return apiFetch('/catches/species')
}

// Social / Friends
export async function getFriends(): Promise<import('../types').Friend[]> {
  return apiFetch('/social/friends')
}

export async function getFriendRequests(): Promise<import('../types').FriendRequest[]> {
  return apiFetch('/social/friend-requests')
}

export async function respondToFriendRequest(id: number, status: 'accepted' | 'declined'): Promise<void> {
  await apiFetch(`/social/friend-requests/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export async function removeFriend(friendshipId: number): Promise<void> {
  await apiFetch(`/social/friends/${friendshipId}`, { method: 'DELETE' })
}

export async function sendFriendRequest(addresseeUid: string): Promise<void> {
  await apiFetch('/social/friend-request', {
    method: 'POST',
    body: JSON.stringify({ addressee_uid: addresseeUid }),
  })
}

export async function searchUsers(q: string): Promise<import('../types').UserSearchResult[]> {
  return apiFetch(`/social/users/search?q=${encodeURIComponent(q)}`)
}

// Activity Feed
export async function getFeed(params: {
  scope: 'all' | 'friends'
  filter_type: 'all' | 'reports' | 'catches'
  limit: number
  offset: number
}): Promise<{ items: FeedItem[]; total: number }> {
  const qs = new URLSearchParams({
    scope: params.scope,
    filter_type: params.filter_type,
    limit: String(params.limit),
    offset: String(params.offset),
  }).toString()
  return apiFetch(`/feed?${qs}`)
}
