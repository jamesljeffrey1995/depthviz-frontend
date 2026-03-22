import { useState, useEffect, useCallback } from 'react'
import { getFeed } from '../lib/api'
import styles from './FeedPage.module.css'

interface FeedItem {
  type: 'report' | 'catch'
  id: number
  user_id: string
  user_name: string
  location_name: string
  location_id: number
  created_at: string
  actual_vis?: number
  predicted_vis?: number
  notes?: string
  has_video?: boolean
  species?: string
  weight_kg?: number
  quantity?: number
  method?: string
}

interface FeedResponse {
  items: FeedItem[]
  total: number
}

type Scope = 'all' | 'friends'
type FilterType = 'all' | 'reports' | 'catches'

interface Props {
  user: any
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

export function FeedPage({ user, onSelectSpot }: Props) {
  const [scope, setScope] = useState<Scope>('all')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [items, setItems] = useState<FeedItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchFeed = useCallback(async (reset: boolean) => {
    setLoading(true)
    setError('')
    const newOffset = reset ? 0 : offset
    try {
      const data: FeedResponse = await getFeed({
        scope,
        filter_type: filterType,
        limit: LIMIT,
        offset: newOffset,
      })
      if (reset) {
        setItems(data.items)
      } else {
        setItems(prev => [...prev, ...data.items])
      }
      setTotal(data.total)
      setOffset(newOffset + data.items.length)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load feed')
    } finally {
      setLoading(false)
    }
  }, [scope, filterType, offset])

  useEffect(() => {
    fetchFeed(true)
  }, [scope, filterType])

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
