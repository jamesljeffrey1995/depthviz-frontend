import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNews, getBestVisibility } from '../lib/api'
import type { Announcement, BestVisSpot } from '../types'
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
  report: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4Z" />
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

interface ActionGroup {
  title: string
  hint: string
  actions: Action[]
}

/* Quick actions grouped by what the user is actually trying to do, so the home
   screen reads as a purpose-built dive tool rather than a random app grid. */
const ACTION_GROUPS: ActionGroup[] = [
  {
    title: 'Plan a dive',
    hint: 'Where and when the water will be clear',
    actions: [
      { label: 'Forecast', path: '/map', icon: 'forecast' },
      { label: 'Best vis today', path: '/best', icon: 'best' },
    ],
  },
  {
    title: 'Share local knowledge',
    hint: 'Real reports make the next forecast sharper',
    actions: [
      { label: 'Activity feed', path: '/feed', icon: 'feed' },
      { label: 'Catches', path: '/catches', icon: 'catches' },
      { label: 'Discussions', path: '/forum', icon: 'community' },
    ],
  },
  {
    title: 'Prepare',
    hint: 'Get your kit and breath-hold dialled in',
    actions: [
      { label: 'Weight belt', path: '/weight', icon: 'weight' },
      { label: 'Apnea training', path: '/training', icon: 'training' },
    ],
  },
  {
    title: 'Events',
    hint: 'Club comps and organised dives',
    actions: [
      { label: 'Competitions', path: '/competition', icon: 'competition' },
    ],
  },
]

/* The forecast drivers, in plain English — so a first-time visitor understands
   what actually goes into the number before they trust it. */
const HOW_IT_WORKS: { label: string; detail: string }[] = [
  { label: 'Swell & waves', detail: 'Big swell stirs the seabed and drops visibility fast.' },
  { label: 'Wind', detail: 'Onshore wind churns the surface and pushes murky water in.' },
  { label: 'Rain & runoff', detail: 'Heavy rain flushes sediment off the land into the shallows.' },
  { label: 'Tides', detail: 'Tidal flow moves clearer or dirtier water past your spot.' },
  { label: 'Ocean data', detail: 'Satellite and model data on plankton, sediment and clarity.' },
  { label: 'Diver reports', detail: 'Your on-the-day reports calibrate and correct the model.' },
]

const COLOR_CLASSES = new Set(['blocked', 'poor', 'marginal', 'decent', 'good', 'excellent'])
function safeColorClass(cls: string | undefined): string {
  return cls && COLOR_CLASSES.has(cls) ? cls : 'decent'
}

/** Small teaser of the top-ranked UK spots for today. Deep-links into the full
 *  Best Visibility page rather than trying to load a forecast from the home
 *  screen — one clear next step, no half-loaded state. */
