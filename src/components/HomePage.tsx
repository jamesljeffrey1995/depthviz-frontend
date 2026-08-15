import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNews } from '../lib/api'
import type { Announcement } from '../types'
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
  { ref: '01', label: 'Compare visibility', description: 'Rank nearby sites by forecast visibility and confidence.', path: '/best' },
  { ref: '02', label: 'Read diver reports', description: 'Check what people actually found in the water.', path: '/feed' },
  { ref: '03', label: 'Open the spot map', description: 'Browse the coast and inspect a specific entry point.', path: '/map' },
  { ref: '04', label: 'Run an apnea table', description: 'Build and time dry training sessions.', path: '/training' },
  { ref: '05', label: 'Calculate weighting', description: 'Estimate lead for your suit, body and water type.', path: '/weight' },
]

interface HomePageProps {
  locationSearch: ReactNode
}

export function HomePage({ locationSearch }: HomePageProps) {
  const navigate = useNavigate()
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

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div>
          <h1 className={styles.heroTitle}>Where are you diving?</h1>
          <p className={styles.heroLead}>
            Check underwater visibility, sea state and recent diver reports before you load the car.
          </p>
        </div>

        <div className={styles.searchPanel}>
          <div className={styles.searchHead}>
            <div>
              <span className={styles.searchLabel}>Find a dive spot</span>
              <p>Town, beach, headland or coordinates</p>
            </div>
            <button className={styles.textLink} onClick={() => navigate('/map')}>
              Use map <span aria-hidden="true">→</span>
            </button>
          </div>
          {locationSearch}
        </div>
        <p className={styles.caution}>
          Forecasts support a decision; they do not make one. Check access, swell,
          wind and local advice before entering the water.
        </p>
      </section>

      <nav className={styles.directory} aria-label="DepthViz tools">
        <div className={styles.directoryHead}>
          <div>
            <span className={styles.sectionIndex}>Tools</span>
            <h2>More dive tools</h2>
          </div>
          <span>{TOOLS.length} to choose from</span>
        </div>
        {TOOLS.map(({ ref, label, description, path }) => (
          <button key={path} className={styles.tool} onClick={() => navigate(path)}>
            <span className={styles.ref}>{ref}</span>
            <strong>{label}</strong>
            <span className={styles.description}>{description}</span>
            <span className={styles.arrow} aria-hidden="true">→</span>
          </button>
        ))}
      </nav>

      <section className={styles.section} aria-labelledby="news-heading">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.sectionIndex}>Updates</p>
            <h2 id="news-heading" className={styles.sectionTitle}>From DepthViz</h2>
          </div>
          <button className={styles.textLink} onClick={() => navigate('/news')}>
            View the full log <IconArrowRight aria-hidden="true" />
          </button>
        </div>
        {loadingNews ? (
          <p className={styles.muted}>Loading…</p>
        ) : news.length === 0 ? (
          <p className={styles.muted}>No announcements yet — check back soon.</p>
        ) : (
          <ul className={styles.newsList}>
            {news.map(n => (
              <li key={n.id}>
                <button className={styles.newsItem} onClick={() => navigate('/news')}>
                  <div className={styles.newsItemHead}>
                    {n.is_pinned && <span className={styles.tag}>Pinned</span>}
                    {n.category && <span className={styles.tag}>{n.category}</span>}
                    <span className={styles.newsTitle}>{n.title}</span>
                    <span className={styles.newsDate}>{timeAgo(n.created_at)}</span>
                  </div>
                  <p className={styles.newsExcerpt}>
                    {n.summary || `${n.body.slice(0, 160)}${n.body.length > 160 ? '…' : ''}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
