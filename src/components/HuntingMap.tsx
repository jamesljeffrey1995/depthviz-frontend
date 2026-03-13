import { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getCurrents } from '../lib/api'
import styles from './HuntingMap.module.css'

interface Props {
  lat: number
  lon: number
  locationName: string
}

export function HuntingMap({ lat, lon, locationName }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<L.Map | null>(null)
  const overlayLayersRef = useRef<L.Layer[]>([])
  const [data, setData] = useState<Awaited<ReturnType<typeof getCurrents>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  const dateOptions = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  }), [])

  // Init map on mount
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    const map = L.map(mapRef.current, {
      center: [lat, lon],
      zoom: 9,
      zoomControl: true,
    })

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }
    ).addTo(map)

    L.tileLayer(
      'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
      { attribution: '&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>', maxZoom: 18, opacity: 0.8 }
    ).addTo(map)

    leafletMapRef.current = map

    return () => {
      map.remove()
      leafletMapRef.current = null
    }
  }, [])

  // Fetch data when location or date changes
  useEffect(() => {
    setLoading(true)
    setError(null)
    getCurrents(lat, lon, selectedDate)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e instanceof Error ? e.message : 'Failed to fetch'); setLoading(false) })
  }, [lat, lon, selectedDate])

  // Draw overlays when data changes
  useEffect(() => {
    const map = leafletMapRef.current
    if (!map || !data) return

    // Clear previous overlays
    overlayLayersRef.current.forEach(l => map.removeLayer(l))
    overlayLayersRef.current = []

    data.grid.forEach(cell => {
      if (cell.speed < 0.01) return

      // Hunting zone glow
      if (cell.hunting_score > 0.6) {
        const opacity = 0.2 + cell.hunting_score * 0.4
        const radius = 4000 + cell.hunting_score * 4000
        const zone = L.circle([cell.lat, cell.lon], {
          radius,
          color: '#ff6b00',
          fillColor: '#ff6b00',
          fillOpacity: opacity * 0.4,
          weight: 1,
          opacity,
        }).addTo(map)
        overlayLayersRef.current.push(zone)
      }

      // Arrow colour: teal (slow) → amber (fast)
      const t = Math.min(cell.speed / 1.0, 1.0)
      const r = Math.round(t * 255)
      const g = Math.round(200 - t * 100)
      const b = Math.round(200 - t * 200)
      const colour = `rgb(${r},${g},${b})`

      // Scale length by speed — 0.015 deg ≈ ~1.5km at zoom 9, readable without dominating
      const arrowLen = 0.015 + cell.speed * 0.02
      const rad = (cell.heading * Math.PI) / 180
      const endLat = cell.lat + arrowLen * Math.cos(rad)
      const endLon = cell.lon + arrowLen * Math.sin(rad)

      const arrow = L.polyline([[cell.lat, cell.lon], [endLat, endLon]], {
        color: colour,
        weight: 3,
        opacity: 0.9,
      }).addTo(map)
      overlayLayersRef.current.push(arrow)

      const tip = L.circleMarker([endLat, endLon], {
        radius: 3,
        color: colour,
        fillColor: colour,
        fillOpacity: 1,
        weight: 0,
      }).addTo(map)
      overlayLayersRef.current.push(tip)
    })

    map.setView([data.lat, data.lon], 9)
  }, [data])

  const formatDate = (d: string) => {
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    if (d === today) return 'Today'
    if (d === tomorrow) return 'Tomorrow'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatSpeed = (ms: number) => `${(ms * 100).toFixed(0)} cm/s`

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.title}>HUNTING MAP</div>
        <div className={styles.location}>{locationName}</div>
      </div>

      <div className={styles.datePicker}>
        {dateOptions.map(d => (
          <button
            key={d}
            className={`${styles.dateBtn} ${d === selectedDate ? styles.dateBtnActive : ''}`}
            onClick={() => setSelectedDate(d)}
          >
            {formatDate(d)}
          </button>
        ))}
      </div>

      {data && !loading && (
        <div className={styles.statsBar}>
          <div className={styles.stat}>
            <span className={styles.statVal}>{formatSpeed(data.peak_speed)}</span>
            <span className={styles.statLbl}>Peak current</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statVal} style={{ color: data.hunting_zones > 0 ? 'var(--warning)' : 'var(--text)' }}>
              {data.hunting_zones}
            </span>
            <span className={styles.statLbl}>Hunting zones</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statVal} style={{ color: data.estimated ? 'var(--warning)' : 'var(--good)' }}>
              {data.peak_tidal_hour !== null ? `${String(data.peak_tidal_hour).padStart(2,'0')}:00` : '—'}
            </span>
            <span className={styles.statLbl}>Peak tidal hour</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statVal} style={{ color: data.model.startsWith('IBI') ? 'var(--good)' : 'var(--warning)', fontSize: '0.7rem' }}>
              {data.model}
            </span>
            <span className={styles.statLbl}>Model</span>
          </div>
        </div>
      )}

      <div className={styles.mapContainer}>
        {loading && (
          <div className={styles.mapOverlay}>
            <div className={styles.sonar} />
            <div className={styles.loadingText}>Fetching current data...</div>
          </div>
        )}
        {error && !loading && (
          <div className={styles.mapOverlay}>
            <div className={styles.errorText}>{error}</div>
          </div>
        )}
        <div ref={mapRef} className={styles.map} />
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendArrow} style={{ color: 'rgb(0,200,200)' }}>→</span>
          <span>Slow current</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendArrow} style={{ color: 'rgb(255,100,0)' }}>→</span>
          <span>Fast current</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendGlow}>●</span>
          <span>Hunting zone (current shear)</span>
        </div>
      </div>

      <div className={styles.disclaimer}>
        IBI tidal model (~3km) where available · Global model (~9km) elsewhere · Always check local conditions
      </div>
    </div>
  )
}