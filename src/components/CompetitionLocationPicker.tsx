import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getLocations } from '../lib/api'
import { resolveCssVar } from '../lib/cssVar'
import type { Location } from '../types'
import styles from './CompetitionLocationPicker.module.css'

/** A point picked on the map — either an existing spot pin or a dropped marker. */
export interface PickedPoint {
  lat: number
  lon: number
  name: string
}

interface Props {
  /** Currently selected point (or null if none set yet). */
  value: { lat: number | null; lon: number | null; name: string | null }
  onChange: (point: PickedPoint | null) => void
  /** Marker colour for the picked point — distinguishes meeting point vs dive area. */
  accent?: 'cyan' | 'red'
  label?: string
}

const UK_CENTER: [number, number] = [54.5, -3.5]

function pin(color: string, opacity = 1): L.Icon {
  const hole = resolveCssVar('--ds-ink-950', '#05161b')
  return new L.Icon({
    iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">' +
      `<path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" opacity="${opacity}"/>` +
      `<circle cx="12" cy="12" r="5" fill="${hole}"/>` +
      '</svg>',
    ),
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  })
}

/**
 * Marker icons in the same categorical palette as the spots map so organisers
 * recognise the pins. Leaflet serialises each into an SVG `data:` URI where CSS
 * `var()` can't resolve, so the fills are read from the tokens at mount (via
 * useMemo) — see buildPickerIcons and tokens.css `--ds-cat-*`. Fallbacks mirror
 * the palette for the (client-only, effectively unreachable) pre-CSS path. */
function buildPickerIcons() {
  return {
    predefined: pin(resolveCssVar('--ds-cat-1', '#1ca3ec')), // predefined dive spots (blue)
    public:     pin(resolveCssVar('--ds-cat-6', '#22b573')), // user-created public spots (green)
    selectedCyan: pin(resolveCssVar('--ds-cat-1', '#1ca3ec')), // selected = dive area (blue)
    selectedRed:  pin(resolveCssVar('--ds-cat-5', '#ff6b6b')), // selected = meeting point (coral)
  }
}

function ClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) { onClick(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

/**
 * Map-based location picker that surfaces the same dive-spot "pins" used on the
 * visibility/spots map. Tap a known spot to use it, or click anywhere to drop a
 * custom point. Used to set a competition's dive area and meeting point.
 */
export function CompetitionLocationPicker({ value, onChange, accent = 'cyan', label }: Props) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    getLocations().then(setLocations).catch(() => setLoadErr('Could not load saved spots.'))
  }, [])

  // Icons resolved from the categorical palette tokens once at mount.
  const icons = useMemo(buildPickerIcons, [])

  const selected = value.lat != null && value.lon != null
    ? { lat: value.lat, lon: value.lon, name: value.name ?? '' }
    : null
  const selectedIcon = accent === 'red' ? icons.selectedRed : icons.selectedCyan
  const center: [number, number] = selected ? [selected.lat, selected.lon] : UK_CENTER

  return (
    <div className={styles.wrapper}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.mapContainer}>
        <MapContainer
          center={center}
          zoom={selected ? 12 : 6}
          className={styles.map}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onClick={(lat, lon) => onChange({ lat, lon, name: value.name ?? '' })} />

          {locations.map(loc => (
            <Marker
              key={`loc-${loc.id}`}
              position={[loc.lat, loc.lon]}
              icon={loc.is_predefined ? icons.predefined : icons.public}
            >
              <Popup>
                <div className={styles.popup}>
                  <div className={styles.popupName}>{loc.name}</div>
                  <button
                    className={styles.popupBtn}
                    type="button"
                    onClick={() => onChange({ lat: loc.lat, lon: loc.lon, name: loc.name })}
                  >
                    Use this spot
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {selected && (
            <Marker position={[selected.lat, selected.lon]} icon={selectedIcon}>
              <Popup>
                <div className={styles.popup}>
                  <div className={styles.popupName}>{selected.name || 'Selected point'}</div>
                  <div className={styles.popupCoords}>
                    {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className={styles.row}>
        {selected ? (
          <span className={styles.coords}>
            📍 {selected.name ? `${selected.name} · ` : ''}
            {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}
          </span>
        ) : (
          <span className={styles.hint}>Tap a spot pin, or click the map to drop a point.</span>
        )}
        {selected && (
          <button className={styles.clearBtn} type="button" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
      {loadErr && <div className={styles.hint}>{loadErr}</div>}
    </div>
  )
}
