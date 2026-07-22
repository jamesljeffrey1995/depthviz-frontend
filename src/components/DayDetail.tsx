import { useState } from 'react'
import type { DayForecast, ForecastResponse } from '../types'
import { getImpact, getShallowWaterConfidence } from '../lib/visibility'
import { getWaterQuality } from '../lib/units'
import { SEVERITY_TOKEN, impactToken, riskToken } from '../lib/severity'
import { SwellCompass } from './SwellCompass'
import { VisTrendChart } from './VisTrendChart'
import { SwellChart } from './SwellChart'
import { KelpVisibilityNote } from './KelpVisibilityNote'
import { SatelliteImageryCard } from './SatelliteImageryCard'
import { ForecastExplanation } from './ForecastExplanation'
import { DiveScoreCard } from './DiveScoreCard'
import styles from './DayDetail.module.css'

interface Props {
  day: DayForecast
  locationName: string
  /** Spot coordinates — used to fetch satellite imagery for the selected day. */
  lat?: number
  lon?: number
  reportCount: number
  /** Confidence signal from the API — the hero softens it based on report age
   *  and conditions volatility. */
  modelConfidence?: ForecastResponse['model_confidence']
  /** Wave-height display unit — must match the units the API was asked to
   *  return so wave_height/swell_height numbers are labelled correctly. */
  units?: 'ft' | 'm'
  isAdmin?: boolean
  biasOffset?: number | null
  globalBiasOffset?: number | null
  maxDiveDepth?: number
  /** Full forecast series + selected index, used to render the visibility
   *  trend sparkline and the plain-language summary line. */
  days?: DayForecast[]
  selectedIndex?: number
  onSelectDay?: (index: number) => void
}

/** A translucent tint of a status token, for chip borders and washes — keeps
 *  the alpha derived from the token so a theme retune carries through. */
function tint(token: string, pct = 28): string {
  return `color-mix(in srgb, ${token} ${pct}%, transparent)`
}

/** Secondary metrics default to expanded on desktop, collapsed on phones. */
function defaultConditionsOpen(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(min-width: 768px)').matches
}

function getTurbidity(penalty: number): { label: string; color: string; spm: string; description: string } {
  if (penalty < 0.3)  return { label: 'Clear',        color: SEVERITY_TOKEN.safe,     spm: '< 2 mg/l',   description: 'Low sediment — minimal impact on visibility' }
  if (penalty < 1.0)  return { label: 'Slight haze',  color: SEVERITY_TOKEN.low,      spm: '2–5 mg/l',   description: 'Some particulates — slight reduction in viz' }
  if (penalty < 2.0)  return { label: 'Turbid',       color: SEVERITY_TOKEN.moderate, spm: '5–15 mg/l',  description: 'Elevated sediment — noticeable viz reduction' }
  if (penalty < 3.5)  return { label: 'Very turbid',  color: SEVERITY_TOKEN.high,     spm: '15–50 mg/l', description: 'High sediment load — likely post-swell resuspension' }
  return               { label: 'Extreme turbidity',   color: SEVERITY_TOKEN.high,     spm: '> 50 mg/l',  description: 'Storm/estuary levels — severe viz impact' }
}

function getAirTempSeverity(temp: number): { color: string; note: string | null } {
  if (temp < 4)  return { color: SEVERITY_TOKEN.high, note: 'fog risk' }
  if (temp < 10) return { color: SEVERITY_TOKEN.low,  note: null }
  return { color: SEVERITY_TOKEN.safe, note: null }
}

function getSeaTempSeverity(temp: number): { color: string; note: string | null } {
  if (temp > 20) return { color: SEVERITY_TOKEN.high, note: 'bloom risk' }
  if (temp > 15) return { color: SEVERITY_TOKEN.low,  note: 'algae risk' }
  return { color: SEVERITY_TOKEN.safe, note: null }
}

function getHumiditySeverity(humidity: number): { color: string; note: string | null } {
  if (humidity > 94) return { color: SEVERITY_TOKEN.high, note: null }
  if (humidity > 88) return { color: SEVERITY_TOKEN.low,  note: null }
  return { color: SEVERITY_TOKEN.safe, note: null }
}

/** Check if any advanced section has data worth showing */
function hasAdvancedData(day: DayForecast): boolean {
  const hasWaterQuality = day.nutrient_factor != null
  const hasTurbidity = day.turbidity_penalty != null && day.turbidity_penalty > 0
  const hasResuspension = day.resuspension && day.resuspension.risk_level !== 'none'
  const hasRiverDischarge = day.river_discharge && day.river_discharge.risk_level !== 'none'
  const hasBgcData = day.water_quality && (day.water_quality.bgc_kd != null || day.water_quality.erddap_chlorophyll != null)
  const hasFactors = day.factors.some(f => f.max_penalty > 0)
  return !!(hasWaterQuality || hasTurbidity || hasResuspension || hasRiverDischarge || hasBgcData || hasFactors)
}

