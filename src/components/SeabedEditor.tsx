import { useEffect, useState } from 'react'
import { ApiError, updateLocation } from '../lib/api'
import type { Location, SeabedClass } from '../types'
import { IconChevronDown, IconChevronUp, IconCheck } from './icons'
import styles from './SeabedEditor.module.css'

interface Props {
  location: Location
  /** Called with the updated row so the parent can refresh state + forecast. */
  onUpdated: (loc: Location) => void
}

const SEABED_OPTIONS: { value: SeabedClass; label: string; hint: string }[] = [
  { value: 'rock', label: 'Rock / reef', hint: 'Bedrock or boulders — little loose sediment' },
  { value: 'gravel', label: 'Gravel / shingle', hint: 'Coarse, hard to stir, clears fast' },
  { value: 'sand', label: 'Sand', hint: 'Settles within a tide' },
  { value: 'mixed', label: 'Mixed / sandy-mud', hint: 'Default — moderate stirring & recovery' },
  { value: 'mud', label: 'Mud / silt', hint: 'Stirs easily, stays murky for days' },
]

/**
 * Lets the owner of a saved spot set its water depth and seabed type, which
 * feed the bottom-orbital-velocity / bed-shear resuspension model (issue #155).
 * Depth overrides the coarse open-data bathymetry lookup; seabed type sets the
 * critical-shear threshold and how long a post-storm plume lingers.
 */
export function SeabedEditor({ location, onUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [depth, setDepth] = useState<string>(location.depth_m != null ? String(location.depth_m) : '')
  const [seabed, setSeabed] = useState<SeabedClass | ''>(location.seabed_class ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Re-sync local fields whenever a different spot is selected.
  useEffect(() => {
    setDepth(location.depth_m != null ? String(location.depth_m) : '')
    setSeabed(location.seabed_class ?? '')
    setError(null)
    setSaved(false)
  }, [location.id, location.depth_m, location.seabed_class])

  const depthNum = depth.trim() === '' ? null : Number(depth)
  // Depth must be > 0 (the API treats 0 as "unset"); blank clears it.
  const depthInvalid = depthNum != null && (Number.isNaN(depthNum) || depthNum <= 0 || depthNum > 11000)
  const dirty =
    (depthNum ?? null) !== (location.depth_m ?? null) ||
    (seabed || null) !== (location.seabed_class ?? null)

  async function handleSave() {
    if (depthInvalid) {
      setError('Enter a depth between 0 and 11000 m (leave blank for auto)')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateLocation(location.id, {
        depth_m: depthNum,
        seabed_class: seabed === '' ? null : seabed,
      })
      onUpdated(updated)
      setSaved(true)
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError('Only the spot owner can edit this')
      } else {
        setError(e instanceof Error ? e.message : 'Could not save')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card}>
      <button
        className={styles.toggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>Seabed &amp; depth {location.seabed_class || location.depth_m != null ? '' : '(improve accuracy)'}</span>
        {open ? (
          <IconChevronUp className={styles.arrow} aria-hidden="true" />
        ) : (
          <IconChevronDown className={styles.arrow} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className={styles.body}>
          <p className={styles.lead}>
            Set this spot&apos;s depth and seabed type so the forecast can model
            wave-driven seabed resuspension — the main cause of &quot;flat surface
            but still murky&quot; days.
          </p>

          {/* Input/selection controls — grouped tightly, separate from the
              save/status feedback below. */}
          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Water depth (m)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={11000}
                step={0.5}
                value={depth}
                placeholder="auto (from bathymetry)"
                onChange={e => setDepth(e.target.value)}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Seabed type</span>
              <select
                value={seabed}
                onChange={e => setSeabed(e.target.value as SeabedClass | '')}
                className={styles.input}
              >
                <option value="">Auto / unknown</option>
                {SEABED_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            {seabed && (
              <p className={styles.hint}>{SEABED_OPTIONS.find(o => o.value === seabed)?.hint}</p>
            )}
          </div>

          {/* Save / status feedback — the terminal action of the flow, set
              apart from the controls above by a rule and generous spacing. */}
          <div className={styles.footer}>
            {error && <p className={styles.error}>{error}</p>}
            {saved && !dirty && (
              <p className={styles.ok}>
                <IconCheck className={styles.okIcon} aria-hidden="true" />
                Saved
              </p>
            )}

            <button
              className={styles.save}
              onClick={handleSave}
              disabled={saving || depthInvalid || !dirty}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
