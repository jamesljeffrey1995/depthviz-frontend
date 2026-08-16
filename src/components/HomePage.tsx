import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNews } from '../lib/api'
import type { Announcement, ForecastResponse } from '../types'
import { IconArrowRight, IconWaves, IconWind, IconThermometer } from './icons'
import styles from './HomePage.module.css'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface HomePageProps {
  locationSearch: ReactNode
  forecast: ForecastResponse | null
  currentName: string
}

function cachedForecast(): ForecastResponse | null {
  try {
    const raw = localStorage.getItem('dv_last_forecast')
    return raw ? (JSON.parse(raw) as { forecast?: ForecastResponse }).forecast ?? null : null
  } catch {
    return null
  }
}

export function HomePage({ locationSearch, forecast, currentName }: HomePageProps) {
  const navigate = useNavigate()
  const [news, setNews] = useState<Announcement[]>([])
  const preview = forecast ?? cachedForecast()
  const day = preview?.days[0]
  const unit = preview?.units ?? 'm'
  const vis = day ? day.vis_corrected ?? day.vis_estimate : null

  const trendPath = useMemo(() => {
    if (!preview || preview.days.length < 2) return ''
    const values = preview.days.slice(0, 7).map(item => item.vis_corrected ?? item.vis_estimate)
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const range = Math.max(max - min, 1)
    return values.map((value, index) => {
      const x = 8 + (index / (values.length - 1)) * 284
      const y = 92 - ((value - min) / range) * 68
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }, [preview])

  useEffect(() => {
    let cancelled = false
    getNews({ limit: 2 })
      .then(items => { if (!cancelled) setNews(items) })
      .catch(() => { if (!cancelled) setNews([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1>Know the water<br />before you enter it.</h1>
        <p>Visibility forecasts, sea conditions and reports from divers on the coast.</p>
        <div className={styles.search}>{locationSearch}</div>
      </section>

      <div className={styles.pulse} aria-hidden="true"><span /><i /><span /></div>

      <section className={styles.forecast} aria-labelledby="nearby-heading">
        <header className={styles.forecastHead}>
          <div>
            <span>Nearby forecast</span>
            <h2 id="nearby-heading">{preview?.location_name || currentName || 'Choose a coastal location'}</h2>
          </div>
          <small>{preview ? 'Latest saved forecast' : 'Search to read live conditions'}</small>
        </header>

        {day && vis != null ? (
          <>
            <div className={styles.primaryReading}>
              <div>
                <span className={`${styles.status} ${styles[`status_${day.color_class}`]}`}>{day.verdict}</span>
                <strong>{vis.toFixed(1)}<em>{unit}</em></strong>
                <p>{preview.model_confidence === 'none' ? 'Regional estimate' : `${preview.model_confidence} confidence`} · {day.is_forecast ? 'Forecast' : 'Observed'}</p>
              </div>
              <div className={styles.trend}>
                <span>Visibility trend</span>
                <svg viewBox="0 0 300 110" role="img" aria-label="Seven day visibility trend">
                  <path className={styles.area} d={`${trendPath} L292 104 L8 104 Z`} />
                  <path className={styles.line} d={trendPath} />
                  <circle cx="8" cy={trendPath ? trendPath.match(/^M[\d.]+ ([\d.]+)/)?.[1] : 0} r="4" />
                </svg>
              </div>
            </div>
            <div className={styles.conditions}>
              <div><IconWaves /><span>Swell<strong>{day.swell_height.toFixed(1)}{unit}</strong></span></div>
              <div><IconWind /><span>Wind<strong>{Math.round(day.wind_speed)} kn</strong></span></div>
              <div><IconThermometer /><span>Water<strong>{day.sea_temp == null ? '—' : `${day.sea_temp.toFixed(1)}°`}</strong></span></div>
              <div><span>Algae<strong>{day.algae.risk}</strong></span></div>
            </div>
            <button className={styles.openForecast} onClick={() => navigate('/forecast')}>
              Open detailed forecast <IconArrowRight aria-hidden="true" />
            </button>
          </>
        ) : (
          <div className={styles.emptyForecast}>
            <p>Search a beach, headland or coordinates to see visibility, swell, wind and tide conditions.</p>
            <button onClick={() => navigate('/map')}>Browse the map <IconArrowRight /></button>
          </div>
        )}
      </section>

      {news.length > 0 && (
        <section className={styles.updates} aria-labelledby="updates-heading">
          <header><span>Field notes</span><h2 id="updates-heading">From DepthViz</h2></header>
          {news.map(item => (
            <button key={item.id} onClick={() => navigate('/news')}>
              <span><strong>{item.title}</strong>{item.summary || item.body.slice(0, 120)}</span>
              <small>{timeAgo(item.created_at)}</small>
            </button>
          ))}
        </section>
      )}
    </div>
  )
}
