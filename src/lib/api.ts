import { supabase } from './supabase'
import { cacheGet, cacheSet, cacheDelete, cacheDeleteByPrefix } from './cache'
import type {
  AdminStats,
  Announcement,
  AnnouncementInput,
  ForumCategory,
  ForumCategoryView,
  ForumPost,
  ForumThreadDetail,
  ApneaDifficulty,
  ApneaTable,
  ApneaTableCreate,
  ApneaTableType,
  ApneaTableUpdate,
  BestVisResponse,
  CatchCreate,
  CatchRead,
  CleaningResult,
  DataDispute,
  DataDisputeCreate,
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
  SatelliteImagery,
  SeabedClass,
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

// Parse FastAPI-style `{"detail": "..."}` error bodies into a clean message.
// Falls back to the raw body if it isn't JSON or has no usable detail field.
export function parseErrorBody(body: string): string {
  if (!body) return ''
  const trimmed = body.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return body
  try {
    const parsed = JSON.parse(trimmed)
    const detail = parsed?.detail
    if (typeof detail === 'string') return detail
    // FastAPI validation errors return detail as an array of {msg, loc, ...}.
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0]
      if (first && typeof first.msg === 'string') return first.msg
    }
    if (typeof parsed?.message === 'string') return parsed.message
    return body
  } catch {
    return body
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
          const message = parseErrorBody(body)
          if (res.status === 401) throw new AuthError(message || 'Not authenticated')
          if (res.status === 429) throw new RateLimitError(message || 'Too many requests — please wait a moment')
          if (res.status >= 500) {
            lastError = new ServerError(res.status, message || 'Server error')
            if (attempt < maxAttempts - 1) {
              await new Promise(r => setTimeout(r, 1000))
              continue
            }
            throw lastError
          }
          throw new ApiError(res.status, message || `Request failed (${res.status})`)
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
  SATELLITE: 60 * 60 * 1000,    // 1 hour  – satellite imagery updates ~daily
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

// Spot key sync
export async function getSpotKeyMaterial(): Promise<string | null> {
  const data = await apiFetch<{ key_material: string | null }>('/profile/me/spot-key')
  return data.key_material
}

export async function saveSpotKeyMaterial(keyMaterial: string): Promise<void> {
  await apiFetch('/profile/me/spot-key', {
    method: 'PUT',
    body: JSON.stringify({ key_material: keyMaterial }),
  })
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

/**
 * Update per-site bathymetry/substrate used by the seabed-resuspension model
 * (issue #155). Only the spot's creator may edit it. PATCH semantics: omit a
 * field to leave it unchanged; send `null` to clear it.
 */
export async function updateLocation(
  id: number,
  params: { depth_m?: number | null; seabed_class?: SeabedClass | null },
): Promise<Location> {
  const result = await apiFetch<Location>(`/locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  })
  cacheDelete('locations')
  // Depth/seabed feed the resuspension model, so cached forecasts are now stale.
  // Match the full `forecast:` key namespace (see getForecast) so we don't wipe
  // unrelated keys that merely start with "forecast".
  cacheDeleteByPrefix('forecast:')
  return result
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

// Satellite imagery (true-colour + chlorophyll) for a location/date
export async function getSatelliteImagery(lat: number, lon: number, date?: string): Promise<SatelliteImagery> {
  const key = `satellite:${lat}:${lon}:${date ?? 'today'}`
  const cached = cacheGet<SatelliteImagery>(key)
  if (cached) return cached

  const params = new URLSearchParams({
    lat: String(lat), lon: String(lon),
    ...(date ? { date } : {}),
  })
  const result = await apiFetch<SatelliteImagery>(`/satellite/imagery?${params}`)
  cacheSet(key, result, TTL.SATELLITE)
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

export async function getDataOverview(): Promise<import('../types').DataOverview> {
  return apiFetch('/admin/data-overview')
}

export async function getOutlierPreview(): Promise<OutlierPreview> {
  return apiFetch<OutlierPreview>('/admin/outliers/preview')
}

export async function runOutlierCleaning(): Promise<CleaningResult> {
  const result = await apiFetch<CleaningResult>('/admin/outliers/clean', { method: 'POST' })
  // Outlier cleaning changes report quarantine state across many locations;
  // invalidate every cached stats/history view plus the leaderboard.
  cacheDeleteByPrefix('stats:')
  cacheDeleteByPrefix('history:')
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
  // Invalidate every cached stats/history view so subsequent reads are fresh.
  cacheDeleteByPrefix('stats:')
  cacheDeleteByPrefix('history:')
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

// ── Admin operational console ────────────────────────────────────────────
export async function getAdminHealth(): Promise<import('../types').AdminHealth> {
  return apiFetch('/admin/health')
}

export async function getAdminSites(): Promise<import('../types').AdminSitesResponse> {
  return apiFetch('/admin/sites')
}

export async function getAdminForecastDebug(locationId: number): Promise<import('../types').AdminForecastDebug> {
  return apiFetch(`/admin/forecast-debug/${locationId}`)
}

export async function refreshAdminForecast(locationId?: number): Promise<{ invalidated: number; location_id: number | null }> {
  // Guard on `!= null` (not truthy) so ``locationId === 0`` still routes to
  // the scoped invalidation path — the signature allows it and future site
  // IDs could conceivably start at zero.
  const qs = locationId != null ? `?location_id=${locationId}` : ''
  const result = await apiFetch<{ invalidated: number; location_id: number | null }>(`/admin/forecast/refresh${qs}`, {
    method: 'POST',
  })
  // Cached forecasts on the client are now stale too.
  cacheDeleteByPrefix('forecast:')
  return result
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
// Service Status
export type ServiceHealth = { status: 'up' | 'down'; checked_at: string }
export interface ServiceStatusResponse {
  open_meteo?: ServiceHealth
  copernicus?: ServiceHealth
  erddap?: ServiceHealth
}

export async function getServiceStatus(): Promise<ServiceStatusResponse> {
  return apiFetch<ServiceStatusResponse>('/status')
}

// Apnea training tables
export interface ApneaListParams {
  scope?: 'all' | 'mine' | 'public' | 'system'
  difficulty?: ApneaDifficulty
  table_type?: ApneaTableType
}

export async function getApneaTables(params: ApneaListParams = {}): Promise<ApneaTable[]> {
  const qs = new URLSearchParams()
  if (params.scope) qs.set('scope', params.scope)
  if (params.difficulty) qs.set('difficulty', params.difficulty)
  if (params.table_type) qs.set('table_type', params.table_type)
  const path = qs.toString() ? `/apnea/tables?${qs}` : '/apnea/tables'
  return apiFetch<ApneaTable[]>(path)
}

export async function getApneaTable(id: number): Promise<ApneaTable> {
  return apiFetch<ApneaTable>(`/apnea/tables/${id}`)
}

export async function createApneaTable(data: ApneaTableCreate): Promise<ApneaTable> {
  return apiFetch<ApneaTable>('/apnea/tables', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateApneaTable(id: number, data: ApneaTableUpdate): Promise<ApneaTable> {
  return apiFetch<ApneaTable>(`/apnea/tables/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteApneaTable(id: number): Promise<void> {
  await apiFetch(`/apnea/tables/${id}`, { method: 'DELETE' })
}

export async function copyApneaTable(id: number): Promise<ApneaTable> {
  return apiFetch<ApneaTable>(`/apnea/tables/${id}/copy`, { method: 'POST' })
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

// Data Disputes
export async function submitDispute(data: DataDisputeCreate): Promise<DataDispute> {
  return apiFetch<DataDispute>('/disputes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getMyDisputes(): Promise<DataDispute[]> {
  return apiFetch<DataDispute[]>('/disputes/mine')
}

export async function listDisputes(status?: string): Promise<DataDispute[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<DataDispute[]>(`/disputes${qs}`)
}

export async function reviewDispute(
  id: number,
  body: { status: 'accepted' | 'rejected'; admin_notes?: string },
): Promise<DataDispute> {
  return apiFetch<DataDispute>(`/disputes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

// ── News / Announcements ──────────────────────────────────────────────────
export async function getNews(opts?: { includeUnpublished?: boolean; limit?: number; category?: string }): Promise<Announcement[]> {
  const qs = new URLSearchParams()
  if (opts?.includeUnpublished) qs.set('include_unpublished', 'true')
  if (opts?.limit) qs.set('limit', String(opts.limit))
  if (opts?.category) qs.set('category', opts.category)
  const q = qs.toString()
  const data = await apiFetch<{ items: Announcement[] }>(`/news${q ? `?${q}` : ''}`)
  return data.items
}

export async function createNews(input: AnnouncementInput): Promise<Announcement> {
  return apiFetch<Announcement>('/news', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateNews(id: number, input: Partial<AnnouncementInput>): Promise<Announcement> {
  return apiFetch<Announcement>(`/news/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function deleteNews(id: number): Promise<void> {
  await apiFetch(`/news/${id}`, { method: 'DELETE' })
}

// ── Discussion forum ──────────────────────────────────────────────────────
export async function getForumCategories(): Promise<ForumCategory[]> {
  const data = await apiFetch<{ categories: ForumCategory[] }>('/forum/categories')
  return data.categories
}

export async function getForumCategory(slug: string, opts?: { limit?: number; offset?: number }): Promise<ForumCategoryView> {
  const qs = new URLSearchParams()
  if (opts?.limit) qs.set('limit', String(opts.limit))
  if (opts?.offset) qs.set('offset', String(opts.offset))
  const q = qs.toString()
  return apiFetch<ForumCategoryView>(`/forum/categories/${encodeURIComponent(slug)}${q ? `?${q}` : ''}`)
}

export async function getForumThread(id: number): Promise<ForumThreadDetail> {
  return apiFetch<ForumThreadDetail>(`/forum/threads/${id}`)
}

export async function createForumThread(slug: string, title: string, body: string): Promise<{ id: number; title: string; slug: string }> {
  return apiFetch(`/forum/categories/${encodeURIComponent(slug)}/threads`, {
    method: 'POST',
    body: JSON.stringify({ title, body }),
  })
}

export async function createForumPost(threadId: number, body: string): Promise<ForumPost> {
  return apiFetch<ForumPost>(`/forum/threads/${threadId}/posts`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export async function deleteForumPost(postId: number): Promise<void> {
  await apiFetch(`/forum/posts/${postId}`, { method: 'DELETE' })
}

// ── Competition operations (admin-only) ────────────────────────────────────
// Every call hits /admin/competition, which the backend guards with
// require_admin (401 unauthenticated, 403 non-admin). The UI is additionally
// hidden behind the server-verified is_admin flag.
import type {
  Competition,
  CompetitionInput,
  CompetitionTeam,
  CompetitionTeamInput,
  Competitor,
  CompetitorInput,
  WaterStatusBoard,
  CompetitorStatus,
  FishEntry,
  FishEntryInput,
  CompetitionIncident,
  IncidentInput,
  ScoringRule,
  ScoringRuleInput,
  CompetitionResults,
  OpenCompetition,
  MyCompetition,
  MyRegistration,
  RegistrationInput,
  NotificationStatus,
  TestAlertResult,
  AutoPairResult,
} from '../types'

const COMP_BASE = '/admin/competition'

export async function listCompetitions(): Promise<Competition[]> {
  const data = await apiFetch<{ items: Competition[] }>(COMP_BASE)
  return data.items
}

export async function getCompetition(id: number): Promise<Competition> {
  return apiFetch<Competition>(`${COMP_BASE}/${id}`)
}

export async function createCompetition(input: CompetitionInput): Promise<Competition> {
  return apiFetch<Competition>(COMP_BASE, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateCompetition(id: number, input: Partial<CompetitionInput>): Promise<Competition> {
  return apiFetch<Competition>(`${COMP_BASE}/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function deleteCompetition(id: number): Promise<void> {
  await apiFetch(`${COMP_BASE}/${id}`, { method: 'DELETE' })
}

// Teams / buddies
export async function listTeams(cid: number): Promise<CompetitionTeam[]> {
  const data = await apiFetch<{ items: CompetitionTeam[] }>(`${COMP_BASE}/${cid}/teams`)
  return data.items
}

export async function createTeam(cid: number, input: CompetitionTeamInput): Promise<CompetitionTeam> {
  return apiFetch<CompetitionTeam>(`${COMP_BASE}/${cid}/teams`, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateTeam(cid: number, teamId: number, input: Partial<CompetitionTeamInput>): Promise<CompetitionTeam> {
  return apiFetch<CompetitionTeam>(`${COMP_BASE}/${cid}/teams/${teamId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function deleteTeam(cid: number, teamId: number): Promise<void> {
  await apiFetch(`${COMP_BASE}/${cid}/teams/${teamId}`, { method: 'DELETE' })
}

// Competitors
export interface CompetitorFilters {
  status?: CompetitorStatus
  q?: string
  unpaid?: boolean
  no_team?: boolean
}

export async function listCompetitors(cid: number, filters?: CompetitorFilters): Promise<Competitor[]> {
  const qs = new URLSearchParams()
  if (filters?.status) qs.set('status', filters.status)
  if (filters?.q) qs.set('q', filters.q)
  if (filters?.unpaid) qs.set('unpaid', 'true')
  if (filters?.no_team) qs.set('no_team', 'true')
  const q = qs.toString()
  const data = await apiFetch<{ items: Competitor[] }>(`${COMP_BASE}/${cid}/competitors${q ? `?${q}` : ''}`)
  return data.items
}

export async function createCompetitor(cid: number, input: CompetitorInput): Promise<Competitor> {
  return apiFetch<Competitor>(`${COMP_BASE}/${cid}/competitors`, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateCompetitor(cid: number, competitorId: number, input: Partial<CompetitorInput>): Promise<Competitor> {
  return apiFetch<Competitor>(`${COMP_BASE}/${cid}/competitors/${competitorId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function deleteCompetitor(cid: number, competitorId: number): Promise<void> {
  await apiFetch(`${COMP_BASE}/${cid}/competitors/${competitorId}`, { method: 'DELETE' })
}

// Water status board
export async function getBoard(cid: number): Promise<WaterStatusBoard> {
  return apiFetch<WaterStatusBoard>(`${COMP_BASE}/${cid}/board`)
}

export async function getOverdue(cid: number): Promise<WaterStatusBoard> {
  return apiFetch<WaterStatusBoard>(`${COMP_BASE}/${cid}/overdue`)
}

export async function setWaterStatus(
  cid: number,
  competitorId: number,
  status: CompetitorStatus,
  note?: string,
): Promise<Competitor> {
  return apiFetch<Competitor>(`${COMP_BASE}/${cid}/competitors/${competitorId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, note: note ?? null }),
  })
}

// Fish weigh-in
export async function listFish(
  cid: number,
  filters?: { competitor_id?: number; team_id?: number; species?: string },
): Promise<FishEntry[]> {
  const qs = new URLSearchParams()
  if (filters?.competitor_id) qs.set('competitor_id', String(filters.competitor_id))
  if (filters?.team_id) qs.set('team_id', String(filters.team_id))
  if (filters?.species) qs.set('species', filters.species)
  const q = qs.toString()
  const data = await apiFetch<{ items: FishEntry[] }>(`${COMP_BASE}/${cid}/fish${q ? `?${q}` : ''}`)
  return data.items
}

export async function getSpeciesList(cid: number): Promise<string[]> {
  const data = await apiFetch<{ species: string[] }>(`${COMP_BASE}/${cid}/species`)
  return data.species
}

export async function createFish(cid: number, input: FishEntryInput): Promise<FishEntry> {
  return apiFetch<FishEntry>(`${COMP_BASE}/${cid}/fish`, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateFish(cid: number, fishId: number, input: Partial<FishEntryInput>): Promise<FishEntry> {
  return apiFetch<FishEntry>(`${COMP_BASE}/${cid}/fish/${fishId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function deleteFish(cid: number, fishId: number): Promise<void> {
  await apiFetch(`${COMP_BASE}/${cid}/fish/${fishId}`, { method: 'DELETE' })
}

// Incidents
export async function listIncidents(cid: number, resolved?: boolean): Promise<CompetitionIncident[]> {
  const qs = resolved === undefined ? '' : `?resolved=${resolved}`
  const data = await apiFetch<{ items: CompetitionIncident[] }>(`${COMP_BASE}/${cid}/incidents${qs}`)
  return data.items
}

export async function createIncident(cid: number, input: IncidentInput): Promise<CompetitionIncident> {
  return apiFetch<CompetitionIncident>(`${COMP_BASE}/${cid}/incidents`, { method: 'POST', body: JSON.stringify(input) })
}

export async function updateIncident(cid: number, incidentId: number, input: Partial<IncidentInput>): Promise<CompetitionIncident> {
  return apiFetch<CompetitionIncident>(`${COMP_BASE}/${cid}/incidents/${incidentId}`, { method: 'PUT', body: JSON.stringify(input) })
}

// Scoring & results
export async function getScoringRule(cid: number): Promise<ScoringRule> {
  return apiFetch<ScoringRule>(`${COMP_BASE}/${cid}/scoring-rule`)
}

export async function updateScoringRule(cid: number, input: ScoringRuleInput): Promise<ScoringRule> {
  return apiFetch<ScoringRule>(`${COMP_BASE}/${cid}/scoring-rule`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function getResults(cid: number): Promise<CompetitionResults> {
  return apiFetch<CompetitionResults>(`${COMP_BASE}/${cid}/results`)
}

// CSV export. apiFetch always parses JSON, so CSV downloads use a dedicated
// authenticated fetch that streams the response into a browser download. `kind`
// maps to the export endpoints: competitors | teams | water-log | fish | results.
export type CsvExportKind = 'competitors' | 'teams' | 'water-log' | 'fish' | 'results'

export async function downloadCompetitionCsv(cid: number, kind: CsvExportKind): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  const res = await fetch(`${API_BASE}${COMP_BASE}/${cid}/export/${kind}.csv`, { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, parseErrorBody(body) || `Export failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${kind}_competition_${cid}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Dive-day: randomly pair every competitor still without a buddy (admin-only).
export async function autoPairBuddies(cid: number): Promise<AutoPairResult> {
  return apiFetch<AutoPairResult>(`${COMP_BASE}/${cid}/auto-pair-buddies`, { method: 'POST' })
}

// Overdue safety notifications (admin-only).
// Whether Slack/email are configured at the deployment level + escalation cadence.
export async function getNotificationStatus(): Promise<NotificationStatus> {
  return apiFetch<NotificationStatus>(`${COMP_BASE}/notifications/status`)
}

// Fire a harmless test alert on this competition's enabled channels.
export async function sendTestAlert(
  cid: number,
  channel: 'slack' | 'email' | 'both' = 'both',
): Promise<TestAlertResult> {
  return apiFetch<TestAlertResult>(`${COMP_BASE}/${cid}/test-alert?channel=${channel}`, { method: 'POST' })
}

// ── Self-service competition registration (logged-in divers) ────────────────
// Hits /competition (get_current_user, any account — not admin). Lets a diver
// browse open competitions, register themselves, nominate a buddy by email, and
// manage or withdraw their own registration.
const REG_BASE = '/competition'

export async function listOpenCompetitions(): Promise<OpenCompetition[]> {
  const data = await apiFetch<{ items: OpenCompetition[] }>(`${REG_BASE}/open`)
  return data.items
}

// Competitions the current diver is registered for (run-up + live day), each
// with their own water status. Keeps the event visible after sign-ups close.
export async function listMyCompetitions(): Promise<MyCompetition[]> {
  const data = await apiFetch<{ items: MyCompetition[] }>(`${REG_BASE}/mine`)
  return data.items
}

export async function getOpenCompetition(cid: number): Promise<OpenCompetition> {
  return apiFetch<OpenCompetition>(`${REG_BASE}/${cid}`)
}

export async function registerForCompetition(cid: number, input: RegistrationInput): Promise<MyRegistration> {
  return apiFetch<MyRegistration>(`${REG_BASE}/${cid}/register`, { method: 'POST', body: JSON.stringify(input) })
}

export async function getMyRegistration(cid: number): Promise<MyRegistration> {
  return apiFetch<MyRegistration>(`${REG_BASE}/${cid}/registration`)
}

export async function updateMyRegistration(cid: number, input: Partial<RegistrationInput>): Promise<MyRegistration> {
  return apiFetch<MyRegistration>(`${REG_BASE}/${cid}/registration`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function withdrawRegistration(cid: number): Promise<void> {
  await apiFetch(`${REG_BASE}/${cid}/registration`, { method: 'DELETE' })
}
