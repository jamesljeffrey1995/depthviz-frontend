import { useState, useCallback } from 'react'
import type { Location } from '../types'
import type { VisibilityReport } from '../lib/underwaterVisibility'
import { submitReport } from '../lib/api'
import VisibilityAnalyser from './VisibilityAnalyser'
import styles from './ReportForm.module.css'
import adminStyles from './AdminPanel.module.css'

interface Props {
  locations: Location[]
  onSubmitted?: () => void
}

export function AdminLogDive({ locations, onSubmitted }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [locationId, setLocationId] = useState<number | ''>('')
  const [actualVis, setActualVis] = useState('')
  const [notes, setNotes] = useState('')
  const [videoReport, setVideoReport] = useState<VisibilityReport | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const onVideoResult = useCallback((report: VisibilityReport) => {
    setVideoReport(report)
    if (!actualVis) {
      setActualVis(report.visibility_m.median.toFixed(1))
    }
  }, [actualVis])

  const handleSubmit = async () => {
    if (!locationId) { setError('Please select a location'); return }
    if (!actualVis) { setError('Please enter the actual visibility'); return }
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
        predicted_vis: 0,
        notes: notes.slice(0, 500) || undefined,
        ...(videoReport && (!videoReport.validation || videoReport.validation.is_valid) ? {
          video_vis_median: videoReport.visibility_m.median,
          video_vis_p10: videoReport.visibility_m.p10,
          video_vis_p90: videoReport.visibility_m.p90,
          video_t_median: videoReport.t_median,
          video_frame_count: videoReport.frameCount,
        } : {}),
      })
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setActualVis('')
        setNotes('')
        setVideoReport(null)
        setSelectedDate(todayStr)
        setLocationId('')
        onSubmitted?.()
      }, 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className={adminStyles.section}>
        <div className={styles.success}>✓ Dive logged successfully</div>
      </div>
    )
  }

  return (
    <div className={adminStyles.section}>
      <div className={styles.field}>
        <label className={styles.label}>Dive date</label>
        <input
          className={styles.input}
          type="date"
          max={todayStr}
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Location</label>
        <select
          className={styles.select}
          value={locationId}
          onChange={e => setLocationId(Number(e.target.value))}
        >
          <option value="">Select a location</option>
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
          <div className={styles.hint} style={
            videoReport.validation && !videoReport.validation.is_valid
              ? { color: '#c0392b' }
              : undefined
          }>
            {videoReport.validation && !videoReport.validation.is_valid
              ? `Video rejected — does not appear to be underwater footage (${Math.round(videoReport.validation.confidence * 100)}% confidence)`
              : `Video analysis: ${videoReport.visibility_m.median.toFixed(1)}m median (${videoReport.frameCount} frames) — ${
                  videoReport.validation
                    ? `${Math.round(videoReport.validation.confidence * 100)}% underwater confidence`
                    : 'this boosts report trust'
                }`
            }
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button
        className={styles.btn}
        onClick={handleSubmit}
        disabled={!locationId || !actualVis || submitting}
      >
        {submitting ? 'Submitting...' : 'Submit Report'}
      </button>
    </div>
  )
}
