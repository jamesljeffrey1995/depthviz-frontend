import { useState, useRef } from 'react'
import type { DataDispute, DataDisputeCreate, Location } from '../types'
import { submitDispute } from '../lib/api'
import { uploadDisputeImage } from '../lib/disputeUpload'
import { IconCheck } from './icons'
import styles from './DisputeForm.module.css'

const FIELD_LABELS: Record<string, string> = {
  sea_temp: 'Sea Temperature (°C)',
  visibility: 'Underwater Visibility (m)',
  wave_height: 'Wave Height (m)',
  wind_speed: 'Wind Speed (knots)',
  swell_height: 'Swell Height (m)',
  swell_period: 'Swell Period (seconds)',
}

function fieldUnit(fieldName: string): string {
  switch (fieldName) {
    case 'sea_temp': return '°C'
    case 'wind_speed': return 'kn'
    case 'swell_period': return 's'
    default: return 'm'
  }
}

interface Props {
  locations: Location[]
  defaultLocationId?: number | null
  defaultDate?: string
  defaultField?: string
  defaultForecastValue?: number | null
  onClose: () => void
}

export function DisputeForm({
  locations,
  defaultLocationId,
  defaultDate,
  defaultField,
  defaultForecastValue,
  onClose,
}: Props) {
  const [locationId, setLocationId] = useState<string>(defaultLocationId ? String(defaultLocationId) : '')
  const [reportDate, setReportDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10))
  const [field, setField] = useState(defaultField ?? 'sea_temp')
  const [reportedValue, setReportedValue] = useState('')
  const [forecastValue, setForecastValue] = useState(
    defaultForecastValue != null ? String(defaultForecastValue) : ''
  )
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<DataDispute | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10 MB')
      return
    }
    setImageFile(file)
    setError('')
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const parsedValue = parseFloat(reportedValue)
    if (isNaN(parsedValue)) {
      setError('Please enter a valid measured value')
      return
    }

    setSubmitting(true)
    let imageUrl: string | undefined

    if (imageFile) {
      setUploading(true)
      try {
        imageUrl = await uploadDisputeImage(imageFile)
      } catch (uploadErr) {
        // Image upload failure is non-fatal — submit without the image rather than blocking the report
        console.warn('Dispute image upload failed, submitting without photo:', uploadErr)
        setError('Photo upload failed — dispute will be submitted without the image.')
      }
      setUploading(false)
    }

    try {
      const payload: DataDisputeCreate = {
        location_id: locationId ? Number(locationId) : undefined,
        report_date: reportDate,
        field_disputed: field,
        reported_value: parsedValue,
        forecast_value: forecastValue ? parseFloat(forecastValue) : undefined,
        image_url: imageUrl,
      }
      const dispute = await submitDispute(payload)
      setResult(dispute)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    // Derive units from the immutable result, not the mutable field state
    const unit = fieldUnit(result.field_disputed)

    return (
      <div className={styles.page}>
        <div className={styles.successCard}>
          <div className={styles.successHead}>
            <IconCheck className={styles.successIcon} aria-hidden="true" />
            <div className={styles.successTitle}>Report submitted</div>
          </div>
          <p className={styles.successText}>
            Your data dispute has been logged and will be reviewed.
          </p>

          {result.ai_extracted_value != null && (
            <div className={styles.aiResult}>
              <div className={styles.aiTitle}>AI image analysis</div>
              <div className={styles.aiRow}>
                <span>Extracted reading</span>
                <strong>{result.ai_extracted_value.toFixed(1)} {unit}</strong>
              </div>
              <div className={styles.aiRow}>
                <span>Confidence</span>
                <strong>{result.ai_confidence != null ? `${Math.round(result.ai_confidence * 100)}%` : 'N/A'}</strong>
              </div>
              {result.ai_notes && (
                <div className={styles.aiNotes}>{result.ai_notes}</div>
              )}
              {Math.abs(result.ai_extracted_value - result.reported_value) < 1 && (
                <div className={styles.aiMatch}>
                  AI reading matches your reported value — strong evidence
                </div>
              )}
            </div>
          )}

          {result.image_url && result.ai_extracted_value == null && (
            <div className={styles.aiResult}>
              <div className={styles.aiTitle}>AI image analysis</div>
              <p className={styles.aiNotes}>
                {result.ai_notes ?? 'AI could not extract a reading from the image. Your dispute has still been submitted for manual review.'}
              </p>
            </div>
          )}

          <div className={styles.disputeSummary}>
            <div className={styles.aiRow}>
              <span>Your reading</span>
              <strong>{result.reported_value} {unit}</strong>
            </div>
            {result.forecast_value != null && (
              <div className={styles.aiRow}>
                <span>Forecast value</span>
                <strong>{result.forecast_value} {unit}</strong>
              </div>
            )}
            <div className={styles.aiRow}>
              <span>Status</span>
              <strong className={styles.statusPending}>Pending review</strong>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.title}>Report incorrect data</div>
          <p className={styles.subtitle}>
            Noticed the forecast doesn't match reality? Upload a photo of your dive computer or watch and
            our AI will extract the reading automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Step 1 — what to dispute */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>What to dispute</div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="dispute-location">Location (optional)</label>
              <select
                id="dispute-location"
                className={styles.select}
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
              >
                <option value="">— Select a saved location —</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="dispute-date">Dive date</label>
                <input
                  id="dispute-date"
                  type="date"
                  className={styles.input}
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="dispute-field">What data is incorrect?</label>
                <select
                  id="dispute-field"
                  className={styles.select}
                  value={field}
                  onChange={e => setField(e.target.value)}
                  required
                >
                  {Object.entries(FIELD_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step 2 — why: the two numbers being compared */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Why</div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="dispute-reading">Your reading</label>
                <input
                  id="dispute-reading"
                  type="number"
                  step="0.1"
                  className={styles.input}
                  placeholder="e.g. 10.0"
                  value={reportedValue}
                  onChange={e => setReportedValue(e.target.value)}
                  required
                  aria-describedby="dispute-reading-hint"
                />
                <span id="dispute-reading-hint" className={styles.hint}>{FIELD_LABELS[field]}</span>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="dispute-forecast">Forecast value</label>
                <input
                  id="dispute-forecast"
                  type="number"
                  step="0.1"
                  className={styles.input}
                  placeholder="e.g. 12.0"
                  value={forecastValue}
                  onChange={e => setForecastValue(e.target.value)}
                  aria-describedby="dispute-forecast-hint"
                />
                <span id="dispute-forecast-hint" className={styles.hint}>What DepthViz showed</span>
              </div>
            </div>
          </div>

          {/* Step 3 — evidence */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionLabel}>Evidence</span>
              <span className={styles.optionalTag}>Optional, but recommended</span>
            </div>
            <p className={styles.hint}>
              Upload a photo of your dive computer, watch, or instrument. Our AI will automatically extract the reading.
            </p>
            <div
              className={styles.dropZone}
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
              role="button"
              tabIndex={0}
              aria-label="Upload photo of instrument"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Selected evidence" className={styles.preview} />
              ) : (
                <div className={styles.dropZoneInner}>
                  <div className={styles.dropIcon} aria-hidden="true">📷</div>
                  <div className={styles.dropText}>Tap to upload photo</div>
                  <div className={styles.dropSubtext}>JPEG, PNG or HEIC · Max 10 MB</div>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              onChange={handleImageChange}
              aria-label="Photo evidence file input"
            />
            {imageFile && (
              <button
                type="button"
                className={styles.removeImage}
                onClick={() => { setImageFile(null); setImagePreview(null) }}
              >
                Remove photo
              </button>
            )}
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
              aria-busy={submitting}
            >
              {uploading ? 'Uploading photo…' : submitting ? 'Submitting…' : 'Submit dispute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
