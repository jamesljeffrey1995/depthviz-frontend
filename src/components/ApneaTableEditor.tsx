import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createApneaTable, deleteApneaTable, getApneaTable, updateApneaTable } from '../lib/api'
import type { ApneaCycle, ApneaDifficulty, ApneaTableType } from '../types'
import styles from './ApneaTableEditor.module.css'

const BLANK_CYCLE: ApneaCycle = { hold_seconds: 60, rest_seconds: 60 }

interface Props {
  mode: 'create' | 'edit'
}

function o2Preset(holdsS: number[], restS: number): ApneaCycle[] {
  return holdsS.map((h, i) => ({
    hold_seconds: h,
    rest_seconds: i < holdsS.length - 1 ? restS : 0,
  }))
}

function co2Preset(holdS: number, restsS: number[]): ApneaCycle[] {
  return [
    ...restsS.map(r => ({ hold_seconds: holdS, rest_seconds: r })),
    { hold_seconds: holdS, rest_seconds: 0 },
  ]
}

const PRESETS: { label: string; type: ApneaTableType; difficulty: ApneaDifficulty; cycles: ApneaCycle[] }[] = [
  { label: 'O2 starter', type: 'o2', difficulty: 'beginner',
    cycles: o2Preset([60, 75, 90, 105, 120, 135], 120) },
  { label: 'CO2 starter', type: 'co2', difficulty: 'beginner',
    cycles: co2Preset(60, [90, 75, 60, 45, 30]) },
]

export function ApneaTableEditor({ mode }: Props) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editingId = mode === 'edit' && id ? Number(id) : null

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tableType, setTableType] = useState<ApneaTableType>('custom')
  const [difficulty, setDifficulty] = useState<ApneaDifficulty>('beginner')
  const [isPublic, setIsPublic] = useState(false)
  const [cycles, setCycles] = useState<ApneaCycle[]>([{ ...BLANK_CYCLE }])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editingId === null) return
    let cancelled = false
    setLoading(true)
    getApneaTable(editingId)
      .then(t => {
        if (cancelled) return
        if (t.is_system) {
          setError('System tables cannot be edited. Use "Copy" instead.')
          return
        }
        setName(t.name)
        setDescription(t.description ?? '')
        setTableType(t.table_type)
        setDifficulty(t.difficulty)
        setIsPublic(t.is_public)
        setCycles(t.cycles.length ? t.cycles : [{ ...BLANK_CYCLE }])
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [editingId])

  const updateCycle = (idx: number, patch: Partial<ApneaCycle>) => {
    setCycles(prev => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  const addCycle = () => {
    setCycles(prev => {
      // Reasonable default: copy the previous cycle.
      const last = prev[prev.length - 1] ?? BLANK_CYCLE
      return [...prev, { ...last }]
    })
  }

  const removeCycle = (idx: number) => {
    setCycles(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setTableType(preset.type)
    setDifficulty(preset.difficulty)
    setCycles(preset.cycles.map(c => ({ ...c })))
  }

  const total = cycles.reduce((acc, c) => acc + c.hold_seconds + c.rest_seconds, 0)
  const totalMin = Math.round(total / 60)

  const handleSave = async () => {
    setError('')
    if (!name.trim()) { setError('Please enter a name'); return }
    if (cycles.length === 0) { setError('Add at least one cycle'); return }
    if (cycles.every(c => c.hold_seconds <= 0)) { setError('At least one cycle needs a non-zero hold'); return }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        table_type: tableType,
        difficulty,
        cycles,
        is_public: isPublic,
      }
      const saved = editingId !== null
        ? await updateApneaTable(editingId, payload)
        : await createApneaTable(payload)
      navigate(`/training/${saved.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (editingId === null) return
    if (!confirm('Delete this table? This cannot be undone.')) return
    try {
      await deleteApneaTable(editingId)
      navigate('/training')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  if (loading) {
    return <div className={styles.wrap}><div className={styles.subtitle}>Loading…</div></div>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>{editingId !== null ? 'Edit Table' : 'New Training Table'}</div>
      <div className={styles.subtitle}>{editingId !== null ? 'Tweak cycles and save' : 'Build your own breath-hold sequence'}</div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            type="text"
            value={name}
            maxLength={80}
            placeholder="e.g. Morning CO2 session"
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description (optional)</label>
          <textarea
            className={styles.textarea}
            value={description}
            maxLength={500}
            rows={2}
            placeholder="Notes for yourself or anyone you share with"
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <select className={styles.select} value={tableType} onChange={e => setTableType(e.target.value as ApneaTableType)}>
              <option value="o2">O2 (oxygen tolerance)</option>
              <option value="co2">CO2 (CO2 tolerance)</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Difficulty</label>
            <select className={styles.select} value={difficulty} onChange={e => setDifficulty(e.target.value as ApneaDifficulty)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
            Share publicly — anyone signed in can see it in the library
          </label>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cyclesHeader}>
          <span className={styles.label}>Cycles ({cycles.length})</span>
        </div>

        {editingId === null && (
          <div className={styles.preset}>
            <span style={{ fontSize: 10, letterSpacing: '0.15em', opacity: 0.5, alignSelf: 'center' }}>Preset:</span>
            {PRESETS.map(p => (
              <button key={p.label} type="button" className={styles.presetBtn} onClick={() => applyPreset(p)}>{p.label}</button>
            ))}
          </div>
        )}

        <div className={styles.cycleList}>
          {cycles.map((c, idx) => (
            <div key={idx} className={styles.cycleRow}>
              <div className={styles.cycleIdx}>#{idx + 1}</div>
              <div className={styles.cycleField}>
                <label htmlFor={`hold-${idx}`}>Hold (s)</label>
                <input
                  id={`hold-${idx}`}
                  className={styles.cycleInput}
                  type="number"
                  min={0}
                  max={1200}
                  value={c.hold_seconds}
                  onChange={e => updateCycle(idx, { hold_seconds: Math.max(0, Math.min(1200, Number(e.target.value) || 0)) })}
                />
              </div>
              <div className={styles.cycleField}>
                <label htmlFor={`rest-${idx}`}>Rest (s)</label>
                <input
                  id={`rest-${idx}`}
                  className={styles.cycleInput}
                  type="number"
                  min={0}
                  max={1200}
                  value={c.rest_seconds}
                  onChange={e => updateCycle(idx, { rest_seconds: Math.max(0, Math.min(1200, Number(e.target.value) || 0)) })}
                />
              </div>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeCycle(idx)}
                disabled={cycles.length === 1}
                aria-label={`Remove cycle ${idx + 1}`}
              >×</button>
            </div>
          ))}
        </div>

        <button type="button" className={styles.addBtn} onClick={addCycle} disabled={cycles.length >= 24}>
          + Add cycle
        </button>

        <div className={styles.totalNote}>
          Total session: ~{totalMin} min · longest hold {Math.max(...cycles.map(c => c.hold_seconds))}s
        </div>
      </div>

      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => navigate('/training')} disabled={saving}>
          Cancel
        </button>
        <button className={styles.btn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : editingId !== null ? 'Save changes' : 'Create table'}
        </button>
        {editingId !== null && (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete} disabled={saving} aria-label="Delete table">
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
