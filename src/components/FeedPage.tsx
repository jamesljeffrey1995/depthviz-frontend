import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { getFeedPage } from '../lib/feedApi'
import type { FeedItem } from '../types'
import { Button, FilterChip, PageLayout, SegmentedControl } from './ui'
import styles from './FeedPage.module.css'

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

function comparisonCopy(actual: number, predicted: number): string {
  const delta = actual - predicted
  if (Math.abs(delta) < 0.05) return 'Forecast matched the report'
  return `Water was ${Math.abs(delta).toFixed(1)}m ${delta > 0 ? 'clearer' : 'murkier'} than forecast`
}

const LIMIT = 30
const SCOPE_OPTIONS = [
  { value: 'all' as const, label: 'All activity' },
  { value: 'friends' as const, label: 'Friends only' },
]
const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'reports', label: 'Reports' },
  { value: 'catches', label: 'Catches' },
]

export function FeedPage({ user }: Props) {
  const [scope, setScope] = useState<Scope>('all')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [items, setItems] = useState<FeedItem[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cursorRef = useRef<string | null>(null)
  const requestSeq = useRef(0)

  const fetchFeed = useCallback(async (reset: boolean) => {
    const requestId = ++requestSeq.current
    setLoading(true)
    setError('')
    const cursor = reset ? null : cursorRef.current
    try {
      const data = await getFeedPage({
        scope,
        filter_type: filterType,
        limit: LIMIT,
        cursor,
      })
      if (requestId !== requestSeq.current) return
      setItems(prev => (reset ? data.items : [...prev, ...data.items]))
      setTotal(data.total)
      cursorRef.current = data.next_cursor
      setHasMore(Boolean(data.next_cursor))
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

  function resetForReload() {
    requestSeq.current++
    cursorRef.current = null
    setItems([])
    setTotal(0)
    setHasMore(false)
  }

  function handleScopeChange(newScope: Scope) {
    if (newScope === 'friends' && !user) return
    if (newScope === scope) return
    resetForReload()
    setScope(newScope)
  }

  function handleFilterChange(newFilter: FilterType) {
    if (newFilter === filterType) return
    resetForReload()
    setFilterType(newFilter)
  }

  const newestItem = items.reduce<FeedItem | null>((latest, item) => (
    !latest || new Date(item.created_at).getTime() > new Date(latest.created_at).getTime() ? item : latest
  ), null)
  const subtitle = newestItem
    ? `Latest diver observations · newest report ${timeAgo(newestItem.created_at)}. Check age before planning.`
    : 'Diver observations and catches from the coast, with report age shown clearly.'

  return (
    <PageLayout
      title="Community"
      subtitle={subtitle}
    >
      <section className={styles.controlsCard} aria-label="Community filters">
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <span className={styles.groupLabel}>View</span>
            <SegmentedControl
              ariaLabel="Community feed scope"
              size="sm"
              value={scope}
              onChange={handleScopeChange}
              options={SCOPE_OPTIONS}
            />
            {!user && <p className={styles.groupHint}>Sign in to unlock the friends-only feed.</p>}
          </div>
          <div className={styles.controlGroup}>
            <span className={styles.groupLabel}>Type</span>
            <div className={styles.filterRow} role="group" aria-label="Community item type">
              {FILTER_OPTIONS.map(option => (
                <FilterChip
                  key={option.value}
                  active={filterType === option.value}
                  onClick={() => handleFilterChange(option.value)}
                >
                  {option.label}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <div className={styles.errorCard}>{error}</div>}

      {loading && items.length === 0 ? (
        <div className={styles.stateCard}>Loading coastal reports…</div>
      ) : items.length === 0 && !error ? (
        <div className={styles.stateCard}>
          <p className={styles.emptyTitle}>No activity yet.</p>
          <p className={styles.emptyText}>Be the first to submit a report or log a catch.</p>
        </div>
      ) : (
        <div className={styles.feedList}>
          {items.map(item => (
            <article key={`${item.type}-${item.id}`} className={styles.feedCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIdentity}>
                  <div className={styles.identityRow}>
                    <span className={styles.locationRow}>{item.location_name}</span>
                    <span className={styles.itemType}>{item.type === 'report' ? 'Dive report' : 'Catch log'}</span>
                  </div>
                  <div className={styles.userName}>Reported by {item.user_name}</div>
                </div>
                <span className={styles.timeAgo}>{timeAgo(item.created_at)}</span>
              </div>

              {item.type === 'report' && (
                <div className={styles.cardBody}>
                  <div className={styles.observations}>
                    <span className={styles.primaryObservation}><strong>{item.actual_vis}m</strong> visibility</span>
                    {item.predicted_vis != null && item.actual_vis != null && (
                      <span className={styles.forecastComparison}>
                        <span>Forecast {item.predicted_vis.toFixed(1)}m</span>
                        <strong>{comparisonCopy(item.actual_vis, item.predicted_vis)}</strong>
                      </span>
                    )}
                    {item.has_video && <span>Video attached</span>}
                  </div>
                  {item.notes && <p className={styles.notes}>{item.notes}</p>}
                </div>
              )}

              {item.type === 'catch' && (
                <div className={styles.cardBody}>
                  <p className={styles.cardSummary}>Caught <strong>{item.species}</strong></p>
                  <div className={styles.observations}>
                    {item.weight_kg != null && <span><strong>{item.weight_kg} kg</strong></span>}
                    {item.quantity != null && <span>Quantity {item.quantity}</span>}
                    {item.method && <span>{item.method}</span>}
                  </div>
                  {item.notes && <p className={styles.notes}>{item.notes}</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {hasMore && (
        <Button variant="secondary" block onClick={() => fetchFeed(false)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      )}

      {!hasMore && items.length > 0 && items.length < total && (
        <div className={styles.stateCard}>No more activity is available in this feed window.</div>
      )}
    </PageLayout>
  )
}
