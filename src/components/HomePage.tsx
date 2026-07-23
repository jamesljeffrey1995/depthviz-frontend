import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNews } from '../lib/api'
import type { Announcement } from '../types'
import {
  IconArrowRight, IconActivity, IconFish, IconTimer, IconScale, IconCompass,
} from './icons'
import styles from './HomePage.module.css'

/** Compact relative date, e.g. "3 days ago". */
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

interface QuickLink {
  label: string
  description: string
  path: string
  icon: typeof IconActivity
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Best visibility', description: 'Compare nearby spots', path: '/best', icon: IconCompass },
  { label: 'Apnea training', description: 'Build and run tables', path: '/training', icon: IconTimer },
  { label: 'Community', description: 'See recent dive reports', path: '/feed', icon: IconActivity },
  { label: 'Catches', description: 'Log what you found', path: '/catches', icon: IconFish },
  { label: 'Weight belt', description: 'Estimate your weighting', path: '/weight', icon: IconScale },
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
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Underwater visibility, decoded</span>
          <h1 className={styles.heroTitle}>Pick the right window to dive.</h1>
          <p className={styles.heroLead}>
            Check calibrated visibility, swell and tide conditions for your spot —
            sharpened by reports from divers already in the water.
          </p>
          <ul className={styles.proofPoints} aria-label="DepthViz forecast features">
            <li>7-day outlook</li>
            <li>Local dive reports</li>
            <li>Depth-aware conditions</li>
          </ul>
        </div>

        <div className={styles.searchCard}>
          <div className={styles.searchCardHead}>
            <div>
              <span className={styles.searchLabel}>Plan a dive</span>
              <p>Search a coastal spot or use your current location.</p>
            </div>
            <button className={styles.mapLink} onClick={() => navigate('/map')}>
              Open map
              <IconArrowRight aria-hidden="true" />
            </button>
          </div>
          {locationSearch}
        </div>
      </section>

      <nav className={styles.quickLinks} aria-label="Quick links">
        {QUICK_LINKS.map(({ label, description, path, icon: Icon }) => (
          <button key={path} className={styles.quickLink} onClick={() => navigate(path)}>
            <Icon className={styles.quickLinkIcon} aria-hidden="true" />
            <span className={styles.quickLinkCopy}>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <IconArrowRight className={styles.quickLinkArrow} aria-hidden="true" />
          </button>
        ))}
      </nav>

      <section className={styles.section} aria-labelledby="news-heading">
        <div className={styles.sectionHead}>
          <h2 id="news-heading" className={styles.sectionTitle}>Latest news</h2>
          <button className={styles.moreLink} onClick={() => navigate('/news')}>
            All news
            <IconArrowRight aria-hidden="true" />
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
                    {n.is_pinned && <span className={styles.pin}>Pinned</span>}
                    {n.category && <span className={styles.newsBadge}>{n.category}</span>}
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
