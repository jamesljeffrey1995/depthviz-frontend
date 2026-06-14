import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { getFeed } from '../lib/api'
import type { FeedItem } from '../types'
import styles from './FeedPage.module.css'

interface FeedResponse {
  items: FeedItem[]
  total: number
}

type Scope = 'all' | 'friends'
type FilterType = 'all' | 'reports' | 'catches'

interface Props {
  user: User | null
  onSelectSpot?: (lat: number, lon: number, name: string) => void
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const LIMIT = 30

export function FeedPage({ user }: Props) {
  const [scope, setScope] = useState<Scope>('all')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [items, setItems] = useState<FeedItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // The current pagination offset lives in a ref, not state, so the fetch
  // closure always reads the latest value rather than a stale snapshot captured
  // when the effect last ran.
  const offsetRef = useRef(0)
  // Monotonic request id. Only the most-recent request may commit its results,
  // so a slow "Load More" can't append items from a previous scope/filter after
  // the user switches, and out-of-order responses can't double-count the offset
  // or cross-contaminate the list.
  const requestSeq = useRef(0)

  const fetchFeed = useCallback(async (reset: boolean) => {
    const requestId = ++requestSeq.current
    setLoading(true)
    setError('')
    const startOffset = reset ? 0 : offsetRef.current
    try {
      const data: FeedResponse = await getFeed({
        scope,
        filter_type: filterType,
        limit: LIMIT,
        offset: startOffset,
      })
      if (requestId !== requestSeq.current) return  // superseded — discard
      setItems(prev => (reset ? data.items : [...prev, ...data.items]))
      setTotal(data.total)
      offsetRef.current = startOffset + data.items.length
    } catch (err) {
      if (requestId !== requestSeq.current) return
      setError(err instanceof Error ? err.message : 'Failed to load feed')
    } finally {
      if (requestId === requestSeq.current) setLoading(false)
    }
  }, [scope, filterType])

  useEffect(() => {
    fetchFeed(true)
  }, [fetchFeed])

  function handleScopeChange(newScope: Scope) {
    if (newScope === 'friends' && !user) return
    setScope(newScope)
  }

  function handleFilterChange(newFilter: FilterType) {
    setFilterType(newFilter)
  }

  function handleLoadMore() {
    fetchFeed(false)
  }

  const hasMore = items.length < total

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.scopeGroup}>
          <button
            className={`${styles.scopeBtn} ${scope === 'all' ? styles.scopeActive : ''}`}
            onClick={() => handleScopeChange('all')}
          >
            All Activity
          </button>
          <button
            className={`${styles.scopeBtn} ${scope === 'friends' ? styles.scopeActive : ''}`}
            onClick={() => handleScopeChange('friends')}
            disabled={!user}
            title={!user ? 'Sign in to see friends' : undefined}
          >
            Friends Only
          </button>
        </div>

        <div className={styles.filterGroup}>
          {(['all', 'reports', 'catches'] as FilterType[]).map(f => (
            <button
              key={f}
              className={`${styles.filterChip} ${filterType === f ? styles.filterActive : ''}`}
              onClick={() => handleFilterChange(f)}
            >
              {f === 'all' ? 'All' : f === 'reports' ? 'Reports' : 'Catches'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.feedList}>
        {items.map(item => (
          <div key={`${item.type}-${item.id}`} className={styles.feedCard}>
            <div className={styles.cardHeader}>
              <span className={styles.userName}>{item.user_name}</span>
              <span className={styles.timeAgo}>{timeAgo(item.created_at)}</span>
            </div>

            {item.type === 'report' && (
              <div className={styles.cardBody}>
                <p className={styles.cardSummary}>
                  Logged visibility at <strong>{item.location_name}</strong>
                </p>
                <div className={styles.visRow}>
                  <span className={styles.visBadge}>
                    {item.actual_vis}m actual
                  </span>
                  {item.predicted_vis != null && (
                    <span className={styles.visBadgePredicted}>
                      {item.predicted_vis}m predicted
                    </span>
                  )}
                  {item.has_video && (
                    <span className={styles.videoBadge}>VIDEO</span>
                  )}
                </div>
                {item.notes && <p className={styles.notes}>{item.notes}</p>}
              </div>
            )}

            {item.type === 'catch' && (
              <div className={styles.cardBody}>
                <p className={styles.cardSummary}>
                  Caught <span className={styles.catchSpecies}>{item.species}</span>{' '}
                  at <strong>{item.location_name}</strong>
                </p>
                <div className={styles.catchDetails}>
                  {item.weight_kg != null && (
                    <span className={styles.catchDetail}>{item.weight_kg} kg</span>
                  )}
                  {item.quantity != null && (
                    <span className={styles.catchDetail}>x{item.quantity}</span>
                  )}
                  {item.method && (
                    <span className={styles.catchDetail}>{item.method}</span>
                  )}
                </div>
                {item.notes && <p className={styles.notes}>{item.notes}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && items.length === 0 && !error && (
        <div className={styles.empty}>
          <p>No activity yet.</p>
          <p>Be the first to submit a report or log a catch!</p>
        </div>
      )}

      {hasMore && (
        <button
          className={styles.loadMore}
          onClick={handleLoadMore}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}

      {loading && items.length === 0 && (
        <p className={styles.loadingText}>Loading feed...</p>
      )}
    </div>
  )
}
