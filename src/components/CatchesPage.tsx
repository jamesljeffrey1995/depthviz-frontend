import { useState, useEffect, useMemo, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { getCatches, getMyCatches, logCatch, deleteCatch, getCatchSpecies } from '../lib/api'
import type { CatchRead, Location } from '../types'
import styles from './CatchesPage.module.css'

interface CatchesPageProps {
  user: User | null
  locations: Location[]
  onShowAuth: () => void
}

interface CatchRecord extends CatchRead {
  user_name?: string
  location_name?: string
}

interface SpeciesCount {
  species: string
  count: number
}

type Tab = 'mine' | 'community' | 'log'

function buildDateOptions(): { value: string; label: string }[] {
  const options = []
  const today = new Date()
  for (let i = 0; i <= 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const value = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' :
      d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
    options.push({ value, label })
  }
  return options
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function CatchesPage({ user, locations, onShowAuth }: CatchesPageProps) {
  const [tab, setTab] = useState<Tab>('community')
  const [myCatches, setMyCatches] = useState<CatchRecord[]>([])
  const [allCatches, setAllCatches] = useState<CatchRecord[]>([])
  const [speciesList, setSpeciesList] = useState<SpeciesCount[]>([])
  const [speciesFilter, setSpeciesFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // The post-submit success timer must be cleared if the component unmounts
  // first, otherwise it calls setState/setTab on a dead component.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
  }, [])

  // Form state
  const [formLocationId, setFormLocationId] = useState<number | ''>('')
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0])
  const [formSpecies, setFormSpecies] = useState('')
  const [formWeight, setFormWeight] = useState('')
  const [formLength, setFormLength] = useState('')
  const [formQuantity, setFormQuantity] = useState('1')
  const [formMethod, setFormMethod] = useState('')
  const [formDepth, setFormDepth] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const dateOptions = useMemo(() => buildDateOptions(), [])

  // Fetch my catches
  useEffect(() => {
    if (tab !== 'mine' || !user) return
    setLoading(true)
    getMyCatches()
      .then(setMyCatches)
      .catch(() => setMyCatches([]))
      .finally(() => setLoading(false))
  }, [tab, user])

  // Fetch community catches
  useEffect(() => {
    if (tab !== 'community') return
    setLoading(true)
    const params: Record<string, string> = {}
    if (speciesFilter) params.species = speciesFilter
    getCatches(params)
      .then(setAllCatches)
      .catch(() => setAllCatches([]))
      .finally(() => setLoading(false))
  }, [tab, speciesFilter])

  // Fetch species list for filter
  useEffect(() => {
    getCatchSpecies()
      .then(setSpeciesList)
      .catch(() => setSpeciesList([]))
  }, [])

  const locationMap = useMemo(() => {
    const map: Record<number, string> = {}
    locations.forEach(l => { map[l.id] = l.name })
    return map
  }, [locations])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this catch?')) return
    try {
      await deleteCatch(id)
      setMyCatches(prev => prev.filter(c => c.id !== id))
    } catch {
      setError('Failed to delete catch')
    }
  }

  const resetForm = () => {
    setFormLocationId('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormSpecies('')
    setFormWeight('')
    setFormLength('')
    setFormQuantity('1')
    setFormMethod('')
    setFormDepth('')
    setFormNotes('')
    setError('')
  }

  const handleSubmit = async () => {
    if (!formLocationId || !formSpecies.trim()) {
      setError('Location and species are required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await logCatch({
        location_id: Number(formLocationId),
        catch_date: formDate,
        species: formSpecies.trim(),
        weight_kg: formWeight ? parseFloat(formWeight) : undefined,
        length_cm: formLength ? parseFloat(formLength) : undefined,
        quantity: parseInt(formQuantity) || 1,
        method: formMethod || undefined,
        depth_m: formDepth ? parseFloat(formDepth) : undefined,
        notes: formNotes.trim().slice(0, 500) || undefined,
      })
      resetForm()
      setSuccessMsg('Catch logged successfully!')
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => {
        setSuccessMsg('')
        setTab('mine')
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log catch')
    } finally {
      setSubmitting(false)
    }
  }

  const renderAuthPrompt = (message: string) => (
    <div className={styles.authPrompt}>
      <p>{message}</p>
      <button className={styles.authBtn} onClick={onShowAuth}>Sign in</button>
    </div>
  )

  const renderCatchCard = (c: CatchRecord, showUser: boolean, showDelete: boolean) => (
    <div key={c.id} className={styles.catchCard}>
      <div className={styles.catchInfo}>
        <div className={styles.catchSpecies}>{c.species}</div>
        <div className={styles.catchMeta}>
          {formatDate(c.catch_date)}
          {' \u2022 '}
          {c.location_name ?? locationMap[c.location_id] ?? `Location #${c.location_id}`}
          {showUser && c.user_name && (
            <> {' \u2022 '} <span className={styles.catchUser}>{c.user_name}</span></>
          )}
        </div>
        <div className={styles.catchDetail}>
          {c.weight_kg != null && <span>{c.weight_kg} kg</span>}
          {c.length_cm != null && <span>{c.length_cm} cm</span>}
          {c.quantity != null && c.quantity > 1 && <span>x{c.quantity}</span>}
          {c.method && <span>{c.method}</span>}
          {c.depth_m != null && <span>{c.depth_m}m deep</span>}
        </div>
        {c.notes && (
          <div className={styles.statGrid}>
            <span>{c.notes}</span>
          </div>
        )}
      </div>
      {showDelete && (
        <button className={styles.btnDanger} onClick={() => handleDelete(c.id)}>Delete</button>
      )}
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.title}>Catches</div>
      <div className={styles.subtitle}>Log and browse fishing catches</div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`} onClick={() => setTab('mine')}>
          My Catches
        </button>
        <button className={`${styles.tab} ${tab === 'community' ? styles.tabActive : ''}`} onClick={() => setTab('community')}>
          Community
        </button>
        <button className={`${styles.tab} ${tab === 'log' ? styles.tabActive : ''}`} onClick={() => setTab('log')}>
          Log Catch
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* My Catches tab */}
      {tab === 'mine' && (
        !user ? renderAuthPrompt('Sign in to view your catches') : (
          <div className={styles.catchList}>
            {loading && <div className={styles.loading}>Loading...</div>}
            {!loading && myCatches.length === 0 && (
              <div className={styles.empty}>No catches yet — log your first catch!</div>
            )}
            {myCatches.map(c => renderCatchCard(c, false, true))}
          </div>
        )
      )}

      {/* Community tab */}
      {tab === 'community' && (
        <div>
          <div className={styles.filterRow}>
            <select
              className={styles.speciesFilter}
              value={speciesFilter}
              onChange={e => setSpeciesFilter(e.target.value)}
            >
              <option value="">All species</option>
              {speciesList.map(s => (
                <option key={s.species} value={s.species}>
                  {s.species} ({s.count})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.catchList}>
            {loading && <div className={styles.loading}>Loading...</div>}
            {!loading && allCatches.length === 0 && (
              <div className={styles.empty}>No catches found</div>
            )}
            {allCatches.map(c => renderCatchCard(c, true, false))}
          </div>
        </div>
      )}

      {/* Log Catch tab */}
      {tab === 'log' && (
        !user ? renderAuthPrompt('Sign in to log a catch') : (
          successMsg ? (
            <div className={styles.successMsg}>{successMsg}</div>
          ) : (
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Location</label>
                <select
                  className={styles.select}
                  value={formLocationId}
                  onChange={e => setFormLocationId(Number(e.target.value))}
                >
                  <option value="">Select a location</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Catch date</label>
                <select
                  className={styles.select}
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                >
                  {dateOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Species</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Snapper, Crayfish"
                  value={formSpecies}
                  onChange={e => setFormSpecies(e.target.value)}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Weight (kg)</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Optional"
                    value={formWeight}
                    onChange={e => setFormWeight(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Length (cm)</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Optional"
                    value={formLength}
                    onChange={e => setFormLength(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Quantity</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    step="1"
                    value={formQuantity}
                    onChange={e => setFormQuantity(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Depth (m)</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Optional"
                    value={formDepth}
                    onChange={e => setFormDepth(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Method</label>
                <select
                  className={styles.select}
                  value={formMethod}
                  onChange={e => setFormMethod(e.target.value)}
                >
                  <option value="">Select method</option>
                  <option value="spearfishing">Spearfishing</option>
                  <option value="line">Line</option>
                  <option value="net">Net</option>
                  <option value="hand">Hand</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Notes (optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Conditions, bait, anything notable..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <button
                className={styles.btn}
                onClick={handleSubmit}
                disabled={!formLocationId || !formSpecies.trim() || submitting}
              >
                {submitting ? 'Logging...' : 'Log Catch'}
              </button>
            </div>
          )
        )
      )}
    </div>
  )
}
