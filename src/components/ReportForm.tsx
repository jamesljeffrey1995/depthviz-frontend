import { useState, useMemo, useEffect } from 'react'
import type { DayForecast, Location } from '../types'
import { submitReport } from '../lib/api'
import { filterVisibleLocations } from '../lib/spots'
import { supabase } from '../lib/supabase'
import styles from './ReportForm.module.css'

interface Props {
  day: DayForecast | null
  allDays: DayForecast[]
  locations: Location[]
  onSubmitted: () => void
}

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

export function ReportForm({ day, allDays, locations, onSubmitted }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(day?.date ?? todayStr)
  const [locationId, setLocationId] = useState<number | ''>('')
  const [actualVis, setActualVis] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  // Re-check the current user every time the form mounts so a fresh
  // session token is always used when filtering. getLocations already
  // filters, but this is defence in depth: if a stale locations array
  // is passed in via prop, we still strip rows the current user should
  // not see.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setUserId(session?.user?.id ?? null)
    })
    return () => { cancelled = true }
  }, [])

  const visibleLocations = useMemo(
    () => filterVisibleLocations(locations, userId),
    [locations, userId],
  )

  const dateOptions = useMemo(() => buildDateOptions(), [])
  const activeDay = useMemo(
    () => allDays.find(d => d.date === selectedDate) ?? day,
    [allDays, selectedDate, day]
  )

  const handleSubmit = async () => {
    if (!locationId || !actualVis || !activeDay) return
    const vis = parseFloat(actualVis)
    if (isNaN(vis) || vis < 0 || vis > 50) {
      setError('Visibility must be a number between 0 and 50')
      return
    }
    // Final guard: never allow a report to be attached to a location
    // the current user cannot see.
    if (!visibleLocations.some(l => l.id === Number(locationId))) {
      setError('That location is not available to your account')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await submitReport({
        location_id: Number(locationId),
        report_date: selectedDate,
        actual_vis: vis,
        predicted_vis: activeDay.vis_estimate,
        wave_height: activeDay.wave_height,
        swell_height: activeDay.swell_height,
        wind_speed: activeDay.wind_speed,
        wind_dir: activeDay.wind_dir,
        precipitation: activeDay.precipitation,
        air_temp: activeDay.air_temp,
        sea_temp: activeDay.sea_temp,
        algae_risk: activeDay.algae.risk,
        notes: notes.slice(0, 500) || undefined,
      })
      setDone(true)
      setTimeout(onSubmitted, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className={styles.card}>
        <div className={styles.success}>✓ Report submitted — thanks for contributing!</div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>Log Actual Visibility</div>
      <div className={styles.subtitle}>Help improve predictions for others</div>

      <div className={styles.field}>
        <label className={styles.label}>Dive date</label>
        <select
          className={styles.select}
          value={selectedDate}
          onChange={e => { setSelectedDate(e.target.value); setActualVis('') }}
        >
          {dateOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Location</label>
        <select className={styles.select} value={locationId} onChange={e => setLocationId(Number(e.target.value))}>
          <option value="">Select a saved location</option>
          {visibleLocations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Actual visibility (metres)</label>
        <input
          className={styles.input}
          type="number"
          min="0"
          max="50"
          step="0.5"
          placeholder="e.g. 8"
          value={actualVis}
          onChange={e => setActualVis(e.target.value)}
        />
        {activeDay && (
          <div className={styles.hint}>
            Model predicted {(activeDay.vis_corrected ?? activeDay.vis_estimate).toFixed(1)}m for{' '}
            {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        )}
        {!activeDay && (
          <div className={styles.hint}>No forecast data available for this date</div>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Notes (optional)</label>
        <textarea
          className={styles.textarea}
          placeholder="Anything unusual — kelp, jellyfish, runoff..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          maxLength={500}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button
        className={styles.btn}
        onClick={handleSubmit}
        disabled={!locationId || !actualVis || submitting || !activeDay}
      >
        {submitting ? 'Submitting...' : 'Submit Report'}
      </button>
    </div>
  )
}
