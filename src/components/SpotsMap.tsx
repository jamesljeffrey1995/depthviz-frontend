import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './SpotsMap.module.css'

interface DiveSpot {
  name: string
  lat: number
  lon: number
  description: string
}

interface Props {
  onSelectSpot: (lat: number, lon: number, name: string) => void
}

const UK_DIVE_SPOTS: DiveSpot[] = [
  { name: 'St Abbs', lat: 55.897, lon: -2.138, description: 'Marine reserve with excellent visibility and diverse marine life' },
  { name: 'Farne Islands', lat: 55.618, lon: -1.649, description: 'Grey seal colony and colourful reef walls' },
  { name: 'Seahouses', lat: 55.585, lon: -1.655, description: 'Gateway to Farne Islands with wrecks nearby' },
  { name: 'Beadnell', lat: 55.552, lon: -1.638, description: 'Sheltered bay with shallow reef dives' },
  { name: 'Eyemouth', lat: 55.871, lon: -2.090, description: 'Kelp forests and scenic wall dives' },
  { name: 'Bass Rock', lat: 56.078, lon: -2.640, description: 'Dramatic rock faces and gannet colony' },
  { name: 'Scapa Flow', lat: 58.883, lon: -3.098, description: 'World-famous WWI wreck site in Orkney' },
  { name: 'Oban', lat: 56.412, lon: -5.471, description: 'Wreck capital of Scotland with varied diving' },
  { name: 'Isle of Skye', lat: 57.274, lon: -6.216, description: 'Remote diving with seals and basking sharks' },
  { name: 'Plymouth', lat: 50.376, lon: -4.143, description: 'Wrecks, reefs and marine biology haven' },
  { name: 'Portland', lat: 50.573, lon: -2.450, description: 'Shore dives and quarry with clear water' },
  { name: 'Swanage', lat: 50.609, lon: -1.960, description: 'Pier diving and the famous Swanage Pier' },
  { name: 'Chesil Beach', lat: 50.610, lon: -2.558, description: 'Shore dive with seasonal visibility' },
  { name: 'Lundy Island', lat: 51.174, lon: -4.668, description: 'Marine conservation zone with seal dives' },
  { name: 'Porthkerris', lat: 50.053, lon: -5.070, description: 'Shore dive on the Lizard Peninsula' },
  { name: 'Falmouth', lat: 50.154, lon: -5.064, description: 'Sheltered harbour with wrecks and reefs' },
  { name: 'Dale', lat: 51.709, lon: -5.158, description: 'Pembrokeshire coast with seal encounters' },
  { name: 'Pembrokeshire', lat: 51.748, lon: -5.047, description: 'Spectacular coast with diverse marine life' },
  { name: 'Anglesey', lat: 53.258, lon: -4.310, description: 'Strong currents with wrecks and reefs' },
  { name: 'Scarborough', lat: 54.280, lon: -0.401, description: 'North Sea wrecks and rocky reef dives' },
  { name: 'Flamborough Head', lat: 54.116, lon: -0.082, description: 'Chalk cliffs and cave diving' },
  { name: 'Selsey', lat: 50.730, lon: -0.790, description: 'Mixon Hole reef and lobster spotting' },
  { name: 'Brighton', lat: 50.815, lon: -0.137, description: 'Marina wreck and pier dives' },
  { name: 'Chesil Cove', lat: 50.543, lon: -2.444, description: 'Popular shore dive entry point' },
  { name: 'Capernwray', lat: 54.150, lon: -2.758, description: 'Inland dive centre with sunken attractions' },
  { name: 'Stoney Cove', lat: 52.567, lon: -1.212, description: 'UK\'s national diving centre, inland quarry' },
]

// Custom marker icon to avoid default Leaflet icon issues with bundlers
const spotIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="%2300c9ff"/>
      <circle cx="12" cy="12" r="5" fill="%23020d14"/>
    </svg>
  `),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// Centre of UK
const UK_CENTER: [number, number] = [54.5, -3.5]
const UK_ZOOM = 5

export function SpotsMap({ onSelectSpot }: Props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>UK Dive Spots</div>
      <div className={styles.mapContainer}>
        <MapContainer
          center={UK_CENTER}
          zoom={UK_ZOOM}
          className={styles.map}
          scrollWheelZoom={true}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
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
        </MapContainer>
      </div>
      <div className={styles.hint}>Tap a marker to view forecasts for that spot</div>
    </div>
  )
}
