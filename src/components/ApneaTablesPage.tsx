import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { getApneaTables } from '../lib/api'
import type { ApneaDifficulty, ApneaTable, ApneaTableType } from '../types'
import styles from './ApneaTablesPage.module.css'

type Tab = 'library' | 'mine'

interface Props {
  user: User | null
  onShowAuth: () => void
}

function formatHold(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function totalSeconds(table: ApneaTable): number {
  return table.cycles.reduce((acc, c) => acc + c.hold_seconds + c.rest_seconds, 0)
}

function longestHoldLabel(table: ApneaTable): string {
  // Math.max() of an empty array returns -Infinity, which formatHold would
  // render as nonsense. Schema validation prohibits empty cycles, but the UI
  // shouldn't blow up if a stale or malformed row sneaks through.
  if (table.cycles.length === 0) return '—'
  return formatHold(Math.max(...table.cycles.map(c => c.hold_seconds)))
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  return `${m} min`
}

function difficultyBadge(d: ApneaDifficulty) {
  if (d === 'beginner') return styles.badgeBeginner
  if (d === 'intermediate') return styles.badgeIntermediate
  return styles.badgeExpert
}

export function ApneaTablesPage({ user, onShowAuth }: Props) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('library')
  const [difficulty, setDifficulty] = useState<ApneaDifficulty | null>(null)
  // CO₂/O₂ filter — applied client-side over the already-loaded rows.
  const [tableType, setTableType] = useState<ApneaTableType | null>(null)
  const [tables, setTables] = useState<ApneaTable[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const scope = tab === 'mine' ? 'mine' : 'public'
    getApneaTables({ scope, difficulty: difficulty ?? undefined })
      .then(rows => { if (!cancelled) setTables(rows) })
      .catch(e => {
        if (cancelled) return
        if (e?.status === 401) setError('Sign in to view your tables')
        else setError(e instanceof Error ? e.message : 'Failed to load tables')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tab, difficulty])

  const handleTabChange = (next: Tab) => {
    if (next === 'mine' && !user) {
      onShowAuth()
      return
    }
    setTab(next)
  }

  const grouped = useMemo(() => {
    const visible = tableType ? tables.filter(t => t.table_type === tableType) : tables
    // Library tab: group system first then user-public; Mine tab: flat.
    if (tab === 'mine') return [{ heading: '', items: visible }]
    const system = visible.filter(t => t.is_system)
    const community = visible.filter(t => !t.is_system && t.is_public)
    const out: { heading: string; items: ApneaTable[] }[] = []
    if (system.length) out.push({ heading: 'System tables', items: system })
    if (community.length) out.push({ heading: 'Community tables', items: community })
    if (!out.length) out.push({ heading: '', items: [] })
    return out
  }, [tab, tables, tableType])

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Apnea Training Tables</h1>
      <div className={styles.subtitle}>Build · save · share breath-hold sessions</div>

      <div className={styles.warning} role="note">
        <strong>Safety first</strong>
        <ul className={styles.warningList}>
          <li>Never train breath-hold in or near water alone — dry static training only without direct, qualified supervision.</li>
          <li>Stop immediately if you feel light-headed, confused, or unwell, see spots, or contractions become intense.</li>
          <li>You are responsible for your own safety.</li>
        </ul>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'library' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('library')}
        >Library</button>
        <button
          className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('mine')}
          aria-label={user ? 'My tables' : 'My tables (sign in required)'}
        >My Tables{!user && ' 🔒'}</button>
      </div>

      <div className={styles.filters} role="group" aria-label="Filter by level">
        <button
          className={`${styles.chip} ${difficulty === null ? styles.chipActive : ''}`}
          aria-pressed={difficulty === null}
          onClick={() => setDifficulty(null)}
        >All levels</button>
        {(['beginner', 'intermediate', 'expert'] as const).map(d => (
          <button
            key={d}
            className={`${styles.chip} ${difficulty === d ? styles.chipActive : ''}`}
            aria-pressed={difficulty === d}
            onClick={() => setDifficulty(d)}
          >{d}</button>
        ))}
      </div>

      <div className={styles.filters} role="group" aria-label="Filter by table type">
        <button
          className={`${styles.chip} ${tableType === null ? styles.chipActive : ''}`}
          aria-pressed={tableType === null}
          onClick={() => setTableType(null)}
        >All types</button>
        {([['co2', 'CO₂ tolerance'], ['o2', 'O₂ tables']] as const).map(([value, label]) => (
          <button
            key={value}
            className={`${styles.chip} ${tableType === value ? styles.chipActive : ''}`}
            aria-pressed={tableType === value}
            onClick={() => setTableType(value)}
          >{label}</button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <button
          className={styles.newBtn}
          onClick={() => user ? navigate('/training/new') : onShowAuth()}
        >+ New table</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Loading…</div>}

      {!loading && !error && grouped.every(g => g.items.length === 0) && (
        tab === 'mine' ? (
          <div className={styles.emptyBox}>
            <p className={styles.emptyTitle}>No tables of your own yet</p>
            <p className={styles.emptyText}>
              Build a table from scratch, or open one from the library and copy it
              as a starting point.
            </p>
            <div className={styles.emptyActions}>
              <button className={styles.newBtn} onClick={() => navigate('/training/new')}>
                + New table
              </button>
              <button className={styles.ghostBtn} onClick={() => setTab('library')}>
                Browse library
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>No tables match these filters.</div>
        )
      )}

      {!loading && grouped.map(group => (
        group.items.length > 0 && (
          <div key={group.heading || 'all'}>
            {group.heading && (
              <div className={styles.groupHeading}>{group.heading}</div>
            )}
            <div className={styles.list}>
              {group.items.map(t => (
                <div
                  key={t.id}
                  className={styles.card}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/training/${t.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/training/${t.id}`)
                    }
                  }}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.cardName}>{t.name}</div>
                    <div className={styles.badges}>
                      <span className={`${styles.badge} ${difficultyBadge(t.difficulty)}`}>
                        {t.difficulty}
                      </span>
                      <span className={`${styles.badge} ${styles.badgeType}`}>
                        {t.table_type.toUpperCase()}
                      </span>
                      {t.is_system ? (
                        <span className={`${styles.badge} ${styles.badgeSystem}`}>System</span>
                      ) : t.is_public ? (
                        <span className={`${styles.badge} ${styles.badgePublic}`}>Public</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgePrivate}`}>Private</span>
                      )}
                    </div>
                  </div>
                  {t.description && <div className={styles.cardDesc}>{t.description}</div>}
                  <div className={styles.cardMeta}>
                    <span><strong>{t.cycles.length}</strong> rounds</span>
                    <span>longest hold <strong>{longestHoldLabel(t)}</strong></span>
                    <span>total <strong>{formatDuration(totalSeconds(t))}</strong></span>
                    <span className={styles.cardGo} aria-hidden="true">View →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  )
}