/** Check if any risks are elevated (moderate or high) — these get promoted to the simple view */
function getElevatedWarnings(day: DayForecast): string[] {
  const warnings: string[] = []
  if (day.algae.risk === 'high') warnings.push('High algae bloom risk')
  else if (day.algae.risk === 'moderate') warnings.push('Moderate algae bloom risk')
  if (day.turbidity_penalty != null && day.turbidity_penalty >= 2.0) warnings.push('High turbidity')
  if (day.resuspension && (day.resuspension.risk_level === 'high' || day.resuspension.risk_level === 'moderate'))
    warnings.push(`${day.resuspension.risk_level === 'high' ? 'High' : 'Moderate'} seabed resuspension`)
  if (day.river_discharge && (day.river_discharge.risk_level === 'high' || day.river_discharge.risk_level === 'moderate'))
    warnings.push(`${day.river_discharge.risk_level === 'high' ? 'High' : 'Moderate'} river discharge`)
  return warnings
}

interface TraceRow {
  label: string
  detail: string
  penalty: number
  running: number
  isSubtotal?: boolean
}

function buildTrace(day: DayForecast): TraceRow[] {
  const factorPenaltyTotal = day.factors.reduce((s, f) => s + f.penalty, 0)
  const turbPen = day.turbidity_penalty ?? 0
  const resusPen = day.resuspension?.penalty ?? 0
  const riverPen = day.river_discharge?.penalty ?? 0

  // Reverse-engineer implied base (approx — excludes CDM, BGC soft-pull, smoothing)
  const impliedBase = day.vis_estimate - factorPenaltyTotal + turbPen + resusPen + riverPen
  let running = Math.max(0, Math.min(15, impliedBase))

  const rows: TraceRow[] = []
  rows.push({ label: 'Base', detail: '~approx, excl. CDM/BGC/smoothing', penalty: running, running })

  for (const f of day.factors) {
    running = Math.max(0, running + f.penalty)
    rows.push({
      label: f.name,
      detail: f.note ? `${f.value} · ${f.note}` : f.value,
      penalty: f.penalty,
      running,
    })
  }

  if (turbPen > 0) {
    running = Math.max(0, running - turbPen)
    rows.push({ label: 'Turbidity (SPM)', detail: 'satellite', penalty: -turbPen, running })
  }
  if (resusPen > 0) {
    running = Math.max(0, running - resusPen)
    rows.push({ label: 'Resuspension', detail: 'seabed', penalty: -resusPen, running })
  }
  if (riverPen > 0) {
    running = Math.max(0, running - riverPen)
    rows.push({ label: 'River Discharge', detail: 'plume', penalty: -riverPen, running })
  }

  rows.push({
    label: 'Model output',
    detail: 'vis_estimate (pre-bias)',
    penalty: 0,
    running: day.vis_estimate,
    isSubtotal: true,
  })

  return rows
}