function BestTodayCard() {
  const navigate = useNavigate()
  const [spots, setSpots] = useState<BestVisSpot[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    getBestVisibility()
      .then(res => { if (!cancelled) setSpots(res.spots.slice(0, 3)) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  // Fail quietly — the homepage should never lead with an error box. The full
  // Best Visibility page owns the loud error/retry state.
  if (failed) return null

  return (
    <section className={styles.section} aria-labelledby="best-heading">
      <div className={styles.sectionHead}>
        <h2 id="best-heading" className={styles.sectionTitle}>Best vis today</h2>
        <button className={styles.moreLink} onClick={() => navigate('/best')}>
          See all spots →
        </button>
      </div>
      <div className={styles.bestCard}>
        {spots === null ? (
          <ul className={styles.bestList} aria-hidden="true">
            {[0, 1, 2].map(i => (
              <li key={i} className={styles.bestSkeleton}>
                <span className={`${styles.bestSkelRank} dv-skeleton`} />
                <span className={`${styles.bestSkelName} dv-skeleton`} />
                <span className={`${styles.bestSkelVis} dv-skeleton`} />
              </li>
            ))}
          </ul>
        ) : spots.length === 0 ? (
          <p className={styles.muted}>No spots ranked for today yet — check back after the morning update.</p>
        ) : (
          <ul className={styles.bestList}>
            {spots.map((spot, i) => {
              const vis = spot.day.vis_corrected ?? spot.day.vis_estimate
              const cc = safeColorClass(spot.day.color_class)
              return (
                <li key={`${spot.lat}-${spot.lon}`}>
                  <button
                    className={`${styles.bestRow} dv-pressable`}
                    onClick={() => navigate('/best')}
                    aria-label={`${spot.name}: ${spot.day.verdict}, about ${vis.toFixed(1)} metres`}
                  >
                    <span className={styles.bestRank}>{i + 1}</span>
                    <span className={styles.bestInfo}>
                      <span className={styles.bestName}>{spot.name}</span>
                      <span className={`${styles.bestVerdict} ${styles[cc]}`}>{spot.day.verdict}</span>
                    </span>
                    <span className={styles.bestVisBlock}>
                      <span className={`${styles.bestVisValue} ${styles[cc]}`}>{vis.toFixed(1)}m</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

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
        <p className={styles.heroKicker}>UK spearfishing &amp; freediving · North East coast &amp; beyond</p>
        <h1 className={styles.heroTitle}>Know the vis before you drive to the coast.</h1>
        <p className={styles.heroTagline}>
          DepthViz turns swell, wind, rain, tide and ocean data — corrected by real diver
          reports — into a straight answer: is it worth getting in, and where?
        </p>
        <div className={styles.heroActions}>
          <button
            className={`${styles.primaryBtn} dv-pressable`}
            onClick={() => navigate('/map')}
          >
            <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {icons.forecast}
            </svg>
            Check forecast
          </button>
          <button
            className={`${styles.secondaryBtn} dv-pressable`}
            onClick={() => navigate('/report')}
          >
            <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {icons.report}
            </svg>
            Report visibility
          </button>
        </div>
        <p className={styles.heroTrust}>
          Forecasts are estimates — confidence varies with the conditions, and every report
          you add makes the next one sharper. Not a substitute for local knowledge.
        </p>
      </section>

      <BestTodayCard />

      <section className={styles.section} aria-labelledby="explore-heading">
        <h2 id="explore-heading" className={styles.sectionTitle}>Everything in DepthViz</h2>
        <div className={styles.groups}>
          {ACTION_GROUPS.map(group => (
            <div key={group.title} className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupTitle}>{group.title}</span>
                <span className={styles.groupHint}>{group.hint}</span>
              </div>
              <div className={styles.actionRow}>
                {group.actions.map(a => (
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
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="how-heading">
        <h2 id="how-heading" className={styles.sectionTitle}>How DepthViz works</h2>
        <p className={styles.sectionLead}>
          Underwater visibility is driven by a handful of things you can&apos;t see from the
          car park. DepthViz weighs them up for every UK spot, then corrects the result
          against what divers actually reported.
        </p>
        <div className={styles.howGrid}>
          {HOW_IT_WORKS.map(item => (
            <div key={item.label} className={styles.howItem}>
              <span className={styles.howLabel}>{item.label}</span>
              <span className={styles.howDetail}>{item.detail}</span>
            </div>
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
          <div className={styles.newsEmpty}>
            <svg className={styles.newsEmptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16v12H5.2L4 17.2Z" />
              <path d="M8 9h8M8 12h5" />
            </svg>
            <p className={styles.newsEmptyTitle}>No announcements yet</p>
            <p className={styles.newsEmptyText}>
              Product updates and dive-community notices will show up here. In the meantime,
              check today&apos;s forecast or add a report to help the next diver.
            </p>
            <button className={`${styles.newsEmptyBtn} dv-pressable`} onClick={() => navigate('/map')}>
              Check the forecast
            </button>
          </div>
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
