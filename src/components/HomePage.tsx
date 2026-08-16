import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNews } from '../lib/api'
import { startRouteTransition } from '../lib/viewTransition'
import type { Announcement, DayForecast, ForecastResponse } from '../types'
import { IconArrowRight } from './icons'
import styles from './HomePage.module.css'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const TOOLS = [
  { label: 'Compare visibility', description: 'Rank nearby sites by forecast visibility and confidence.', path: '/best' },
  { label: 'Read diver reports', description: 'Check what people actually found in the water.', path: '/feed' },
  { label: 'Open the spot map', description: 'Browse the coast and inspect a specific entry point.', path: '/map' },
  { label: 'Run an apnea table', description: 'Build and time dry training sessions.', path: '/training' },
  { label: 'Calculate weighting', description: 'Estimate lead for your suit, body and water type.', path: '/weight' },
]

interface HomePageProps {
  locationSearch: ReactNode
  forecast?: ForecastResponse | null
  units: 'ft' | 'm'
}

function visibility(day: DayForecast): number {
  return day.vis_corrected ?? day.vis_estimate
}

function formatVisibility(value: number, units: 'ft' | 'm'): string {
  return `${value.toFixed(1)} ${units}`
}

function chartPoints(days: DayForecast[]): string {
  if (!days.length) return ''
  const values = days.map(visibility)
  const max = Math.max(1, ...values)
  return values.map((value, index) => {
    const x = days.length === 1 ? 50 : (index / (days.length - 1)) * 100
    const y = 38 - (value / max) * 30
    return `${x},${Math.max(4, y)}`
  }).join(' ')
}

export function HomePage({ locationSearch, forecast, units }: HomePageProps) {
  const rawNavigate = useNavigate()
  const navigate = (path: string) => startRouteTransition(
    () => rawNavigate(path),
    path.startsWith('/forecast') || path.startsWith('/map') || path.startsWith('/best') || path.startsWith('/training')
      ? 'descend'
      : 'same',
  )
  const [news, setNews] = useState<Announcement[]>([])
  const [loadingNews, setLoadingNews] = useState(true)

  useEffect(() => {
    let cancelled = false
    getNews({ limit: 3 })
      .then(items => { if (!cancelled) setNews(items) })
      .catch(() => { if (!cancelled) setNews([]) })
      .finally(() => { if (!cancelled) setLoadingNews(false) })
    return () => { cancelled = true }
  }, [])

  const previewDay = useMemo(() => {
    if (!forecast?.days.length) return null
    const today = new Date().toISOString().split('T')[0]
    return forecast.days.find(day => day.date === today) ?? forecast.days[0] ?? null
  }, [forecast])

  const confidence = forecast?.model_confidence && forecast.model_confidence !== 'none'
    ? `${forecast.model_confidence} confidence`
    : 'Confidence building'

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Underwater visibility forecasts</p>
          <h1 className={styles.heroTitle}>Know the water before you enter it.</h1>
          <p className={styles.heroLead}>
            Visibility forecasts, sea conditions and reports from divers on the coast.
          </p>
        </div>

        <div className={styles.searchArea}>{locationSearch}</div>
      </section>

      <div className={styles.pulseLine} aria-hidden="true"><span /></div>

      <section className={styles.preview} aria-labelledby="near-you-heading">
        {forecast && previewDay ? (
          <>
            <div className={styles.previewHead}>
              <div>
                <p className={styles.eyebrow}>Your latest coast</p>
                <h2 id="near-you-heading">{forecast.location_name}</h2>
                <p className={styles.meta}>{new Date(`${previewDay.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              </div>
              <button className={styles.openForecast} onClick={() => navigate('/forecast')}>
                Open forecast <IconArrowRight aria-hidden="true" />
              </button>
            </div>

            <div className={styles.verdictRow}>
              <div>
                <strong className={styles.visibility}>{formatVisibility(visibility(previewDay), forecast.units ?? units)}</strong>
                <span className={styles.visibilityLabel}>predicted visibility</span>
              </div>
              <div className={styles.assessment}>
                <strong>{previewDay.verdict}</strong>
                <span>{confidence}</span>
              </div>
            </div>

            <div className={styles.trend} aria-label="Seven day visibility outlook">
              <div className={styles.trendLabel}>Seven day outlook</div>
              <svg viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 38H100" className={styles.chartGuide} />
                <polyline points={chartPoints(forecast.days.slice(0, 7))} className={styles.chartAreaLine} />
              </svg>
            </div>

            <div className={styles.conditions}>
              <div><span>Swell</span><strong>{previewDay.swell_height.toFixed(1)} {forecast.units ?? units}</strong></div>
              <div><span>Wind</span><strong>{Math.round(previewDay.wind_speed)} kt {previewDay.wind_dir_label}</strong></div>
              <div><span>Water</span><strong>{previewDay.sea_temp == null ? '—' : `${previewDay.sea_temp.toFixed(0)}°C`}</strong></div>
              <div><span>Algae</span><strong>{previewDay.algae.risk}</strong></div>
            </div>
          </>
        ) : (
          <div className={styles.emptyPreview}>
            <div>
              <p className={styles.eyebrow}>Start with a coast</p>
              <h2 id="near-you-heading">Your forecast will appear here.</h2>
              <p>Search a beach, headland or set of coordinates to see visibility, confidence and the conditions behind it.</p>
            </div>
            <button className={styles.openForecast} onClick={() => navigate('/map')}>
              Explore the map <IconArrowRight aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      <nav className={styles.directory} aria-label="DepthViz tools">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>Planning tools</p>
            <h2>From conditions to preparation</h2>
          </div>
        </div>
        <div className={styles.toolGrid}>
          {TOOLS.map(({ label, description, path }) => (
            <button key={path} className={styles.tool} onClick={() => navigate(path)}>
              <strong>{label}</strong>
              <span>{description}</span>
              <IconArrowRight aria-hidden="true" />
            </button>
          ))}
        </div>
      </nav>

      <section className={styles.section} aria-labelledby="news-heading">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>Latest updates</p>
            <h2 id="news-heading">From DepthViz</h2>
          </div>
          <button className={styles.quietLink} onClick={() => navigate('/news')}>
            View all <IconArrowRight aria-hidden="true" />
          </button>
        </div>
        {loadingNews ? (
          <p className={styles.muted}>Loading updates…</p>
        ) : news.length === 0 ? (
          <p className={styles.muted}>No announcements yet — check back soon.</p>
        ) : (
          <ul className={styles.newsList}>
            {news.map(item => (
              <li key={item.id}>
                <button className={styles.newsItem} onClick={() => navigate('/news')}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.summary || `${item.body.slice(0, 160)}${item.body.length > 160 ? '…' : ''}`}</p>
                  </div>
                  <time dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
