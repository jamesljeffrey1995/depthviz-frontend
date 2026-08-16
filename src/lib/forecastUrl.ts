export interface ForecastLocationParams {
  lat: number
  lon: number
  name: string
  locationId?: number | null
}

/** Build a durable forecast URL without exposing more precision than the model uses. */
export function buildForecastPath({ lat, lon, name, locationId }: ForecastLocationParams): string {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
    name,
  })
  if (locationId != null) params.set('locationId', String(locationId))
  return `/forecast?${params.toString()}`
}

/** Parse and validate a shareable forecast URL. Invalid or partial URLs are ignored. */
export function parseForecastLocation(search: string): ForecastLocationParams | null {
  const params = new URLSearchParams(search)
  const rawLat = params.get('lat')
  const rawLon = params.get('lon')
  if (rawLat === null || rawLon === null || rawLat.trim() === '' || rawLon.trim() === '') return null
  const lat = Number(rawLat)
  const lon = Number(rawLon)
  const name = params.get('name')?.trim() ?? ''
  const rawLocationId = params.get('locationId')
  const locationId = rawLocationId === null ? null : Number(rawLocationId)

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null
  if (!name) return null
  if (rawLocationId !== null && (!Number.isInteger(locationId) || (locationId ?? 0) <= 0)) return null

  return { lat, lon, name, locationId }
}
