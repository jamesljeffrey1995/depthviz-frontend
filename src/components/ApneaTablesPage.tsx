import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { getApneaTables } from '../lib/api'
import type { ApneaDifficulty, ApneaTable, ApneaTableType } from '../types'
import { Tabs } from './Tabs'
import { IconPlus } from './icons'
import { Button, Card, FilterChip, PageLayout } from './ui'
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
  if (table.cycles.length === 0) return '—'
  return formatHold(Math.max(...table.cycles.map(c => c.hold_seconds)))
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  return `${m} min`
}

function difficultyTone(difficulty: ApneaDifficulty) {
  if (difficulty === 'beginner') return 'success' as const
  if (difficulty === 'intermediate') return 'warn' as const
  return 'danger' as const
}

export function ApneaTablesPage({ user, onShowAuth }: Props) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('library')
  const [difficulty, setDifficulty] = useState<ApneaDifficulty | null>(null)
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
    <PageLayout
      title="Apnea Training Tables"
      subtitle="Safety-first breath-hold tables with a cleaner mobile library, clearer difficulty signals, and shared controls."
      actions={
        <Button
          variant="primary"
          size="sm"
          iconStart={<IconPlus width={14} height={14} />}
          onClick={() => user ? navigate('/training/new') : onShowAuth()}
        >
          New table
        </Button>
      }
    >
      <Card className={styles.warningCard} padding="lg" accent="var(--ds-warn)">
        <h2 className={styles.warningTitle}>Safety first</h2>
        <ul className={styles.warningList}>
          <li>Never train breath-hold in or near water alone — dry static training only without direct, qualified supervision.</li>
          <li>Stop immediately if you feel light-headed, confused, or unwell, see spots, or contractions become intense.</li>
          <li>You are responsible for your own safety.</li>
        </ul>
      </Card>

      <Tabs
        tabs={[
          { id: 'library', label: 'Library' },
          { id: 'mine', label: user ? 'My Tables' : 'My Tables — sign in' },
        ]}
        active={tab}
        onChange={next => handleTabChange(next as Tab)}
      />

      <div className={styles.filterSection}>
        <div className={styles.filterGroup} role="group" aria-label="Filter by level">
          <span className={styles.filterLabel}>Level</span>
          <div className={styles.filterRow}>
            <FilterChip active={difficulty === null} onClick={() => setDifficulty(null)}>All levels</FilterChip>
            {(['beginner', 'intermediate', 'expert'] as const).map(level => (
              <FilterChip
                key={level}
                active={difficulty === level}
                tone={difficultyTone(level)}
                onClick={() => setDifficulty(level)}
              >
                {level}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup} role="group" aria-label="Filter by table type">
          <span className={styles.filterLabel}>Type</span>
          <div className={styles.filterRow}>
            <FilterChip active={tableType === null} onClick={() => setTableType(null)}>All types</FilterChip>
            <FilterChip active={tableType === 'co2'} onClick={() => setTableType('co2')}>CO₂</FilterChip>
            <FilterChip active={tableType === 'o2'} onClick={() => setTableType('o2')}>O₂</FilterChip>
          </div>
        </div>
      </div>

      {error && <Card className={styles.errorCard} padding="md">{error}</Card>}
      {loading && <Card className={styles.stateCard} padding="lg">Loading tables…</Card>}

      {!loading && !error && grouped.every(g => g.items.length === 0) && (
        tab === 'mine' ? (
          <Card className={styles.stateCard} padding="lg">
            <p className={styles.emptyTitle}>No tables of your own yet</p>
            <p className={styles.emptyText}>Build a table from scratch, or copy one from the library as a starting point.</p>
            <div className={styles.emptyActions}>
              <Button variant="primary" onClick={() => navigate('/training/new')}>New table</Button>
              <Button variant="ghost" onClick={() => setTab('library')}>Browse library</Button>
            </div>
          </Card>
        ) : (
          <Card className={styles.stateCard} padding="lg">No tables match these filters.</Card>
        )
      )}

      {!loading && grouped.map(group => (
        group.items.length > 0 && (
          <section key={group.heading || 'all'} className={styles.groupSection}>
            {group.heading && <h2 className={styles.groupHeading}>{group.heading}</h2>}
            <div className={styles.list}>
              {group.items.map(table => (
                <Card
                  key={table.id}
                  className={styles.tableCard}
                  padding="lg"
                  interactive
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/training/${table.id}`)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/training/${table.id}`)
                    }
                  }}
                >
                  <div className={styles.cardHeader}>
                    <div>
                      <div className={styles.cardName}>{table.name}</div>
                      {table.description && <p className={styles.cardDesc}>{table.description}</p>}
                    </div>
                    <div className={styles.tableTags}>
                      <span className={styles.tableType}>{table.table_type === 'co2' ? 'CO₂ table' : 'O₂ table'}</span>
                      <span>{table.difficulty}</span>
                      <span>{table.is_system ? 'DepthViz' : table.is_public ? 'Community' : 'Private'}</span>
                    </div>
                  </div>
                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Rounds</span>
                      <strong>{table.cycles.length}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Longest hold</span>
                      <strong>{longestHoldLabel(table)}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Total time</span>
                      <strong>{formatDuration(totalSeconds(table))}</strong>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )
      ))}
    </PageLayout>
  )
}
