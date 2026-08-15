import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { DayForecast, Location } from '../types'
import type { VisibilityReport } from '../lib/underwaterVisibility'
import { submitReport } from '../lib/api'
import { feetToMetres } from '../lib/units'
import VisibilityAnalyser from './VisibilityAnalyser'
import { KelpVisibilityNote } from './KelpVisibilityNote'
import { IconCheck } from './icons'
import { toUserFacingError } from '../lib/frontendErrors'
import { trackClientEvent } from '../lib/telemetry'
import styles from './ReportForm.module.css'

interface Props {
  day: DayForecast | null
  allDays: DayForecast[]
  locations: Location[]
  onSubmitted: () => void
  initialLocationId?: number | null
  /** Unit the forecast was fetched in. Wave/swell heights on `day` are in
   *  this unit and must be normalised back to metres before being persisted
   *  so dive logs are comparable across users with different unit prefs. */
  units?: 'ft' | 'm'
  onAuthRequired?: () => void
}

function buildDateOptions(): { value: string; label: string }[] {
  const options = []
  const today = new Date()
  for (let i = 0; i <= 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const value = d.toISOString().slice(0, 10)
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' :
      d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
    options.push({ value, label })
  }
  return options
}

export function ReportForm({ day, allDays, locations, onSubmitted, initialLocationId, units = 'm', onAuthRequired }: Props) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(day?.date ?? todayStr)
  const [locationId, setLocationId] = useState<number | ''>(initialLocationId ?? '')
  const [actualVis, setActualVis] = useState('')
  const [notes, setNotes] = useState('')
  const [videoReport, setVideoReport] = useState<VisibilityReport | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Track the post-submit redirect timer so it can be cancelled on unmount —
  // otherwise navigating away quickly lets it fire onSubmitted against an
  // unmounted component.
  const submittedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(submittedTimer.current), [])

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

  // Surface the kelp-bed explainer when the user reports poor visibility near
  // kelp against a forecast that was meaningfully better — the classic
  // "clear offshore, murky in the canopy" case that isn't a forecast error.
  const showKelpNote = useMemo(() => {
    if (!/\b(kelp|seaweed|weeds?|fronds?|canopy)\b/i.test(notes)) return false
    const actual = parseFloat(actualVis)
    if (isNaN(actual) || !activeDay) return false
    const predicted = activeDay.vis_corrected ?? activeDay.vis_estimate
    return predicted - actual >= 2
  }, [notes, actualVis, activeDay])

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
    const vis = parseFloat(actualVis)
    if (isNaN(vis) || vis < 0 || vis > 50) {
      setError('Visibility must be a number between 0 and 50')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const heightToMetres = (v: number) => units === 'ft' ? feetToMetres(v) : v
      await submitReport({
        location_id: Number(locationId),
        report_date: selectedDate,
        actual_vis: vis,
        predicted_vis: activeDay.vis_estimate,
        wave_height: heightToMetres(activeDay.wave_height),
        swell_height: heightToMetres(activeDay.swell_height),
        wind_speed: activeDay.wind_speed,
        wind_dir: activeDay.wind_dir,
        precipitation: activeDay.precipitation,
        air_temp: activeDay.air_temp,
        sea_temp: activeDay.sea_temp,
        algae_risk: activeDay.algae.risk,
        // Satellite water clarity the forecast showed — measured algae signal.
        chlorophyll: activeDay.water_quality?.erddap_chlorophyll ?? undefined,
        kd490: activeDay.water_quality?.erddap_kd490 ?? undefined,
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
      submittedTimer.current = setTimeout(onSubmitted, 2500)
    } catch (e) {
      const failure = toUserFacingError(e, 'report')
      setError(failure.message)
      trackClientEvent('report.submit_failed', {
        code: failure.telemetryCode,
        status: failure.status,
        requiresAuth: failure.requiresAuth,
      })
      if (failure.requiresAuth) onAuthRequired?.()
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className={styles.card}>
        <div className={styles.success}>
          <IconCheck className={styles.successIcon} aria-hidden="true" />
          <div className={styles.successText}>Report submitted — thanks for contributing!</div>
        </div>
      </div>
    )
  }

  const videoRejected = !!(videoReport?.validation && !videoReport.validation.is_valid)

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.title}>Log actual visibility</div>
        <p className={styles.subtitle}>Help improve predictions for other divers at this spot.</p>
      </div>

      {/* Section 1 — which spot, which day: the two facts that identify this dive */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Spot &amp; date</div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="report-location">Location</label>
            <select
              id="report-location"
              className={styles.select}
              value={locationId}
              onChange={e => setLocationId(Number(e.target.value))}
            >
              <option value="">Select a saved location</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="report-date">Dive date</label>
            <select
              id="report-date"
              className={styles.select}
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            >
              {dateOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 2 — what the diver actually saw in the water */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>What you saw</div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="report-vis">Actual visibility (metres)</label>
          <input
            id="report-vis"
            className={styles.input}
            type="number"
            min="0"
            max="50"
            step="0.5"
            placeholder="e.g. 8"
            value={actualVis}
            onChange={e => setActualVis(e.target.value)}
          />
          {activeDay ? (
            <div className={styles.hint}>
              Model predicted {(activeDay.vis_corrected ?? activeDay.vis_estimate).toFixed(1)}m for{' '}
              {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          ) : (
            <div className={styles.hint}>No forecast data available for this date</div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="report-notes">Notes (optional)</label>
          <textarea
            id="report-notes"
            className={styles.textarea}
            placeholder="Anything unusual — kelp, jellyfish, runoff..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        {showKelpNote && <KelpVisibilityNote defaultOpen />}
      </div>

      {/* Section 3 — optional on-device video analysis, kept visually
          secondary (recessed panel) so it never competes with the required
          fields above it. */}
      <div className={styles.videoSection}>
        <div className={styles.videoSectionHead}>
          <span className={styles.sectionLabel}>Dive video analysis</span>
          <span className={styles.optionalTag}>Optional</span>
        </div>
        <VisibilityAnalyser onResult={onVideoResult} />
        {videoReport && (
          <div className={`${styles.hint} ${videoRejected ? styles.hintError : ''}`}>
            {videoRejected
              ? `Video rejected — does not appear to be underwater footage (${Math.round(videoReport.validation!.confidence * 100)}% confidence)`
              : `Video analysis: ${videoReport.visibility_m.median.toFixed(1)}m median (${videoReport.frameCount} frames) — ${
                  videoReport.validation
                    ? `${Math.round(videoReport.validation.confidence * 100)}% underwater confidence`
                    : 'this boosts report trust'
                }`
            }
          </div>
        )}
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <button
        className={styles.btn}
        onClick={handleSubmit}
        disabled={!locationId || !actualVis || submitting || !activeDay}
      >
        {submitting ? 'Submitting…' : 'Submit report'}
      </button>
    </div>
  )
}