export function DayDetail({ day, locationName, lat, lon, reportCount, modelConfidence = 'none', units = 'm', isAdmin = false, biasOffset = null, globalBiasOffset = null, maxDiveDepth, days, selectedIndex = 0, onSelectDay }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showConditions, setShowConditions] = useState(defaultConditionsOpen)
  const trendDays = days && days.length > 1 ? days : null
  const vis = day.vis_corrected ?? day.vis_estimate
  const pct = (vis / 15) * 100

  // Real "today" index in the forecast series — used by the hero so the best-
  // window "improving toward X" / "today is in the best window" copy stays
  // correct regardless of which day the user has clicked into.
  const heroDays = trendDays ?? [day]
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayIdx = (() => {
    const i = heroDays.findIndex((d) => d.date === todayISO)
    return i >= 0 ? i : Math.max(0, heroDays.findIndex((d) => d.date >= todayISO))
  })()

  const waterQuality = day.nutrient_factor != null ? getWaterQuality(day.nutrient_factor) : null
  const turbidity = day.turbidity_penalty != null && day.turbidity_penalty > 0
    ? getTurbidity(day.turbidity_penalty)
    : null

  const airSev  = getAirTempSeverity(day.air_temp)
  const seaSev  = day.sea_temp != null ? getSeaTempSeverity(day.sea_temp) : null
  const humSev  = getHumiditySeverity(day.humidity)

  const elevatedWarnings = getElevatedWarnings(day)
  const hasCoords = lat != null && lon != null
  const advancedAvailable = hasAdvancedData(day) || isAdmin || hasCoords

  const dominantWave = Math.max(day.wave_height ?? 0, day.swell_height ?? 0)
  // Server-side gate thresholds are in meters; normalize for comparison regardless of display units
  const dominantWaveM = units === 'ft' ? dominantWave / 3.28084 : dominantWave
  const windKn = day.wind_speed ?? 0
  const waveGate = dominantWaveM > 4
  const windWaveGate = windKn > 35 && dominantWaveM > 2

  const shallowWarning = (maxDiveDepth != null && maxDiveDepth < 20)
    ? getShallowWaterConfidence(dominantWaveM, windKn, maxDiveDepth)
    : null

  const shallowNote = shallowWarning ? (() => {
    const parts: string[] = []
    if (shallowWarning.waveExceeded) {
      parts.push(units === 'ft'
        ? `${(shallowWarning.waveHeightM * 3.28084).toFixed(1)}ft waves`
        : `${shallowWarning.waveHeightM.toFixed(1)}m waves`)
    }
    if (shallowWarning.windExceeded) parts.push(`${Math.round(shallowWarning.windKnots)}kn wind`)
    return `${parts.join(' & ')} — surface mixing may reduce visibility at ${maxDiveDepth}m more than the forecast reflects`
  })() : null

  return (
    <div className={styles.card}>
      {/* Decision hero — the single, prominent Dive Quality Score that answers
          "should I dive this spot today?" before any scrolling. Supersedes the
          legacy ForecastHeroCard, folding in the best-window shortcut. */}
      <DiveScoreCard
        day={day}
        locationName={locationName}
        forecast={{ report_count: reportCount, model_confidence: modelConfidence }}
        units={units}
        days={heroDays}
        todayIndex={todayIdx}
        onJumpToBestWindow={onSelectDay}
      />

      {/* Plain-English "why" panel */}
      <ForecastExplanation
        day={day}
        days={heroDays}
        forecast={{ report_count: reportCount, model_confidence: modelConfidence }}
        units={units}
      />

      {/* Visibility trend sparkline */}
      {trendDays && (
        <VisTrendChart days={trendDays} selectedIndex={selectedIndex} onSelect={onSelectDay} />
      )}

      {/* Swell & wave bar chart */}
      {trendDays && (
        <SwellChart days={trendDays} selectedIndex={selectedIndex} onSelect={onSelectDay} units={units} />
      )}

      {/* Compact viz bar — 0–15m context alongside the hero number */}
      <div className={styles.barContainer}>
        <div className={styles.barLabels}>
          <span>0m</span><span>5m</span><span>10m</span><span>15m</span>
        </div>
        <div className={styles.barTrack}>
          <div className={`${styles.barFill} ${styles[`bg_${day.color_class}`]}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* AI-correction note (moved out of hero to keep hero decision-focused) */}
      {day.vis_corrected !== null && (
        <div className={styles.correctedNote}>
          AI-corrected from {day.vis_estimate.toFixed(1)}m
          {day.vis_corrected_offset != null && Math.round(day.vis_corrected_offset * 10) !== 0 && (
            <span className={styles.correctedOffset}>
              {' '}({day.vis_corrected_offset >= 0 ? '+' : ''}{(Math.round(day.vis_corrected_offset * 10) / 10).toFixed(1)}m)
            </span>
          )}
          {' '}· {reportCount} community report{reportCount === 1 ? '' : 's'}
        </div>
      )}

      {/* Conditions — secondary metrics, collapsed on mobile */}
      <button
        className={styles.toggleConditions}
        onClick={() => setShowConditions(v => !v)}
        aria-expanded={showConditions}
        aria-label={showConditions ? 'Hide conditions' : 'Show conditions'}
      >
        Conditions
        <span className={styles.toggleArrow} aria-hidden="true">{showConditions ? ' ▲' : ' ▼'}</span>
      </button>

      {showConditions && (
        <div className={styles.metricsBar}>
          <div className={styles.metricChip} style={{ borderColor: tint(airSev.color) }}>
            <div className={styles.metricChipLabel}>Air Temp</div>
            <div className={styles.metricChipValue} style={{ color: airSev.color }}>{day.air_temp.toFixed(1)}°C</div>
            {airSev.note && <div className={styles.metricChipNote} style={{ color: airSev.color }}>{airSev.note}</div>}
          </div>
          {seaSev && day.sea_temp != null && (
            <div className={styles.metricChip} style={{ borderColor: tint(seaSev.color) }}>
              <div className={styles.metricChipLabel}>Sea Temp</div>
              <div className={styles.metricChipValue} style={{ color: seaSev.color }}>{day.sea_temp.toFixed(1)}°C</div>
              {seaSev.note && <div className={styles.metricChipNote} style={{ color: seaSev.color }}>{seaSev.note}</div>}
            </div>
          )}
          <div className={`${styles.metricChip} ${styles.metricChipNeutral}`}>
            <div className={styles.metricChipLabel}>Wave / Swell</div>
            <div className={styles.metricChipValue}>
              {Math.max(day.wave_height, day.swell_height).toFixed(1)}{units}
            </div>
            <div className={styles.metricChipNote}>
              {day.wave_height.toFixed(1)} / {day.swell_height.toFixed(1)}{units}
            </div>
          </div>
          {day.swell_dir_label != null && (
            <div className={`${styles.metricChip} ${styles.metricChipNeutral}`}>
              <div className={styles.metricChipLabel}>Swell Dir</div>
              <div className={styles.metricChipValue}>{day.swell_dir_label}</div>
              {day.swell_direction != null && <div className={styles.metricChipNote}>{Math.round(day.swell_direction)}°</div>}
            </div>
          )}
          <div className={`${styles.metricChip} ${styles.metricChipNeutral}`}>
            <div className={styles.metricChipLabel}>Wind</div>
            <div className={styles.metricChipValue}>{Math.round(day.wind_speed)}kn</div>
            {day.wind_dir_label && <div className={styles.metricChipNote}>{day.wind_dir_label}</div>}
          </div>
          <div className={`${styles.metricChip} ${styles.metricChipNeutral}`}>
            <div className={styles.metricChipLabel}>Rain</div>
            <div className={styles.metricChipValue}>{day.precipitation.toFixed(1)}</div>
            <div className={styles.metricChipNote}>mm/h</div>
          </div>
          <div className={styles.metricChip} style={{ borderColor: tint(humSev.color) }}>
            <div className={styles.metricChipLabel}>Humidity</div>
            <div className={styles.metricChipValue} style={{ color: humSev.color }}>{Math.round(day.humidity)}%</div>
            {humSev.note && <div className={styles.metricChipNote} style={{ color: humSev.color }}>{humSev.note}</div>}
          </div>
        </div>
      )}

      {/* Swell compass */}
      {day.swell_components && day.swell_components.length > 0 && (
        <div className={styles.compassContainer}>
          <SwellCompass
            components={day.swell_components}
            windDir={day.wind_dir}
            units={units}
          />
        </div>
      )}

      {/* Elevated warnings promoted to simple view */}
      {elevatedWarnings.length > 0 && (
        <div className={styles.warningBanner}>
          {elevatedWarnings.map((w, i) => (
            <div key={i} className={styles.warningItem}>{w}</div>
          ))}
        </div>
      )}

      {/* Shallow-water depth advisory */}
      {shallowWarning && (
        <div className={[
          styles.shallowNote,
          shallowWarning.severity === 'moderate' ? styles.shallowNoteMod : '',
          shallowWarning.severity === 'high' ? styles.shallowNoteHigh : '',
        ].filter(Boolean).join(' ')}>
          <div className={styles.shallowNoteLabel}>
            Shallow-water advisory · max {maxDiveDepth}m
          </div>
          <div className={[
            styles.shallowNoteText,
            shallowWarning.severity === 'moderate' ? styles.shallowNoteTextMod : '',
            shallowWarning.severity === 'high' ? styles.shallowNoteTextHigh : '',
          ].filter(Boolean).join(' ')}>
            {shallowNote}
          </div>
        </div>
      )}

      {/* Local-microenvironment caveat: clear offshore vs murky inside kelp.
          Collapsed by default — educational, not data-driven. */}
      <KelpVisibilityNote />

      {/* Algae bloom risk — always visible when present */}
      {(day.algae.risk !== 'low' || day.algae.drivers.length > 0) && (
        <div className={styles.algaeCard}>
          <div className={styles.algaeHeader}>
            <div className={styles.algaeLabel}>Algae Bloom Risk</div>
            <div className={`${styles.algaeRisk} ${styles[`algae${day.algae.risk.charAt(0).toUpperCase() + day.algae.risk.slice(1)}`]}`}>
              {day.algae.risk.toUpperCase()}
            </div>
          </div>
          {day.algae.drivers.length > 0 && (
            <div className={styles.algaeDrivers}>{day.algae.drivers.join(' · ')}</div>
          )}
          {day.water_quality?.erddap_chlorophyll != null && (() => {
            const chl = day.water_quality.erddap_chlorophyll
            // Thresholded badge so a diver can read the number without knowing
            // oceanography. Colours come from the --ds-q-* / semantic tokens.
            const badge = chl < 1
              ? { label: 'clear', color: 'var(--ds-q-excellent)' }
              : chl <= 5
                ? { label: 'elevated', color: 'var(--ds-warn)' }
                : { label: 'bloom', color: 'var(--ds-danger)' }
            // Surface it when the heuristic risk label and the measurement point
            // in opposite directions — the whole reason this card can mislead.
            const risk = day.algae.risk
            const contradiction =
              (risk === 'high' || risk === 'moderate') && chl < 1
                ? 'Satellite shows clear water'
                : risk === 'low' && chl > 5
                  ? 'Satellite shows active bloom — heuristic underestimates'
                  : risk === 'low' && chl >= 1
                    ? 'Satellite shows elevated chl-a'
                    : null
            return (
              <div className={styles.algaeMeasured}>
                <span className={styles.algaeMeasuredLabel}>Measured chl-a</span>
                <span className={styles.algaeMeasuredValue} style={{ color: badge.color }}>
                  {chl.toFixed(2)} mg/m³ · {badge.label}
                </span>
                {contradiction && (
                  <div className={styles.algaeContradiction}>{contradiction}</div>
                )}
              </div>
            )
          })()}
          {waterQuality && (
            <div className={styles.waterQualityNote} style={{ color: waterQuality.color }}>
              {waterQuality.description}
            </div>
          )}
        </div>
      )}

      {/* Toggle for advanced detail */}
      {advancedAvailable && (
        <button
          className={styles.toggleAdvanced}
          onClick={() => setShowAdvanced(v => !v)}
          aria-expanded={showAdvanced}
          aria-label={showAdvanced ? 'Hide detailed breakdown' : 'Show detailed breakdown'}
        >
          {showAdvanced ? 'Hide detailed forecast breakdown' : 'Show detailed forecast breakdown'}
          <span className={styles.toggleArrow} aria-hidden="true">{showAdvanced ? ' ▲' : ' ▼'}</span>
        </button>
      )}

      {/* Advanced sections — hidden by default */}
      {showAdvanced && (
        <>
          {/* Admin debug trace panel */}
          {isAdmin && (
            <div className={styles.debugPanel}>
              <div className={styles.debugPanelTitle}>
                <span className={styles.debugPanelTitleMain}>VIZ TRACE</span>
                <span className={styles.debugPanelTitleMeta}>ADMIN</span>
              </div>

              {/* Output summary */}
              <div className={styles.debugSection}>
                <div className={styles.debugSectionTitle}>OUTPUT</div>
                <div className={styles.debugRow}>
                  <span className={styles.debugLabel}>Model estimate (pre-bias)</span>
                  <span className={styles.debugValue}>{day.vis_estimate.toFixed(1)}m</span>
                </div>
                {globalBiasOffset !== null && (
                  <div className={styles.debugRow}>
                    <span className={styles.debugLabel}>Global bias offset</span>
                    <span className={styles.debugValue} style={{ color: globalBiasOffset < 0 ? 'var(--ds-danger)' : 'var(--ds-success)' }}>
                      {globalBiasOffset >= 0 ? '+' : ''}{globalBiasOffset.toFixed(2)}m
                    </span>
                  </div>
                )}
                {biasOffset !== null && (
                  <div className={styles.debugRow}>
                    <span className={styles.debugLabel}>Local bias ({reportCount} reports)</span>
                    <span className={styles.debugValue} style={{ color: biasOffset < 0 ? 'var(--ds-danger)' : 'var(--ds-success)' }}>
                      {biasOffset >= 0 ? '+' : ''}{biasOffset.toFixed(2)}m
                    </span>
                  </div>
                )}
                <div className={`${styles.debugRow} ${styles.debugRowTotal}`}>
                  <span className={styles.debugLabel}>Final displayed</span>
                  <span className={styles.debugValue}>{vis.toFixed(1)}m</span>
                </div>
              </div>

              {/* Penalty waterfall table */}
              <div className={styles.debugSection}>
                <div className={styles.debugSectionTitle}>PENALTY WATERFALL</div>
                <div className={styles.debugTableHeader}>
                  <span>Step</span>
                  <span>Detail</span>
                  <span>Δm</span>
                  <span>Running</span>
                </div>
                {buildTrace(day).map((row, i) => (
                  <div
                    key={i}
                    className={`${styles.debugTableRow} ${row.isSubtotal ? styles.debugTableRowTotal : ''}`}
                  >
                    <span className={styles.debugStep}>{row.label}</span>
                    <span className={styles.debugDetail}>{row.detail}</span>
                    <span
                      className={styles.debugDelta}
                      style={{
                        color: row.penalty < 0 ? 'var(--ds-danger)'
                          : row.isSubtotal ? 'var(--ds-text-faint)'
                          : row.penalty > 0 ? 'var(--ds-success)'
                          : 'var(--ds-text-faint)',
                      }}
                    >
                      {row.isSubtotal || row.penalty === 0 ? '—'
                        : row.penalty > 0 ? `+${row.penalty.toFixed(1)}m`
                        : `${row.penalty.toFixed(1)}m`}
                    </span>
                    <span className={styles.debugRunning}>{row.running.toFixed(1)}m</span>
                  </div>
                ))}
              </div>

              {/* KNN local bias correction */}
              {day.bias_attribution && day.bias_attribution.knn && day.bias_attribution.knn.logs_used > 0 && (
                <div className={styles.debugSection}>
                  <div className={styles.debugSectionTitle}>KNN BIAS CORRECTION</div>
                  <div className={styles.debugRow}>
                    <span className={styles.debugLabel}>KNN bias offset</span>
                    <span className={styles.debugValue} style={{ color: day.bias_attribution.knn.bias < 0 ? 'var(--ds-danger)' : 'var(--ds-success)' }}>
                      {day.bias_attribution.knn.bias >= 0 ? '+' : ''}{day.bias_attribution.knn.bias.toFixed(3)}m
                    </span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.debugLabel}>Confidence</span>
                    <span className={styles.debugValue} style={{
                      color: day.bias_attribution.knn.confidence === 'high' ? 'var(--ds-success)'
                        : day.bias_attribution.knn.confidence === 'medium' ? 'var(--ds-warn)'
                        : 'var(--ds-danger)'
                    }}>
                      {day.bias_attribution.knn.confidence.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.debugLabel}>Logs used / excluded / softened</span>
                    <span className={styles.debugValue}>
                      {day.bias_attribution.knn.logs_used} / {day.bias_attribution.knn.logs_excluded} / {day.bias_attribution.knn.outliers_softened}
                    </span>
                  </div>
                  {day.bias_attribution.knn.mean_distance != null && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>Mean distance (norm.)</span>
                      <span className={styles.debugValue}>{day.bias_attribution.knn.mean_distance.toFixed(4)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Similar past dives — historical evidence driving the local bias */}
              {day.bias_attribution && day.bias_attribution.similar_reports.length > 0 && (
                <div className={styles.debugSection}>
                  <div className={styles.debugSectionTitle}>SIMILAR PAST DIVES</div>
                  <div className={styles.debugRow} style={{ marginBottom: 6 }}>
                    <span className={styles.debugLabel} style={{ color: 'var(--ds-text-muted)', fontSize: 'var(--ds-text-label)' }}>
                      {day.bias_attribution.total_reports} logs at this spot · avg error on similar days
                    </span>
                    <span className={styles.debugValue} style={{ color: day.bias_attribution.mean_error < 0 ? 'var(--ds-danger)' : 'var(--ds-success)' }}>
                      {day.bias_attribution.mean_error > 0 ? '+' : ''}{day.bias_attribution.mean_error.toFixed(2)}m
                    </span>
                  </div>
                  <div className={styles.debugTableHeaderDives}>
                    <span>Date</span>
                    <span>Conditions</span>
                    <span>Actual</span>
                    <span>Model said</span>
                  </div>
                  {day.bias_attribution.similar_reports.map((r, i) => (
                    <div key={i} className={styles.debugTableRowDives}>
                      <span className={styles.debugStep} style={{ color: 'var(--ds-text-body)' }}>
                        {(() => { const [y,m,d] = r.date.split('-').map(Number); return new Date(y ?? 1970, (m??1)-1, d??1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) })()}
                      </span>
                      <span className={styles.debugDetail}>{r.conditions}</span>
                      <span className={styles.debugDelta} style={{ color: 'var(--ds-success)' }}>
                        {r.actual_vis.toFixed(1)}m
                      </span>
                      <span className={styles.debugRunningDives} style={{ color: r.error < 0 ? 'var(--ds-danger)' : r.error > 0 ? 'var(--ds-success)' : 'var(--ds-text-muted)' }}>
                        {r.model_predicted.toFixed(1)}m
                        <span style={{ fontSize: 'var(--ds-text-label)', marginLeft: 4, opacity: 0.7 }}>
                          ({r.error > 0 ? '+' : ''}{r.error.toFixed(1)})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Hard gate checks */}
              <div className={styles.debugSection}>
                <div className={styles.debugSectionTitle}>HARD GATE CHECKS</div>
                <div className={styles.debugRow}>
                  <span className={styles.debugLabel}>Wave &gt; 4m override</span>
                  <span className={styles.debugValue} style={{ color: waveGate ? 'var(--ds-danger)' : 'var(--ds-success)' }}>
                    {dominantWave.toFixed(2)}{units} ({dominantWaveM.toFixed(2)}m) — {waveGate ? 'TRIGGERED → 0m' : 'clear'}
                  </span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.debugLabel}>Wind &gt;35kn + wave &gt;2m</span>
                  <span className={styles.debugValue} style={{ color: windWaveGate ? 'var(--ds-danger)' : 'var(--ds-success)' }}>
                    {windKn.toFixed(0)}kn / {dominantWave.toFixed(2)}{units} ({dominantWaveM.toFixed(2)}m) — {windWaveGate ? 'TRIGGERED → 0m' : 'clear'}
                  </span>
                </div>
              </div>

              {/* BGC / satellite raw values */}
              {day.water_quality && (
                <div className={styles.debugSection}>
                  <div className={styles.debugSectionTitle}>BGC / SATELLITE</div>
                  {day.water_quality.bgc_kd != null && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>BGC Kd490</span>
                      <span className={styles.debugValue}>{day.water_quality.bgc_kd.toFixed(3)} m⁻¹</span>
                    </div>
                  )}
                  {day.water_quality.bgc_kd_vis != null && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>BGC Secchi (1.7 / Kd)</span>
                      <span className={styles.debugValue}>{day.water_quality.bgc_kd_vis.toFixed(1)}m</span>
                    </div>
                  )}
                  {day.water_quality.bgc_source && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>BGC source</span>
                      <span className={styles.debugValue}>{day.water_quality.bgc_source}</span>
                    </div>
                  )}
                  {day.water_quality.erddap_chlorophyll != null && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>Chlorophyll (ERDDAP)</span>
                      <span className={styles.debugValue}>{day.water_quality.erddap_chlorophyll.toFixed(2)} mg/m³</span>
                    </div>
                  )}
                  {day.water_quality.erddap_kd490 != null && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>Kd490 (ERDDAP)</span>
                      <span className={styles.debugValue}>{day.water_quality.erddap_kd490.toFixed(3)} m⁻¹</span>
                    </div>
                  )}
                  {day.water_quality.erddap_obs_date && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>Satellite obs date</span>
                      <span className={styles.debugValue}>{day.water_quality.erddap_obs_date}</span>
                    </div>
                  )}
                  {day.nutrient_factor != null && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>Nutrient factor (0–1)</span>
                      <span className={styles.debugValue}>{day.nutrient_factor.toFixed(3)}</span>
                    </div>
                  )}
                  {day.turbidity_penalty != null && (
                    <div className={styles.debugRow}>
                      <span className={styles.debugLabel}>Turbidity penalty</span>
                      <span className={styles.debugValue} style={{ color: day.turbidity_penalty > 0 ? 'var(--ds-danger)' : 'var(--ds-success)' }}>
                        −{day.turbidity_penalty.toFixed(2)}m
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Satellite imagery — true-colour + chlorophyll for this spot/day */}
          {hasCoords && (
            <SatelliteImageryCard lat={lat!} lon={lon!} date={day.date} />
          )}

          {/* Water quality indicator */}
          {waterQuality && (
            <div className={styles.waterQualityCard}>
              <div className={styles.waterQualityHeader}>
                <div className={styles.waterQualityLabelText}>Water Quality</div>
                <div className={styles.waterQualityBadge} style={{ color: waterQuality.color }}>
                  {waterQuality.label.toUpperCase()}
                </div>
              </div>
              <div className={styles.waterQualityBar}>
                <div
                  className={styles.waterQualityFill}
                  style={{
                    width: `${Math.round(day.nutrient_factor! * 100)}%`,
                    background: waterQuality.color,
                  }}
                />
              </div>
              <div className={styles.waterQualitySub}>
                Based on satellite chlorophyll-a · affects algae bloom penalty
              </div>
            </div>
          )}

          {/* Turbidity (SPM) card */}
          {turbidity && (
            <div className={styles.waterQualityCard}>
              <div className={styles.waterQualityHeader}>
                <div className={styles.waterQualityLabelText}>Turbidity</div>
                <div className={styles.waterQualityBadge} style={{ color: turbidity.color }}>
                  {turbidity.label.toUpperCase()}
                </div>
              </div>
              <div className={styles.waterQualityBar}>
                <div
                  className={styles.waterQualityFill}
                  style={{
                    width: `${Math.min(100, Math.round((day.turbidity_penalty! / 5.0) * 100))}%`,
                    background: turbidity.color,
                  }}
                />
              </div>
              <div className={styles.waterQualityMeta}>
                <span style={{ color: turbidity.color }}>{turbidity.spm} suspended matter</span>
                <span className={styles.waterQualityPenalty}>−{day.turbidity_penalty!.toFixed(1)}m viz</span>
              </div>
              <div className={styles.waterQualitySub}>
                {turbidity.description} · Based on satellite SPM
              </div>
            </div>
          )}

          {/* Seabed Resuspension card */}
          {day.resuspension && day.resuspension.risk_level !== 'none' && (
            <div className={styles.waterQualityCard}>
              <div className={styles.waterQualityHeader}>
                <div className={styles.waterQualityLabelText}>Seabed Resuspension</div>
                <div className={styles.waterQualityBadge} style={{ color: riskToken(day.resuspension.risk_level) }}>
                  {day.resuspension.risk_level.toUpperCase()}
                </div>
              </div>
              <div className={styles.waterQualityBar}>
                <div
                  className={styles.waterQualityFill}
                  style={{
                    width: `${Math.min(100, Math.round((day.resuspension.penalty / 5.0) * 100))}%`,
                    background: riskToken(day.resuspension.risk_level),
                  }}
                />
              </div>
              <div className={styles.riskStats}>
                {day.resuspension.depth_m != null && (
                  <span>Depth: {day.resuspension.depth_m.toFixed(1)}m</span>
                )}
                {day.resuspension.seabed_class && (
                  <span>Seabed: {day.resuspension.seabed_class}</span>
                )}
                {day.resuspension.bottom_orbital_velocity != null && (
                  <span>Orbital vel: {day.resuspension.bottom_orbital_velocity.toFixed(2)} m/s</span>
                )}
                {day.resuspension.bed_shear_stress != null && (
                  <span>Shear: {day.resuspension.bed_shear_stress.toFixed(3)} Pa</span>
                )}
                {day.resuspension.recovery_state > 0.05 && (
                  <span>Recovery: {Math.round(day.resuspension.recovery_state * 100)}%</span>
                )}
              </div>
              <div className={styles.waterQualityMeta}>
                <span style={{ color: riskToken(day.resuspension.risk_level) }}>
                  {day.resuspension.risk_level} risk
                </span>
                {day.resuspension.penalty > 0 && (
                  <span className={styles.waterQualityPenalty}>−{day.resuspension.penalty.toFixed(1)}m viz</span>
                )}
              </div>
              {day.resuspension.note && (
                <div className={styles.waterQualitySub}>{day.resuspension.note}</div>
              )}
            </div>
          )}

          {/* River Discharge card */}
          {day.river_discharge && day.river_discharge.risk_level !== 'none' && (
            <div className={styles.waterQualityCard}>
              <div className={styles.waterQualityHeader}>
                <div className={styles.waterQualityLabelText}>River Discharge</div>
                <div className={styles.waterQualityBadge} style={{ color: riskToken(day.river_discharge.risk_level) }}>
                  {day.river_discharge.risk_level.toUpperCase()}
                </div>
              </div>
              <div className={styles.waterQualityBar}>
                <div
                  className={styles.waterQualityFill}
                  style={{
                    width: `${Math.min(100, Math.round((day.river_discharge.penalty / 3.0) * 100))}%`,
                    background: riskToken(day.river_discharge.risk_level),
                  }}
                />
              </div>
              <div className={styles.riskStats}>
                {day.river_discharge.discharge_m3s != null && (
                  <span>Current: {day.river_discharge.discharge_m3s.toFixed(1)} m³/s</span>
                )}
                {day.river_discharge.discharge_mean != null && (
                  <span>Mean: {day.river_discharge.discharge_mean.toFixed(1)} m³/s</span>
                )}
                {day.river_discharge.discharge_ratio != null && (
                  <span>Ratio: {day.river_discharge.discharge_ratio.toFixed(2)}×</span>
                )}
                {day.river_discharge.distance_km != null && (
                  <span>Distance: {day.river_discharge.distance_km.toFixed(1)} km</span>
                )}
              </div>
              <div className={styles.waterQualityMeta}>
                <span style={{ color: riskToken(day.river_discharge.risk_level) }}>
                  {day.river_discharge.risk_level} risk
                </span>
                {day.river_discharge.penalty > 0 && (
                  <span className={styles.waterQualityPenalty}>−{day.river_discharge.penalty.toFixed(1)}m viz</span>
                )}
              </div>
              {day.river_discharge.note && (
                <div className={styles.waterQualitySub}>{day.river_discharge.note}</div>
              )}
            </div>
          )}

          {/* Water Clarity Data — BGC forecast + ERDDAP satellite (both per-day) */}
          {day.water_quality && (day.water_quality.bgc_kd != null || day.water_quality.erddap_chlorophyll != null) && (
            <div className={styles.waterQualityCard}>
              <div className={styles.waterQualityHeader}>
                <div className={styles.waterQualityLabelText}>Water Clarity Data</div>
                {day.water_quality.bgc_source && (
                  <div
                    className={styles.waterQualityBadge}
                    style={{ color: day.water_quality.bgc_source.toUpperCase() === 'FALLBACK' ? 'var(--ds-warn)' : 'var(--ds-info)' }}
                  >
                    {day.water_quality.bgc_source.toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.clarityGrid}>
                {day.water_quality.bgc_kd != null && (
                  <div className={styles.clarityStat}>
                    <div className={styles.clarityLabel}>BGC Kd</div>
                    <div className={styles.clarityValue}>{day.water_quality.bgc_kd.toFixed(3)} m⁻¹</div>
                  </div>
                )}
                {day.water_quality.bgc_kd_vis != null && (
                  <div className={styles.clarityStat}>
                    <div className={styles.clarityLabel}>BGC Visibility</div>
                    <div className={styles.clarityValue}>{day.water_quality.bgc_kd_vis.toFixed(1)}m</div>
                  </div>
                )}
                {/* Measured chlorophyll-a now lives in the Algae Bloom Risk card
                    (with a threshold badge + contradiction note); not duplicated
                    here. It remains in the debug section above for diagnostics. */}
                {day.water_quality.erddap_kd490 != null && (
                  <div className={styles.clarityStat}>
                    <div className={styles.clarityLabel}>Kd490</div>
                    <div className={styles.clarityValue}>{day.water_quality.erddap_kd490.toFixed(3)} m⁻¹</div>
                  </div>
                )}
                {day.water_quality.erddap_kd490_vis != null && (
                  <div className={styles.clarityStat}>
                    <div className={styles.clarityLabel}>ERDDAP Visibility</div>
                    <div className={styles.clarityValue}>{day.water_quality.erddap_kd490_vis.toFixed(1)}m</div>
                  </div>
                )}
              </div>
              {day.water_quality.erddap_obs_date && (
                <div className={styles.waterQualitySub}>
                  Satellite observation: {day.water_quality.erddap_obs_date}
                </div>
              )}
              {day.water_quality.bgc_source?.toUpperCase() === 'FALLBACK' && (
                <div className={styles.waterQualitySub}>
                  No recent satellite or float data available — values estimated from regional baseline.
                </div>
              )}
            </div>
          )}

          {/* Factor grid */}
          {day.factors.some(f => f.max_penalty > 0) && (
            <div className={styles.grid}>
              {day.factors.filter(f => f.max_penalty > 0).map(f => {
                const { label, color } = getImpact(f.penalty, f.max_penalty)
                const barPct = Math.min(100, (Math.abs(f.penalty) / f.max_penalty) * 100)
                const ratio = Math.abs(f.penalty) / f.max_penalty
                const barColor = impactToken(ratio)
                return (
                  <div key={f.name} className={styles.factorCard}>
                    <div className={styles.factorName}>{f.name}</div>
                    <div className={styles.factorValue}>{f.value}</div>
                    {f.note && <div className={styles.factorNote}>{f.note}</div>}
                    <div className={styles.factorImpact} style={{ color }}>{label}</div>
                    <div className={styles.factorBar} style={{ width: `${barPct}%`, background: barColor }} />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
