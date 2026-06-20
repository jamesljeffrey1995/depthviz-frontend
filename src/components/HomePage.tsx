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

interface Tile {
  label: string
  desc: string
  path: string
}

const TILES: Tile[] = [
  { label: 'Check Visibility', desc: 'AI-calibrated 7-day underwater visibility forecast for any coast.', path: '/map' },
  { label: 'Discussions', desc: 'Talk spots, gear, safety and catches with other divers.', path: '/forum' },
  { label: 'Weight Belt', desc: 'Work out your neutral-buoyancy weighting in seconds.', path: '/weight' },
  { label: 'Best Visibility', desc: 'Find where the water is clearest right now.', path: '/best' },
  { label: 'Apnea Training', desc: 'Run O₂ and CO₂ tables to build your breath-hold.', path: '/training' },
  { label: 'Activity Feed', desc: 'Latest dive reports and catches from the community.', path: '/feed' },
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
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Dive smarter.</h1>
        <p className={styles.heroLead}>
          DepthViz forecasts underwater visibility for spearfishers and freedivers,
          then sharpens it with reports from divers in the water. Check the vis,
          plan your session, and swap notes with the community.
        </p>
        <div className={styles.heroActions}>
          <button className={styles.primaryBtn} onClick={() => navigate('/map')}>
            Check visibility
          </button>
          <button className={styles.secondaryBtn} onClick={() => navigate('/forum')}>
            Join the discussion
          </button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="news-heading">
        <div className={styles.sectionHead}>
          <h2 id="news-heading" className={styles.sectionTitle}>Latest news</h2>
          <button className={styles.moreLink} onClick={() => navigate('/news')}>
            All news →
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
                    <span className={styles.newsTitle}>{n.title}</span>
                    <span className={styles.newsDate}>{timeAgo(n.created_at)}</span>
                  </div>
                  <p className={styles.newsExcerpt}>{n.body.slice(0, 160)}{n.body.length > 160 ? '…' : ''}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="explore-heading">
        <h2 id="explore-heading" className={styles.sectionTitle}>Explore</h2>
        <div className={styles.tileGrid}>
          {TILES.map(t => (
            <button key={t.path} className={styles.tile} onClick={() => navigate(t.path)}>
              <span className={styles.tileLabel}>{t.label}</span>
              <span className={styles.tileDesc}>{t.desc}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
