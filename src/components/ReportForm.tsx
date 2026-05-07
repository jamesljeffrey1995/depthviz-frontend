import { useState, useMemo, useCallback } from 'react'
import type { DayForecast, Location } from '../types'
import type { VisibilityReport } from '../lib/underwaterVisibility'
import { submitReport } from '../lib/api'
import { feetToMetres, metresToFeet, type Units } from '../lib/units'
import VisibilityAnalyser from './VisibilityAnalyser'
import styles from './ReportForm.module.css'

interface Props {
  day: DayForecast | null
  allDays: DayForecast[]
  locations: Location[]
  onSubmitted: () => void
  initialLocationId?: number | null
  /** Display + entry unit for visibility/wave/swell. Wave/swell on `day`
   *  are already in this unit (converted by the API); visibility comes
   *  back in metres and is converted here. The user's typed actual_vis
   *  is normalised back to metres before submission. */
  units?: Units
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

export function ReportForm({ day, allDays, locations, onSubmitted, initialLocationId, units = 'm' }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(day?.date ?? todayStr)
  const [locationId, setLocationId] = useState<number | ''>(initialLocationId ?? '')
  const [actualVis, setActualVis] = useState('')
  const [notes, setNotes] = useState('')
  const [videoReport, setVideoReport] = useState<VisibilityReport | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const isFt = units === 'ft'
  const visUnitLabel = isFt ? 'feet' : 'metres'
  const visUnitShort = isFt ? 'ft' : 'm'
  // Reasonable upper-bound for entered visibility: 50m ≈ 164ft.
  const visMax = isFt ? 164 : 50

  const onVideoResult = useCallback((report: VisibilityReport) => {
    setVideoReport(report)
    // Auto-fill actual_vis with the video median (always metres) converted
    // into the user's preferred entry unit.
    if (!actualVis) {
      const v = isFt ? metresToFeet(report.visibility_m.median) : report.visibility_m.median
      setActualVis(v.toFixed(1))
    }
  }, [actualVis, isFt])

  const dateOptions = useMemo(() => buildDateOptions(), [])
  const activeDay = useMemo(
    () => allDays.find(d => d.date === selectedDate) ?? day,
    [allDays, selectedDate, day]
  )

  const handleSubmit = async () => {
    if (!locationId) {
      setError('Please select a saved location')
      return
    }
    if (!actualVis) {
      setError('Please enter the actual visibility')
      return
    }
    if (!activeDay) {
      setError('No forecast data available for this date')
      return
    }
    const visEntered = parseFloat(actualVis)
    if (isNaN(visEntered) || visEntered < 0 || visEntered > visMax) {
      setError(`Visibility must be a number between 0 and ${visMax}`)
      return
    }
    // Persist visibility/wave/swell in metres regardless of UI units so
    // dive logs are comparable across users with different prefs.
    const visMetres = isFt ? feetToMetres(visEntered) : visEntered
    setSubmitting(true)
    setError('')
    try {
      const heightToMetres = (v: number) => isFt ? feetToMetres(v) : v
      await submitReport({
        location_id: Number(locationId),
        report_date: selectedDate,
        actual_vis: visMetres,
        predicted_vis: activeDay.vis_estimate,
        wave_height: heightToMetres(activeDay.wave_height),
        swell_height: heightToMetres(activeDay.swell_height),
        wind_speed: activeDay.wind_speed,
        wind_dir: activeDay.wind_dir,
        precipitation: activeDay.precipitation,
        air_temp: activeDay.air_temp,
        sea_temp: activeDay.sea_temp,
        algae_risk: activeDay.algae.risk,
        notes: notes.slice(0, 500) || undefined,
        // Attach video DCP analysis only if validation passed
        ...(videoReport && (!videoReport.validation || videoReport.validation.is_valid) ? {
          video_vis_median: videoReport.visibility_m.median,
          video_vis_p10: videoReport.visibility_m.p10,
          video_vis_p90: videoReport.visibility_m.p90,
          video_t_median: videoReport.t_median,
          video_frame_count: videoReport.frameCount,
        } : {}),
      })
      setDone(true)
      setTimeout(onSubmitted, 2500)
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

  // Predicted visibility for the active day, in the user's display unit.
  const predictedVisM = activeDay ? (activeDay.vis_corrected ?? activeDay.vis_estimate) : null
  const predictedVisDisplay = predictedVisM !== null
    ? (isFt ? metresToFeet(predictedVisM) : predictedVisM)
    : null

  return (
    <div className={styles.card}>
      <div className={styles.title}>Log Actual Visibility</div>
      <div className={styles.subtitle}>Help improve predictions for others</div>

      <div className={styles.field}>
        <label className={styles.label}>Dive date</label>
        <select
          className={styles.select}
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
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
        <label className={styles.label}>Actual visibility ({visUnitLabel})</label>
        <input
          className={styles.input}
          type="number"
          min="0"
          max={visMax}
          step="0.5"
          placeholder={isFt ? 'e.g. 26' : 'e.g. 8'}
          value={actualVis}
          onChange={e => setActualVis(e.target.value)}
        />
        {activeDay && predictedVisDisplay !== null && (
          <div className={styles.hint}>
            Model predicted {predictedVisDisplay.toFixed(1)}{visUnitShort} for{' '}
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
          <div className={styles.hint} style={
            videoReport.validation && !videoReport.validation.is_valid
              ? { color: '#c0392b' }
              : undefined
          }>
            {videoReport.validation && !videoReport.validation.is_valid
              ? `Video rejected — does not appear to be underwater footage (${Math.round(videoReport.validation.confidence * 100)}% confidence)`
              : `Video analysis: ${(isFt ? metresToFeet(videoReport.visibility_m.median) : videoReport.visibility_m.median).toFixed(1)}${visUnitShort} median (${videoReport.frameCount} frames) — ${
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
        disabled={!locationId || !actualVis || submitting || !activeDay}
      >
        {submitting ? 'Submitting...' : 'Submit Report'}
      </button>
    </div>
  )
}
