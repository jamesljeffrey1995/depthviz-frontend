import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNews } from '../lib/api'
import type { Announcement } from '../types'
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

/* ── Inline icons ──
   Small, stroked line icons in the expedition style. Kept inline so each
   quick-action ships without a network request and inherits currentColor. */
const icons = {
  forecast: (
    <>
      <path d="M2 6c1.5-1.5 3-1.5 4.5 0S9.5 7.5 11 6s3-1.5 4.5 0S18.5 7.5 20 6" />
      <path d="M2 12c1.5-1.5 3-1.5 4.5 0S9.5 13.5 11 12s3-1.5 4.5 0S18.5 13.5 20 12" />
      <path d="M2 18c1.5-1.5 3-1.5 4.5 0S9.5 19.5 11 18s3-1.5 4.5 0S18.5 19.5 20 18" />
    </>
  ),
  best: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    </>
  ),
  feed: (
    <>
      <path d="M4 11a9 9 0 019 9" />
      <path d="M4 4a16 16 0 0116 16" />
      <circle cx="5" cy="19" r="1" />
    </>
  ),
  catches: (
    <>
      <path d="M20 12c0 4.418-3.582 8-8 8s-8-3.582-8-8c0-2 1-4 2-5l6 3 6-3c1 1 2 3 2 5z" />
      <path d="M12 3v12" />
    </>
  ),
  weight: (
    <>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </>
  ),
  training: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </>
  ),
  competition: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
      <path d="M6 4h12v4a6 6 0 01-12 0Z" />
      <path d="M9 20h6M12 14v6" />
    </>
  ),
  community: (
    <>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5Z" />
    </>
  ),
}

interface Action {
  label: string
  path: string
  icon: keyof typeof icons
}

/* Two-column quick-actions grid — the app's whole surface reachable in one tap. */
const ACTIONS: Action[] = [
  { label: 'Forecast', path: '/map', icon: 'forecast' },
  { label: 'Best visibility', path: '/best', icon: 'best' },
  { label: 'Activity feed', path: '/feed', icon: 'feed' },
  { label: 'Catches', path: '/catches', icon: 'catches' },
  { label: 'Weight belt', path: '/weight', icon: 'weight' },
  { label: 'Apnea training', path: '/training', icon: 'training' },
  { label: 'Competitions', path: '/competition', icon: 'competition' },
  { label: 'Community', path: '/forum', icon: 'community' },
]

export function HomePage() {
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
      <section className={`${styles.hero} dv-animate-in`}>
        <h1 className={styles.heroTitle}>Dive smarter.</h1>
        <p className={styles.heroTagline}>
          AI-calibrated underwater visibility forecasts for UK spearfishers and freedivers.
        </p>
        <button
          className={`${styles.primaryBtn} dv-pressable`}
          onClick={() => navigate('/map')}
        >
          <svg className={styles.primaryBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icons.forecast}
          </svg>
          Check forecast
        </button>
      </section>

      <section className={styles.section} aria-labelledby="explore-heading">
        <h2 id="explore-heading" className={styles.sectionTitle}>Quick actions</h2>
        <div className={styles.actionGrid}>
          {ACTIONS.map(a => (
            <button
              key={a.path}
              className={`${styles.action} dv-pressable`}
              onClick={() => navigate(a.path)}
            >
              <span className={styles.actionIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {icons[a.icon]}
                </svg>
              </span>
              <span className={styles.actionLabel}>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="news-heading">
        <div className={styles.sectionHead}>
          <h2 id="news-heading" className={styles.sectionTitle}>Latest news</h2>
          <button className={styles.moreLink} onClick={() => navigate('/news')}>
            View all →
          </button>
        </div>
        {loadingNews ? (
          <ul className={styles.newsList} aria-hidden="true">
            {[0, 1, 2].map(i => (
              <li key={i} className={styles.newsSkeleton}>
                <span className={`${styles.skelTitle} dv-skeleton`} />
                <span className={`${styles.skelLine} dv-skeleton`} />
              </li>
            ))}
          </ul>
        ) : news.length === 0 ? (
          <p className={styles.muted}>No announcements yet — check back soon.</p>
        ) : (
          <ul className={styles.newsList}>
            {news.map(n => (
              <li key={n.id}>
                <button className={`${styles.newsItem} dv-pressable`} onClick={() => navigate('/news')}>
                  <div className={styles.newsBody}>
                    <div className={styles.newsMeta}>
                      {n.is_pinned && <span className={styles.pin}>Pinned</span>}
                      {n.category && <span className={styles.newsBadge}>{n.category}</span>}
                      <span className={styles.newsDate}>{timeAgo(n.created_at)}</span>
                    </div>
                    <span className={styles.newsTitle}>{n.title}</span>
                  </div>
                  <span className={styles.newsChevron} aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
