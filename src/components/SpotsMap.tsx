import { useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { User } from '@supabase/supabase-js'
import styles from './SpotsMap.module.css'
import { createLocation } from '../lib/api'
import { UK_DIVE_SPOTS } from '../data/diveSpots'
import type { DiveSpot } from '../data/diveSpots'

interface Props {
  onSelectSpot: (lat: number, lon: number, name: string) => void
  center?: [number, number]
  user?: User | null
  onShowAuth?: () => void
}

const STORAGE_KEY = 'depthviz_user_spots'
const VOTES_STORAGE_KEY = 'depthviz_spot_votes'
const USER_VOTES_STORAGE_KEY = 'depthviz_user_vote_choices'

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

function loadVotes(): Record<string, number> {
  try {
    const raw = localStorage.getItem(VOTES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const sanitised: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v)
      if (Number.isFinite(n) && n >= 0) sanitised[k] = n
    }
    return sanitised
  } catch {
    return {}
  }
}

function saveVotes(votes: Record<string, number>) {
  try {
    localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes))
  } catch {
    // storage full or disabled — vote persists in memory only
  }
}

function loadUserVoteChoices(): Record<string, 'up' | 'down'> {
  try {
    const raw = localStorage.getItem(USER_VOTES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const sanitised: Record<string, 'up' | 'down'> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v === 'up' || v === 'down') sanitised[k] = v
    }
    return sanitised
  } catch {
    return {}
  }
}

function saveUserVoteChoices(choices: Record<string, 'up' | 'down'>) {
  try {
    localStorage.setItem(USER_VOTES_STORAGE_KEY, JSON.stringify(choices))
  } catch {
    // storage full or disabled — persists in memory only
  }
}

function spotKey(spot: DiveSpot): string {
  return spot.id ?? `${spot.name}-${spot.lat}-${spot.lon}`
}

// Built-in spot marker (cyan)
const spotIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
    '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#00c9ff"/>' +
    '<circle cx="12" cy="12" r="5" fill="#020d14"/>' +
    '</svg>'
  ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// User-added spot marker (amber)
const userSpotIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
    '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#ffb800"/>' +
    '<circle cx="12" cy="12" r="5" fill="#020d14"/>' +
    '</svg>'
  ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// User-added PUBLIC spot marker (green)
const publicSpotIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
    '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#2ecc71"/>' +
    '<circle cx="12" cy="12" r="5" fill="#020d14"/>' +
    '</svg>'
  ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// Pending position marker (orange)
const pendingIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
    '<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#ff6b35" opacity="0.85"/>' +
    '<circle cx="12" cy="12" r="5" fill="#020d14"/>' +
    '</svg>'
  ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// Centre of UK
const UK_CENTER: [number, number] = [54.5, -3.5]
const UK_ZOOM = 5

function loadUserSpots(): DiveSpot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (s: unknown) =>
          s !== null &&
          typeof s === 'object' &&
          typeof (s as DiveSpot).name === 'string' &&
          typeof (s as DiveSpot).lat === 'number' &&
          typeof (s as DiveSpot).lon === 'number'
      )
      .map((s: DiveSpot) => ({
        ...s,
        isPublic: s.isPublic === true, // normalise to strict boolean
      }))
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

