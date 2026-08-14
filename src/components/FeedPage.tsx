import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { getFeed } from '../lib/api'
import type { FeedItem } from '../types'
import { Badge, Button, Card, FilterChip, PageLayout, SegmentedControl } from './ui'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const offsetRef = useRef(0)
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
      if (requestId !== requestSeq.current) return
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

  function resetForReload() {
    requestSeq.current++
    offsetRef.current = 0
    setItems([])
    setTotal(0)
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

  const hasMore = items.length < total

  return (
    <PageLayout
      title="Community"
      subtitle="Recent diver reports and catches from the DepthViz community, with filters that stay thumb-friendly on mobile."
    >
      <Card className={styles.controlsCard} padding="md">
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
      </Card>

      {error && <Card className={styles.errorCard} padding="md">{error}</Card>}

      {loading && items.length === 0 ? (
        <Card className={styles.stateCard} padding="lg">Loading community activity…</Card>
      ) : items.length === 0 && !error ? (
        <Card className={styles.stateCard} padding="lg">
          <p className={styles.emptyTitle}>No activity yet.</p>
          <p className={styles.emptyText}>Be the first to submit a report or log a catch.</p>
        </Card>
      ) : (
        <div className={styles.feedList}>
          {items.map(item => (
            <Card key={`${item.type}-${item.id}`} className={styles.feedCard} padding="lg">
              <div className={styles.cardHeader}>
                <div className={styles.cardIdentity}>
                  <div className={styles.identityRow}>
                    <span className={styles.userName}>{item.user_name}</span>
                    <Badge tone={item.type === 'report' ? 'accent' : 'success'}>
                      {item.type === 'report' ? 'Dive report' : 'Catch'}
                    </Badge>
                  </div>
                  <div className={styles.locationRow}>{item.location_name}</div>
                </div>
                <span className={styles.timeAgo}>{timeAgo(item.created_at)}</span>
              </div>

              {item.type === 'report' && (
                <div className={styles.cardBody}>
                  <p className={styles.cardSummary}>Visibility logged at <strong>{item.location_name}</strong></p>
                  <div className={styles.badgeRow}>
                    <Badge tone="success">{item.actual_vis}m actual</Badge>
                    {item.predicted_vis != null && <Badge tone="accent">{item.predicted_vis}m predicted</Badge>}
                    {item.has_video && <Badge tone="warn">Video</Badge>}
                  </div>
                  {item.notes && <p className={styles.notes}>{item.notes}</p>}
                </div>
              )}

              {item.type === 'catch' && (
                <div className={styles.cardBody}>
                  <p className={styles.cardSummary}>Caught <strong>{item.species}</strong> at <strong>{item.location_name}</strong></p>
                  <div className={styles.badgeRow}>
                    {item.weight_kg != null && <Badge tone="neutral">{item.weight_kg} kg</Badge>}
                    {item.quantity != null && <Badge tone="neutral">x{item.quantity}</Badge>}
                    {item.method && <Badge tone="accent">{item.method}</Badge>}
                  </div>
                  {item.notes && <p className={styles.notes}>{item.notes}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {hasMore && (
        <Button variant="secondary" block onClick={() => fetchFeed(false)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </PageLayout>
  )
}
