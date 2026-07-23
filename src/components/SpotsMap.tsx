import { useState, useCallback, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { User } from '@supabase/supabase-js'
import styles from './SpotsMap.module.css'
import { createLocation, voteLocation, removeVote } from '../lib/api'
import type { Location } from '../types'

/** Shape of a private user spot stored in localStorage. */
interface PrivateSpot {
  id?: string
  name: string
  lat: number
  lon: number
  description: string
  createdAt?: number
}

interface Props {
  onSelectSpot: (lat: number, lon: number, name: string, locationId?: number) => void
  center?: [number, number]
  user?: User | null
  onShowAuth?: () => void
  locations?: Location[]
}

const STORAGE_KEY = 'depthviz_user_spots'

/** Haversine distance in metres between two lat/lon points */
function haversineMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Marker fills are literal hex, not var() — these render inside a standalone
// SVG data-URI image with no access to the app's CSS custom properties, so
// the values below are hand-matched to --accent / --sev-marginal / --sev-good
// in index.css rather than left to drift independently.

// Predefined spot marker — known dive site (accent teal)
const predefinedIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
    '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#0e7c86"/>' +
    '<circle cx="12" cy="12" r="5" fill="#0b1622"/>' +
    '</svg>'
  ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// User-added private spot marker (amber) — center glyph is a small padlock so
// "private" reads by shape, not just hue, for colorblind users (see the
// matching .popupUserBadge text label for the same reason).
const privateSpotIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
    '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#985c16"/>' +
    '<circle cx="12" cy="12" r="5" fill="#0b1622"/>' +
    '<rect x="9.5" y="11.5" width="5" height="3.5" rx="0.6" fill="#985c16"/>' +
    '<path d="M10.3 11.5v-1.3a1.7 1.7 0 0 1 3.4 0v1.3" stroke="#985c16" stroke-width="0.9" fill="none"/>' +
    '</svg>'
  ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// Public spot marker (green) — plain dot, distinct from the private pin's lock glyph
const publicSpotIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
    '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#237744"/>' +
    '<circle cx="12" cy="12" r="5" fill="#0b1622"/>' +
    '</svg>'
  ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// Pending position marker — transient, shown only while placing a new spot
const pendingIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
    '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#0e7c86" opacity="0.55"/>' +
    '<circle cx="12" cy="12" r="5" fill="#0b1622" opacity="0.7"/>' +
    '</svg>'
  ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// Centre of UK
const UK_CENTER: [number, number] = [54.5, -3.5]
const UK_ZOOM = 5

function loadPrivateSpots(): PrivateSpot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s: unknown) =>
        s !== null &&
        typeof s === 'object' &&
        typeof (s as PrivateSpot).name === 'string' &&
        typeof (s as PrivateSpot).lat === 'number' &&
        typeof (s as PrivateSpot).lon === 'number'
    )
  } catch {
    return []
  }
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function SpotsMap({ onSelectSpot, center, user, onShowAuth, locations = [] }: Props) {
  const [privateSpots, setPrivateSpots] = useState<PrivateSpot[]>(loadPrivateSpots)
  const [adding, setAdding] = useState(false)
  const [pendingPos, setPendingPos] = useState<{ lat: number; lon: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [proximityError, setProximityError] = useState('')
  const [syncWarning, setSyncWarning] = useState('')

  // DB-backed vote state: keyed by location.id
  const makeDbVoteCounts = (locs: Location[]): Record<number, number> => {
    const result: Record<number, number> = {}
    for (const l of locs) result[l.id] = l.vote_count
    return result
  }
  const makeDbUserVotes = (locs: Location[]): Record<number, 'up' | 'down' | null> => {
    const result: Record<number, 'up' | 'down' | null> = {}
    for (const l of locs) result[l.id] = l.user_vote
    return result
  }
  const [dbVoteCounts, setDbVoteCounts] = useState<Record<number, number>>(() =>
    makeDbVoteCounts(locations)
  )
  const [dbUserVotes, setDbUserVotes] = useState<Record<number, 'up' | 'down' | null>>(() =>
    makeDbUserVotes(locations)
  )
  const [voteError, setVoteError] = useState<string | null>(null)
  const voteErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear vote error timeout on unmount
  useEffect(() => () => {
    if (voteErrorTimer.current) clearTimeout(voteErrorTimer.current)
  }, [])

  // Track which locations have an in-flight vote to prevent race conditions
  const votingInFlight = useRef<Set<number>>(new Set())

  // Keep DB vote state in sync when locations prop refreshes,
  // but skip locations with in-flight votes to avoid overwriting optimistic state
  useEffect(() => {
    setDbVoteCounts(prev => {
      const next = { ...prev }
      for (const l of locations) {
        if (!votingInFlight.current.has(l.id)) next[l.id] = l.vote_count
      }
      return next
    })
    setDbUserVotes(prev => {
      const next = { ...prev }
      for (const l of locations) {
        if (!votingInFlight.current.has(l.id)) next[l.id] = l.user_vote
      }
      return next
    })
  }, [locations])

  // Migrate: strip any old public/userAdded spots from localStorage
  // (they now live exclusively in the DB)
  useEffect(() => {
    const cleaned = privateSpots.filter((s: PrivateSpot & { isPublic?: boolean; userAdded?: boolean }) => !s.isPublic)
    if (cleaned.length !== privateSpots.length) {
      setPrivateSpots(cleaned)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** DB locations not already covered by a private localStorage spot */
  const dbLocations = locations.filter(loc =>
    !privateSpots.some(s => haversineMetres(s.lat, s.lon, loc.lat, loc.lon) < 50)
  )

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (!adding) return
    setPendingPos({ lat, lon })
    setProximityError('')
  }, [adding])

  const handleAddSpotClick = () => {
    if (user || !onShowAuth) {
      setAdding(true)
    } else {
      onShowAuth()
    }
  }

  const handleSaveSpot = async () => {
    if (!pendingPos || !newName.trim()) return

    // 100m proximity check for public spots against all DB locations
    if (isPublic) {
      const tooCloseDb = locations.find(
        l => l.is_public && haversineMetres(l.lat, l.lon, pendingPos.lat, pendingPos.lon) < 100,
      )
      if (tooCloseDb) {
        setProximityError(
          `Too close to existing public spot "${tooCloseDb.name}" (must be \u2265 100 m apart)`,
        )
        return
      }
    }

    if (isPublic) {
      // Public spots go straight to the DB — no localStorage
      try {
        await createLocation(newName.trim(), pendingPos.lat, pendingPos.lon, true)
      } catch {
        setSyncWarning('Could not publish spot — try again later.')
        return
      }
    } else {
      // Private spots are localStorage-only
      const spot: PrivateSpot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: newName.trim(),
        lat: pendingPos.lat,
        lon: pendingPos.lon,
        description: newDesc.trim() || 'User-added dive spot',
        createdAt: Date.now(),
      }
      const updated = [...privateSpots, spot]
      setPrivateSpots(updated)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }

    setAdding(false)
    setPendingPos(null)
    setNewName('')
    setNewDesc('')
    setIsPublic(false)
    setProximityError('')
  }

  const handleCancelAdd = () => {
    setAdding(false)
    setPendingPos(null)
    setNewName('')
    setNewDesc('')
    setIsPublic(false)
    setProximityError('')
  }

  const handleRemovePrivateSpot = (spot: PrivateSpot) => {
    const updated = spot.id
      ? privateSpots.filter(s => s.id !== spot.id)
      : privateSpots.filter(s => !(s.name === spot.name && s.lat === spot.lat && s.lon === spot.lon))
    setPrivateSpots(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const handleDbVote = useCallback(async (locationId: number, direction: 'up' | 'down') => {
    // Prevent rapid double-clicks from corrupting state
    if (votingInFlight.current.has(locationId)) return
    votingInFlight.current.add(locationId)
    setVoteError(null)

    const existing = dbUserVotes[locationId]
    const prevCount = dbVoteCounts[locationId] ?? 0

    // Optimistic update
    const isUnvote = existing === direction
    const optimisticVote = isUnvote ? null : direction
    const optimisticDelta = isUnvote ? (existing === 'up' ? -1 : 1) : (direction === 'up' ? (existing === 'down' ? 2 : 1) : (existing === 'up' ? -2 : -1))
    setDbVoteCounts(prev => ({ ...prev, [locationId]: Math.max(0, prevCount + optimisticDelta) }))
    setDbUserVotes(prev => ({ ...prev, [locationId]: optimisticVote }))

    try {
      let updated: Location
      if (isUnvote) {
        updated = await removeVote(locationId)
      } else {
        updated = await voteLocation(locationId, direction)
      }
      // Sync with server response
      setDbVoteCounts(prev => ({ ...prev, [locationId]: updated.vote_count }))
      setDbUserVotes(prev => ({ ...prev, [locationId]: updated.user_vote }))
    } catch {
      // Rollback on failure and show brief error
      setDbVoteCounts(prev => ({ ...prev, [locationId]: prevCount }))
      setDbUserVotes(prev => ({ ...prev, [locationId]: existing }))
      setVoteError('Vote failed — please try again')
      if (voteErrorTimer.current) clearTimeout(voteErrorTimer.current)
      voteErrorTimer.current = setTimeout(() => setVoteError(null), 3000)
    } finally {
      votingInFlight.current.delete(locationId)
    }
  }, [dbUserVotes, dbVoteCounts])

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>UK Dive Spots</div>
      <div className={`${styles.mapContainer} ${adding ? styles.mapAdding : ''}`}>
        <MapContainer
          center={center ?? UK_CENTER}
          zoom={center ? 11 : UK_ZOOM}
          className={styles.map}
          scrollWheelZoom={true}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {adding && <MapClickHandler onMapClick={handleMapClick} />}
          {/* DB locations: predefined (cyan) and user-created public (green) */}
          {dbLocations.map(loc => {
            const voteCount = dbVoteCounts[loc.id] ?? 0
            const userVote = dbUserVotes[loc.id]
            const icon = loc.is_predefined ? predefinedIcon : publicSpotIcon
            return (
              <Marker
                key={`db-${loc.id}`}
                position={[loc.lat, loc.lon]}
                icon={icon}
              >
                <Popup>
                  <div className={styles.popup}>
                    {!loc.is_predefined && (
                      <div className={styles.popupPublicBadge}>Public Spot</div>
                    )}
                    <div className={styles.popupName}>{loc.name}</div>
                    <div className={styles.voteRow}>
                      <button
                        className={`${styles.voteBtn} ${userVote === 'up' ? styles.voteBtnActive : ''}`}
                        onClick={() => handleDbVote(loc.id, 'up')}
                        aria-label="Upvote this spot"
                      >
                        👍
                      </button>
                      <span className={styles.voteCount}>{voteCount}</span>
                      <button
                        className={`${styles.voteBtn} ${userVote === 'down' ? styles.voteBtnActive : ''}`}
                        onClick={() => handleDbVote(loc.id, 'down')}
                        aria-label="Downvote this spot"
                      >
                        👎
                      </button>
                    </div>
                    <button
                      className={styles.popupBtn}
                      onClick={() => onSelectSpot(loc.lat, loc.lon, loc.name, loc.id)}
                    >
                      View Forecast &rsaquo;
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
          {/* Private localStorage spots (amber) */}
          {privateSpots.map(spot => (
            <Marker
              key={spot.id ?? `priv-${spot.name}-${spot.lat}-${spot.lon}`}
              position={[spot.lat, spot.lon]}
              icon={privateSpotIcon}
            >
              <Popup>
                <div className={styles.popup}>
                  <div className={styles.popupUserBadge}>My Spot (private)</div>
                  <div className={styles.popupName}>{spot.name}</div>
                  <div className={styles.popupDesc}>{spot.description}</div>
                  <button
                    className={styles.popupBtn}
                    onClick={() => onSelectSpot(spot.lat, spot.lon, spot.name)}
                  >
                    View Forecast &rsaquo;
                  </button>
                  <button
                    className={styles.popupRemoveBtn}
                    onClick={() => handleRemovePrivateSpot(spot)}
                  >
                    Remove Spot
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          {pendingPos && (
            <Marker position={[pendingPos.lat, pendingPos.lon]} icon={pendingIcon}>
              <Popup>
                <div className={styles.popup}>
                  <div className={styles.popupDesc}>
                    {pendingPos.lat.toFixed(4)}, {pendingPos.lon.toFixed(4)}
                  </div>
                  <div className={styles.popupDesc}>Fill in name below and save</div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className={styles.controls}>
        {adding ? (
          <div className={styles.addForm}>
            <div className={styles.addFormTitle}>Add a Dive Spot</div>
            <div className={styles.addFormPrivacy}>
              {isPublic
                ? 'This spot will be submitted for public visibility'
                : 'Saved to this browser only — not visible to other users'}
            </div>
            {!pendingPos ? (
              <div className={styles.addFormHint}>Click anywhere on the map to place your spot</div>
            ) : (
              <div className={styles.addFormHint}>
                {pendingPos.lat.toFixed(4)}, {pendingPos.lon.toFixed(4)} — tap map to reposition
              </div>
            )}
            {proximityError && (
              <div className={styles.addFormError}>{proximityError}</div>
            )}
            <div className={styles.addFormField}>
              <label className={styles.addFormLabel}>Visibility</label>
              <div className={styles.toggleRow}>
                <button
                  className={`${styles.toggleBtn} ${!isPublic ? styles.toggleBtnActive : ''}`}
                  onClick={() => { setIsPublic(false); setProximityError('') }}
                  type="button"
                >
                  Private
                </button>
                <button
                  className={`${styles.toggleBtn} ${isPublic ? styles.toggleBtnActivePublic : ''}`}
                  onClick={() => { setIsPublic(true); setProximityError('') }}
                  type="button"
                >
                  Public
                </button>
              </div>
              {isPublic && (
                <div className={styles.addFormHint}>
                  Public spots must be &ge; 100 m from other public spots
                </div>
              )}
            </div>
            <div className={styles.addFormField}>
              <label className={styles.addFormLabel}>Spot name</label>
              <input
                className={styles.addFormInput}
                type="text"
                placeholder="e.g. My Local Reef"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className={styles.addFormField}>
              <label className={styles.addFormLabel}>Description (optional)</label>
              <input
                className={styles.addFormInput}
                type="text"
                placeholder="e.g. Rocky reef with crabs"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className={styles.addFormActions}>
              <button
                className={styles.addFormSaveBtn}
                onClick={handleSaveSpot}
                disabled={!pendingPos || !newName.trim()}
              >
                Save Spot
              </button>
              <button className={styles.addFormCancelBtn} onClick={handleCancelAdd}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.addSpotRow}>
            <button className={styles.addSpotBtn} onClick={handleAddSpotClick}>
              + Add a Spot
            </button>
            {privateSpots.length > 0 && (
              <span className={styles.userSpotsCount}>
                {privateSpots.length} private spot{privateSpots.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {voteError && (
        <div className={styles.addFormError}>{voteError}</div>
      )}

      {syncWarning && (
        <div className={styles.addFormError}>
          {syncWarning}
          <button
            className={styles.addFormCancelBtn}
            onClick={() => setSyncWarning('')}
            style={{ marginLeft: 8, padding: '4px 10px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.hint}>Tap a marker to view forecasts for that spot</div>
    </div>
  )
}