export function SpotsMap({ onSelectSpot, center, user, onShowAuth }: Props) {
  const [userSpots, setUserSpots] = useState<DiveSpot[]>(loadUserSpots)
  const [adding, setAdding] = useState(false)
  const [pendingPos, setPendingPos] = useState<{ lat: number; lon: number } | null>(null)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [proximityError, setProximityError] = useState('')
  const [syncWarning, setSyncWarning] = useState('')
  const [votes, setVotes] = useState<Record<string, number>>(loadVotes)
  const [userVoteChoices, setUserVoteChoices] = useState<Record<string, 'up' | 'down'>>(loadUserVoteChoices)

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (!adding) return
    setPendingPos({ lat, lon })
    setProximityError('')
  }, [adding])

  const handleAddSpotClick = () => {
    if (user || !onShowAuth) {
      // If user is logged in, or no auth handler is provided (backwards compatibility),
      // just enter add mode.
      setAdding(true)
    } else {
      // If an auth handler is provided and no user is logged in, trigger auth.
      onShowAuth()
    }
  }

  const handleSaveSpot = async () => {
    if (!pendingPos || !newName.trim()) return

    // 100m proximity check for public custom spots
    if (isPublic) {
      const allPublicCustom = userSpots.filter(s => s.isPublic)
      const tooClose = allPublicCustom.find(
        s => haversineMetres(s.lat, s.lon, pendingPos.lat, pendingPos.lon) < 100,
      )
      if (tooClose) {
        setProximityError(
          `Too close to existing public spot "${tooClose.name}" (must be ≥ 100 m apart)`,
        )
        return
      }
    }

    const spot: DiveSpot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: newName.trim(),
      lat: pendingPos.lat,
      lon: pendingPos.lon,
      description: newDesc.trim() || 'User-added dive spot',
      userAdded: true,
      isPublic,
      createdBy: user ? 'You' : undefined,
      createdAt: Date.now(),
    }

    // If public, also push to the backend; downgrade to private on failure
    if (isPublic) {
      try {
        await createLocation(spot.name, spot.lat, spot.lon, true)
      } catch {
        spot.isPublic = false
        setSyncWarning('Could not publish spot — saved as private instead. Try again later.')
      }
    }

    const updated = [...userSpots, spot]
    setUserSpots(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
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

  const handleRemoveUserSpot = (spot: DiveSpot) => {
    const updated = spot.id
      ? userSpots.filter(s => s.id !== spot.id)
      : userSpots.filter(s => !(s.name === spot.name && s.lat === spot.lat && s.lon === spot.lon))
    setUserSpots(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

    // Clean up stale vote and user vote choice entries
    const key = spotKey(spot)
    setVotes(prev => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      saveVotes(next)
      return next
    })
    setUserVoteChoices(prev => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      saveUserVoteChoices(next)
      return next
    })
  }

  const handleVote = (spot: DiveSpot, delta: 1 | -1) => {
    const key = spotKey(spot)
    const direction = delta === 1 ? 'up' : 'down'
    const existing = userVoteChoices[key]

    let voteDelta: number
    let nextChoices: Record<string, 'up' | 'down'>

    if (existing === direction) {
      // Clicking same button again — toggle off (remove vote)
      voteDelta = direction === 'up' ? -1 : 1
      nextChoices = { ...userVoteChoices }
      delete nextChoices[key]
    } else if (existing) {
      // Switching vote (e.g. up → down): reverse previous + apply new
      voteDelta = direction === 'up' ? 2 : -2
      nextChoices = { ...userVoteChoices, [key]: direction }
    } else {
      // Fresh vote
      voteDelta = delta
      nextChoices = { ...userVoteChoices, [key]: direction }
    }

    setVotes(prev => {
      const current = prev[key] ?? 0
      const updated = current + voteDelta
      if (updated < 0) return prev // prevent negative vote totals
      const next = { ...prev, [key]: updated }
      saveVotes(next)
      return next
    })
    setUserVoteChoices(nextChoices)
    saveUserVoteChoices(nextChoices)
  }

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
          {UK_DIVE_SPOTS.map(spot => (
            <Marker key={spot.name} position={[spot.lat, spot.lon]} icon={spotIcon}>
              <Popup>
                <div className={styles.popup}>
                  <div className={styles.popupName}>{spot.name}</div>
                  <div className={styles.popupDesc}>{spot.description}</div>
                  <button
                    className={styles.popupBtn}
                    onClick={() => onSelectSpot(spot.lat, spot.lon, spot.name)}
                  >
                    View Forecast &rsaquo;
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          {userSpots.map((spot) => (
            <Marker
              key={spot.id ?? `user-${spot.name}-${spot.lat}-${spot.lon}`}
              position={[spot.lat, spot.lon]}
              icon={spot.isPublic ? publicSpotIcon : userSpotIcon}
            >
              <Popup>
                <div className={styles.popup}>
                  <div className={spot.isPublic ? styles.popupPublicBadge : styles.popupUserBadge}>
                    {spot.isPublic ? 'Public Spot' : 'My Spot (private)'}
                  </div>
                  <div className={styles.popupName}>{spot.name}</div>
                  <div className={styles.popupDesc}>{spot.description}</div>
                  {spot.createdBy && (
                    <div className={styles.popupCreator}>Added by {spot.createdBy}</div>
                  )}
                  <div className={styles.voteRow}>
                    <button
                      className={`${styles.voteBtn} ${userVoteChoices[spotKey(spot)] === 'up' ? styles.voteBtnActive : ''}`}
                      onClick={() => handleVote(spot, 1)}
                      aria-label="Upvote this spot"
                    >
                      👍
                    </button>
                    <span className={styles.voteCount}>{votes[spotKey(spot)] ?? 0}</span>
                    <button
                      className={`${styles.voteBtn} ${userVoteChoices[spotKey(spot)] === 'down' ? styles.voteBtnActive : ''}`}
                      onClick={() => handleVote(spot, -1)}
                      aria-label="Downvote this spot"
                    >
                      👎
                    </button>
                  </div>
                  <button
                    className={styles.popupBtn}
                    onClick={() => onSelectSpot(spot.lat, spot.lon, spot.name)}
                  >
                    View Forecast &rsaquo;
                  </button>
                  <button
                    className={styles.popupRemoveBtn}
                    onClick={() => handleRemoveUserSpot(spot)}
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
                    {pendingPos.lat.toFixed(4)}°, {pendingPos.lon.toFixed(4)}°
                  </div>
                  <div className={styles.popupDesc}>Fill in name below and save</div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {adding ? (
        <div className={styles.addForm}>
          <div className={styles.addFormTitle}>Add a Dive Spot</div>
          <div className={styles.addFormPrivacy}>
            {isPublic
              ? '🌍 This spot will be submitted for public visibility'
              : '🔒 Saved to this browser only — not visible to other users'}
          </div>
          {!pendingPos ? (
            <div className={styles.addFormHint}>↑ Click anywhere on the map to place your spot</div>
          ) : (
            <div className={styles.addFormHint}>
              📍 {pendingPos.lat.toFixed(4)}°, {pendingPos.lon.toFixed(4)}° — tap map to reposition
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
                🔒 Private
              </button>
              <button
                className={`${styles.toggleBtn} ${isPublic ? styles.toggleBtnActivePublic : ''}`}
                onClick={() => { setIsPublic(true); setProximityError('') }}
                type="button"
              >
                🌍 Public
              </button>
            </div>
            {isPublic && (
              <div className={styles.addFormHint}>
                Public spots must be ≥ 100 m from other public custom spots
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
          {userSpots.length > 0 && (() => {
            const publicCount = userSpots.filter(s => s.isPublic).length
            return (
              <span className={styles.userSpotsCount}>
                {userSpots.length} custom spot{userSpots.length !== 1 ? 's' : ''}
                {' '}({publicCount} public, {userSpots.length - publicCount} private)
              </span>
            )
          })()}
        </div>
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
