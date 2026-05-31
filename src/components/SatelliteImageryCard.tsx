import { useEffect, useState } from 'react'
import { getSatelliteImagery } from '../lib/api'
import type { SatelliteImagery, SatelliteLayer } from '../types'
import styles from './SatelliteImageryCard.module.css'

interface Props {
  lat: number
  lon: number
  /** ISO date (YYYY-MM-DD) of the selected forecast day. */
  date: string
}

/** Individual image tile — tracks its own load/error state so one upstream
 *  outage (e.g. no cloud-free chlorophyll) doesn't blank the whole card. */
function ImageTile({ layer }: { layer: SatelliteLayer }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  return (
    <figure className={styles.tile}>
      <div className={styles.imageWrap}>
        {status !== 'error' ? (
          <img
            className={styles.image}
            src={layer.url}
            alt={`${layer.title} satellite image`}
            loading="lazy"
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
            style={{ opacity: status === 'ok' ? 1 : 0 }}
          />
        ) : null}
        {status === 'loading' && (
          <div className={styles.placeholder}>Loading…</div>
        )}
        {status === 'error' && (
          <div className={styles.placeholder}>
            No {layer.kind === 'chlorophyll' ? 'cloud-free ocean-colour' : 'imagery'} available
          </div>
        )}
      </div>
      <figcaption className={styles.caption}>
        <div className={styles.captionHead}>
          <span className={styles.tileTitle}>{layer.title}</span>
          <span className={styles.tileDate}>
            {layer.image_date}
            {!layer.is_exact_date && <span className={styles.approx} title="Nearest available imagery"> ~</span>}
          </span>
        </div>
        <div className={styles.tileDesc}>{layer.description}</div>
        <div className={styles.tileSource}>{layer.attribution}</div>
      </figcaption>
    </figure>
  )
}

/**
 * Shows satellite imagery for the selected dive spot and day: a true-colour
 * snapshot and a chlorophyll-a ocean-colour map. The image bytes are fetched
 * by the browser directly from the public upstream services (NASA GIBS / NOAA
 * CoastWatch) — the API only supplies the URLs.
 */
export function SatelliteImageryCard({ lat, lon, date }: Props) {
  const [data, setData] = useState<SatelliteImagery | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(false)
    getSatelliteImagery(lat, lon, date)
      .then(res => { if (!cancelled) setData(res) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [lat, lon, date])

  if (error) return null

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.label}>Satellite Imagery</div>
      </div>
      {data ? (
        <div className={styles.grid}>
          {data.layers.map(layer => (
            <ImageTile key={layer.kind} layer={layer} />
          ))}
        </div>
      ) : (
        <div className={styles.loadingRow}>Loading satellite imagery…</div>
      )}
      <div className={styles.footnote}>
        Daily layers may lag clear-sky passes. True-colour from NASA GIBS; chlorophyll-a from
        NOAA CoastWatch; high-res 10 m mosaic © Sentinel-2 cloudless (s2maps.eu) by EOX.
      </div>
    </div>
  )
}
