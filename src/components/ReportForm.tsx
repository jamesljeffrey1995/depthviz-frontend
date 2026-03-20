import { useState, useMemo, useCallback } from 'react'
import type { DayForecast, Location } from '../types'
import type { VisibilityReport } from '../lib/underwaterVisibility'
import { submitReport } from '../lib/api'
import VisibilityAnalyser from './VisibilityAnalyser'
import styles from './ReportForm.module.css'

interface Props {
  day: DayForecast | null
  allDays: DayForecast[]
  locations: Location[]
  onSubmitted: () => void
  initialLocationId?: number | null
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

export function ReportForm({ day, allDays, locations, onSubmitted, initialLocationId }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(day?.date ?? todayStr)
  const [locationId, setLocationId] = useState<number | ''>(initialLocationId ?? '')
  const [actualVis, setActualVis] = useState('')
  const [notes, setNotes] = useState('')
  const [videoReport, setVideoReport] = useState<VisibilityReport | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const onVideoResult = useCallback((report: VisibilityReport) => {
    setVideoReport(report)
    // Auto-fill actual_vis with the video median if user hasn't typed one
    if (!actualVis) {
      setActualVis(report.visibility_m.median.toFixed(1))
    }
  }, [actualVis])

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
        // Attach video DCP analysis if user analysed a dive video
        ...(videoReport ? {
          video_vis_median: videoReport.visibility_m.median,
          video_vis_p10: videoReport.visibility_m.p10,
          video_vis_p90: videoReport.visibility_m.p90,
          video_t_median: videoReport.t_median,
          video_frame_count: videoReport.frameCount,
        } : {}),
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
          {locations.map(l => (
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

      <div className={styles.field}>
        <label className={styles.label}>Dive video analysis (optional)</label>
        <VisibilityAnalyser onResult={onVideoResult} />
        {videoReport && (
          <div className={styles.hint}>
            Video analysis: {videoReport.visibility_m.median.toFixed(1)}m median
            ({videoReport.frameCount} frames) — this boosts report trust
          </div>
        )}
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