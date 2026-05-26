import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { getApneaTables } from '../lib/api'
import type { ApneaDifficulty, ApneaTable } from '../types'
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
    // Library tab: group system first then user-public; Mine tab: flat.
    if (tab === 'mine') return [{ heading: '', items: tables }]
    const system = tables.filter(t => t.is_system)
    const community = tables.filter(t => !t.is_system && t.is_public)
    const out: { heading: string; items: ApneaTable[] }[] = []
    if (system.length) out.push({ heading: 'System tables', items: system })
    if (community.length) out.push({ heading: 'Community tables', items: community })
    if (!out.length) out.push({ heading: '', items: [] })
    return out
  }, [tab, tables])

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>Apnea Training Tables</div>
      <div className={styles.subtitle}>Build · save · share breath-hold sessions</div>

      <div className={styles.warning}>
        <strong>Safety first</strong>
        Apnea training is dangerous. Never hold your breath in or near water without
        direct, qualified supervision. Dry static training only. Stop immediately if
        you feel light-headed, see spots, or notice involuntary contractions becoming
        intense. You are responsible for your own safety.
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

      <div className={styles.filters}>
        <button
          className={`${styles.chip} ${difficulty === null ? styles.chipActive : ''}`}
          onClick={() => setDifficulty(null)}
        >All levels</button>
        {(['beginner', 'intermediate', 'expert'] as const).map(d => (
          <button
            key={d}
            className={`${styles.chip} ${difficulty === d ? styles.chipActive : ''}`}
            onClick={() => setDifficulty(d)}
          >{d}</button>
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
        <div className={styles.empty}>
          {tab === 'mine' ? 'No tables yet — create one or copy from the library.' : 'No tables match these filters.'}
        </div>
      )}

      {!loading && grouped.map(group => (
        group.items.length > 0 && (
          <div key={group.heading || 'all'}>
            {group.heading && (
              <div style={{
                fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
                opacity: 0.4, margin: '20px 0 10px',
              }}>{group.heading}</div>
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
                    <span>longest hold <strong>{formatHold(Math.max(...t.cycles.map(c => c.hold_seconds)))}</strong></span>
                    <span>total <strong>{formatDuration(totalSeconds(t))}</strong></span>
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
