import { useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './SpotsMap.module.css'
import { createLocation } from '../lib/api'

interface DiveSpot {
  name: string
  lat: number
  lon: number
  description: string
  userAdded?: boolean
  id?: string
  isPublic?: boolean
  createdBy?: string
  createdAt?: number
}

interface Props {
  onSelectSpot: (lat: number, lon: number, name: string) => void
  center?: [number, number]
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

export const UK_DIVE_SPOTS: DiveSpot[] = [
  // Northeast England
  { name: 'St Abbs', lat: 55.897, lon: -2.138, description: 'Marine reserve with excellent visibility and diverse marine life' },
  { name: 'Eyemouth', lat: 55.871, lon: -2.090, description: 'Kelp forests and scenic wall dives' },
  { name: 'Farne Islands', lat: 55.618, lon: -1.649, description: 'Grey seal colony and colourful reef walls' },
  { name: 'Seahouses', lat: 55.585, lon: -1.655, description: 'Gateway to Farne Islands with wrecks nearby' },
  { name: 'Beadnell', lat: 55.552, lon: -1.638, description: 'Sheltered bay with shallow reef dives' },
  { name: 'Seaton Sluice', lat: 55.081, lon: -1.478, description: 'Shore dive with reefs and occasional wreck debris' },
  { name: 'Tynemouth', lat: 55.017, lon: -1.423, description: 'North Sea shore dives with reefs and wrecks offshore' },
  { name: 'Marsden Bay', lat: 54.997, lon: -1.375, description: 'Limestone sea stacks and cave diving' },
  { name: 'Hartlepool', lat: 54.694, lon: -1.213, description: 'Offshore wrecks and rocky reef dives' },
  { name: 'Whitby', lat: 54.489, lon: -0.613, description: 'Historic harbour town with wreck diving nearby' },
  { name: 'Scarborough', lat: 54.280, lon: -0.401, description: 'North Sea wrecks and rocky reef dives' },
  { name: 'Filey Brigg', lat: 54.217, lon: -0.270, description: 'Rocky headland with kelp beds and nudibranchs' },
  { name: 'Flamborough Head', lat: 54.116, lon: -0.082, description: 'Chalk cliffs and cave diving' },
  { name: 'Bridlington', lat: 54.083, lon: -0.193, description: 'Shallow reef dives with flatfish and crabs' },
  // Scotland
  { name: 'Bass Rock', lat: 56.078, lon: -2.640, description: 'Dramatic rock faces and gannet colony' },
  { name: 'Dunbar', lat: 56.003, lon: -2.518, description: 'Shore diving with rocky reefs and diverse life' },
  { name: 'Stonehaven', lat: 56.963, lon: -2.212, description: 'Rocky reefs and sheltered harbour dives' },
  { name: 'Oban', lat: 56.412, lon: -5.471, description: 'Wreck capital of Scotland with varied diving' },
  { name: 'Sound of Mull', lat: 56.516, lon: -5.864, description: 'Sheltered sound with spectacular wreck diving' },
  { name: 'Loch Carron', lat: 57.383, lon: -5.550, description: 'Scenic sea loch with sea life and wrecks' },
  { name: 'Isle of Skye', lat: 57.274, lon: -6.216, description: 'Remote diving with seals and basking sharks' },
  { name: 'Scapa Flow', lat: 58.883, lon: -3.098, description: 'World-famous WWI wreck site in Orkney' },
  { name: 'Shetland', lat: 60.154, lon: -1.145, description: 'Remote northern diving with stunning clarity' },
  { name: 'St Kilda', lat: 57.814, lon: -8.570, description: 'Remote archipelago with outstanding underwater scenery' },
  // Northern Ireland
  { name: "Brown's Bay", lat: 54.803, lon: -5.737, description: 'Sheltered sandy bay on Islandmagee with easy shore diving' },
  { name: 'Rathlin Island', lat: 55.300, lon: -6.197, description: 'Dramatic wrecks and abundant sea life off Northern Ireland' },
  { name: 'Ballycastle', lat: 55.208, lon: -6.243, description: 'North Antrim coast dives with kelp and sea urchins' },
  { name: 'Strangford Lough', lat: 54.380, lon: -5.607, description: 'Tidal narrows teeming with marine biodiversity' },
  // Southwest England
  { name: 'Plymouth', lat: 50.376, lon: -4.143, description: 'Wrecks, reefs and marine biology haven' },
  { name: 'Wembury', lat: 50.321, lon: -4.062, description: 'Marine conservation area with diverse reef life' },
  { name: 'Dartmouth', lat: 50.351, lon: -3.577, description: 'Estuary and offshore reef diving with wrecks' },
  { name: 'Torbay', lat: 50.462, lon: -3.525, description: 'Sheltered bay with wrecks and soft coral' },
  { name: 'Portland', lat: 50.573, lon: -2.450, description: 'Shore dives and quarry with clear water' },
  { name: 'Chesil Cove', lat: 50.543, lon: -2.444, description: 'Popular shore dive entry point' },
  { name: 'Chesil Beach', lat: 50.610, lon: -2.558, description: 'Shore dive with seasonal visibility' },
  { name: 'Swanage', lat: 50.609, lon: -1.960, description: 'Pier diving and the famous Swanage Pier' },
  { name: 'Kimmeridge Bay', lat: 50.607, lon: -2.117, description: 'Jurassic Coast shore dive and marine reserve' },
  { name: 'Lundy Island', lat: 51.174, lon: -4.668, description: 'Marine conservation zone with seal dives' },
  { name: 'Porthkerris', lat: 50.053, lon: -5.070, description: 'Shore dive on the Lizard Peninsula' },
  { name: 'Falmouth', lat: 50.154, lon: -5.064, description: 'Sheltered harbour with wrecks and reefs' },
  { name: 'Mevagissey', lat: 50.270, lon: -4.778, description: 'Cornish fishing port with reef and wreck dives nearby' },
  { name: 'Isles of Scilly', lat: 49.914, lon: -6.315, description: 'Crystal-clear waters with abundant marine life' },
  // South England
  { name: 'Bournemouth', lat: 50.714, lon: -1.870, description: 'Pier dive and shallow reef in sheltered bay' },
  { name: 'Poole', lat: 50.715, lon: -1.988, description: 'Shallow harbour and offshore wrecks' },
  { name: 'Selsey', lat: 50.730, lon: -0.790, description: 'Mixon Hole reef and lobster spotting' },
  { name: 'Brighton', lat: 50.815, lon: -0.137, description: 'Marina wreck and pier dives' },
  { name: 'Eastbourne', lat: 50.768, lon: 0.282, description: 'Shore dives with chalk reef and wrecks offshore' },
  { name: 'Hastings', lat: 50.856, lon: 0.571, description: 'Shallow reef dives with historic wreck sites' },
  { name: 'Folkestone', lat: 51.081, lon: 1.167, description: 'Underwater sculpture park and reef dives' },
  { name: 'Dover', lat: 51.127, lon: 1.329, description: 'English Channel wrecks and white cliff walls' },
  { name: 'The Needles', lat: 50.664, lon: -1.591, description: 'Isle of Wight chalk stacks with wrecks nearby' },
  // Wales
  { name: 'Dale', lat: 51.709, lon: -5.158, description: 'Pembrokeshire coast with seal encounters' },
  { name: 'Pembrokeshire', lat: 51.748, lon: -5.047, description: 'Spectacular coast with diverse marine life' },
  { name: 'Ramsey Island', lat: 51.873, lon: -5.323, description: 'Tidal races and grey seal breeding grounds' },
  { name: 'Bardsey Island', lat: 52.757, lon: -4.795, description: 'Remote island with clear water and porpoise' },
  { name: 'Anglesey', lat: 53.258, lon: -4.310, description: 'Strong currents with wrecks and reefs' },
  // Inland
  { name: 'Capernwray', lat: 54.150, lon: -2.758, description: 'Inland dive centre with sunken attractions' },
  { name: 'Stoney Cove', lat: 52.567, lon: -1.212, description: 'UK\'s national diving centre, inland quarry' },
  { name: 'Chepstow Quarry', lat: 51.643, lon: -2.672, description: 'Inland quarry dive site with clear freshwater' },
]

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

export function SpotsMap({ onSelectSpot, center }: Props) {
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
      createdBy: 'You',
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

    setUserVoteChoices(prevChoices => {
      const existing = prevChoices[key]

      let voteDelta: number
      let nextChoices: Record<string, 'up' | 'down'>

      if (existing === direction) {
        // Clicking same button again — toggle off (remove vote)
        voteDelta = direction === 'up' ? -1 : 1
        nextChoices = { ...prevChoices }
        delete nextChoices[key]
      } else if (existing) {
        // Switching vote (e.g. up → down): reverse previous + apply new
        voteDelta = direction === 'up' ? 2 : -2
        nextChoices = { ...prevChoices, [key]: direction }
      } else {
        // Fresh vote
        voteDelta = delta
        nextChoices = { ...prevChoices, [key]: direction }
      }

      // Check whether the vote total would go negative before committing
      const currentTotal = votes[key] ?? 0
      if (currentTotal + voteDelta < 0) return prevChoices

      setVotes(prevVotes => {
        const current = prevVotes[key] ?? 0
        const updated = current + voteDelta
        if (updated < 0) return prevVotes // safety guard
        const next = { ...prevVotes, [key]: updated }
        saveVotes(next)
        return next
      })
      saveUserVoteChoices(nextChoices)
      return nextChoices
    })
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
                      aria-pressed={userVoteChoices[spotKey(spot)] === 'up'}
                    >
                      👍
                    </button>
                    <span className={styles.voteCount}>{votes[spotKey(spot)] ?? 0}</span>
                    <button
                      className={`${styles.voteBtn} ${userVoteChoices[spotKey(spot)] === 'down' ? styles.voteBtnActive : ''}`}
                      onClick={() => handleVote(spot, -1)}
                      aria-label="Downvote this spot"
                      aria-pressed={userVoteChoices[spotKey(spot)] === 'down'}
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
          <button className={styles.addSpotBtn} onClick={() => setAdding(true)}>
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
