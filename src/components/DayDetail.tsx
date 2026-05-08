import { useState } from 'react'
import type { DayForecast } from '../types'
import { getImpact } from '../lib/visibility'
import styles from './DayDetail.module.css'

interface Props {
  day: DayForecast
  locationName: string
  reportCount: number
  isAdmin?: boolean
  biasOffset?: number | null
}

function getWaterQuality(factor: number): { label: string; color: string; description: string } {
  if (factor < 0.3)  return { label: 'Nutrient-poor',      color: '#1a8a5a', description: 'Oligotrophic — algae blooms rare' }
  if (factor < 0.6)  return { label: 'Moderate nutrients', color: '#d4850a', description: 'Some bloom potential in warm conditions' }
  if (factor < 0.8)  return { label: 'Nutrient-rich',      color: '#e06c00', description: 'Eutrophic — elevated bloom risk when warm' }
  return               { label: 'Highly eutrophic',         color: '#c0392b', description: 'High nutrient load — bloom penalty fully applied' }
}

function getTurbidity(penalty: number): { label: string; color: string; spm: string; description: string } {
  if (penalty < 0.3)  return { label: 'Clear',        color: '#1a8a5a', spm: '< 2 mg/l',   description: 'Low sediment — minimal impact on visibility' }
  if (penalty < 1.0)  return { label: 'Slight haze',  color: '#d4850a', spm: '2–5 mg/l',   description: 'Some particulates — slight reduction in viz' }
  if (penalty < 2.0)  return { label: 'Turbid',       color: '#e06c00', spm: '5–15 mg/l',  description: 'Elevated sediment — noticeable viz reduction' }
  if (penalty < 3.5)  return { label: 'Very turbid',  color: '#c0392b', spm: '15–50 mg/l', description: 'High sediment load — likely post-swell resuspension' }
  return               { label: 'Extreme turbidity',   color: '#8b0000', spm: '> 50 mg/l',  description: 'Storm/estuary levels — severe viz impact' }
}

function getRiskColor(level: string): string {
  switch (level) {
    case 'none': return '#1a8a5a'
    case 'low':  return '#d4850a'
    case 'moderate': return '#e06c00'
    case 'high': return '#c0392b'
    default: return '#1a8a5a'
  }
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
  const satelliteTotal = turbPen + resusPen + riverPen

  // Reverse-engineer the implied base (approximate — excludes CDM, BGC soft-pull, smoothing)
  const impliedBase = day.vis_estimate - factorPenaltyTotal + satelliteTotal
  const clampedBase = Math.max(0, Math.min(15, impliedBase))

  const rows: TraceRow[] = []
  let running = clampedBase

  rows.push({ label: 'Base', detail: '~approx, excl. CDM/BGC/smoothing', penalty: clampedBase, running })

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

export function DayDetail({ day, locationName, reportCount, isAdmin = false, biasOffset = null }: Props) {
  const vis = day.vis_corrected ?? day.vis_estimate
  const pct = (vis / 15) * 100
  const dateLabel = new Date(day.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const [debugOpen, setDebugOpen] = useState(true)

  const waterQuality = day.nutrient_factor != null ? getWaterQuality(day.nutrient_factor) : null
  const turbidity = day.turbidity_penalty != null && day.turbidity_penalty > 0
    ? getTurbidity(day.turbidity_penalty)
    : null

  const dominantWave = Math.max(day.wave_height ?? 0, day.swell_height ?? 0)
  const windKn = day.wind_speed ?? 0
  const waveGate = dominantWave > 4
  const windWaveGate = windKn > 35 && dominantWave > 2

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.dateBlock}>
          <div className={styles.dateLine}>{locationName}</div>
          <div className={styles.dateLine}>{dateLabel}</div>
          {day.is_forecast && <div className={styles.forecastBadge}>Forecast</div>}
        </div>
        <div className={styles.visBlock}>
          <div className={`${styles.visNumber} ${styles[day.color_class]}`}>{vis.toFixed(1)}</div>
          <div className={styles.visUnit}>metres</div>
          {day.vis_corrected !== null && (
            <div className={styles.correctedNote}>AI-corrected ({reportCount} reports)</div>
          )}
        </div>
      </div>

      <div className={`${styles.verdict} ${styles[day.color_class]}`}>{day.verdict}</div>

      <div className={styles.barContainer}>
        <div className={styles.barLabels}>
          <span>0m</span><span>5m</span><span>10m</span><span>15m</span>
        </div>
        <div className={styles.barTrack}>
          <div className={`${styles.barFill} ${styles[`bg_${day.color_class}`]}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Admin debug trace panel */}
      {isAdmin && (
        <div className={styles.debugPanel}>
          <button className={styles.debugToggle} onClick={() => setDebugOpen(o => !o)}>
            VIZ TRACE — ADMIN {debugOpen ? '▲' : '▼'}
          </button>

          {debugOpen && (
            <>
              {/* Summary: estimate vs corrected */}
              <div className={styles.debugSection}>
                <div className={styles.debugSectionTitle}>OUTPUT</div>
                <div className={styles.debugRow}>
                  <span className={styles.debugLabel}>Model estimate (pre-bias)</span>
                  <span className={styles.debugValue}>{day.vis_estimate.toFixed(1)}m</span>
                </div>
                {biasOffset !== null && (
                  <div className={styles.debugRow}>
                    <span className={styles.debugLabel}>Bias offset ({reportCount} reports)</span>
                    <span className={styles.debugValue} style={{ color: biasOffset < 0 ? '#e05555' : '#4ecb8d' }}>
                      {biasOffset >= 0 ? '+' : ''}{biasOffset.toFixed(2)}m
                    </span>
                  </div>
                )}
                <div className={`${styles.debugRow} ${styles.debugRowTotal}`}>
                  <span className={styles.debugLabel}>Final displayed</span>
                  <span className={styles.debugValue}>{vis.toFixed(1)}m</span>
                </div>
              </div>

              {/* Step-by-step waterfall */}
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
                        color: row.penalty < 0 ? '#e05555'
                          : row.isSubtotal ? 'var(--text)'
                          : row.penalty > 0 ? '#4ecb8d'
                          : 'rgba(255,255,255,0.25)',
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

              {/* Hard gate checks */}
              <div className={styles.debugSection}>
                <div className={styles.debugSectionTitle}>HARD GATE CHECKS</div>
                <div className={styles.debugRow}>
                  <span className={styles.debugLabel}>Wave &gt; 4m override</span>
                  <span className={styles.debugValue} style={{ color: waveGate ? '#e05555' : '#4ecb8d' }}>
                    {dominantWave.toFixed(2)}m — {waveGate ? 'TRIGGERED → 0m' : 'clear'}
                  </span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.debugLabel}>Wind &gt;35kn + wave &gt;2m</span>
                  <span className={styles.debugValue} style={{ color: windWaveGate ? '#e05555' : '#4ecb8d' }}>
                    {windKn.toFixed(0)}kn / {dominantWave.toFixed(2)}m — {windWaveGate ? 'TRIGGERED → 0m' : 'clear'}
                  </span>
                </div>
              </div>

              {/* BGC / satellite raw data */}
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
                      <span className={styles.debugValue} style={{ color: day.turbidity_penalty > 0 ? '#e05555' : '#4ecb8d' }}>
                        −{day.turbidity_penalty.toFixed(2)}m
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Temperatures */}
      <div className={styles.tempsRow}>
        <div className={styles.tempCard}>
          <div className={styles.tempLabel}>Air Temp</div>
          <div className={styles.tempValue}>{day.air_temp.toFixed(1)}°C</div>
        </div>
        <div className={styles.tempCard}>
          <div className={styles.tempLabel}>Sea Temp</div>
          <div className={styles.tempValue}>{day.sea_temp !== null ? `${day.sea_temp.toFixed(1)}°C` : 'N/A'}</div>
        </div>
        <div className={styles.tempCard}>
          <div className={styles.tempLabel}>Humidity</div>
          <div className={styles.tempValue}>{Math.round(day.humidity)}%</div>
        </div>
      </div>

      {/* Algae bloom risk */}
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
          {waterQuality && (
            <div className={styles.waterQualityNote} style={{ color: waterQuality.color }}>
              {waterQuality.description}
            </div>
          )}
        </div>
      )}

      {/* Water quality indicator (Option B) */}
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
            <div className={styles.waterQualityBadge} style={{ color: getRiskColor(day.resuspension.risk_level) }}>
              {day.resuspension.risk_level.toUpperCase()}
            </div>
          </div>
          <div className={styles.waterQualityBar}>
            <div
              className={styles.waterQualityFill}
              style={{
                width: `${Math.min(100, Math.round((day.resuspension.penalty / 5.0) * 100))}%`,
                background: getRiskColor(day.resuspension.risk_level),
              }}
            />
          </div>
          <div className={styles.riskStats}>
            {day.resuspension.depth_m != null && (
              <span>Depth: {day.resuspension.depth_m.toFixed(1)}m</span>
            )}
            {day.resuspension.bottom_orbital_velocity != null && (
              <span>Orbital vel: {day.resuspension.bottom_orbital_velocity.toFixed(2)} m/s</span>
            )}
            {day.resuspension.bed_shear_stress != null && (
              <span>Shear: {day.resuspension.bed_shear_stress.toFixed(3)} Pa</span>
            )}
          </div>
          <div className={styles.waterQualityMeta}>
            <span style={{ color: getRiskColor(day.resuspension.risk_level) }}>
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
            <div className={styles.waterQualityBadge} style={{ color: getRiskColor(day.river_discharge.risk_level) }}>
              {day.river_discharge.risk_level.toUpperCase()}
            </div>
          </div>
          <div className={styles.waterQualityBar}>
            <div
              className={styles.waterQualityFill}
              style={{
                width: `${Math.min(100, Math.round((day.river_discharge.penalty / 3.0) * 100))}%`,
                background: getRiskColor(day.river_discharge.risk_level),
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
          </div>
          <div className={styles.waterQualityMeta}>
            <span style={{ color: getRiskColor(day.river_discharge.risk_level) }}>
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

      {/* Enhanced Water Quality — BGC & ERDDAP data */}
      {day.water_quality && (day.water_quality.bgc_kd != null || day.water_quality.erddap_chlorophyll != null) && (
        <div className={styles.waterQualityCard}>
          <div className={styles.waterQualityHeader}>
            <div className={styles.waterQualityLabelText}>Water Clarity Data</div>
            {day.water_quality.bgc_source && (
              <div
                className={styles.waterQualityBadge}
                style={{ color: day.water_quality.bgc_source.toUpperCase() === 'FALLBACK' ? '#d4850a' : '#00c9ff' }}
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
            {day.water_quality.erddap_chlorophyll != null && (
              <div className={styles.clarityStat}>
                <div className={styles.clarityLabel}>Chlorophyll</div>
                <div className={styles.clarityValue}>{day.water_quality.erddap_chlorophyll.toFixed(2)} mg/m³</div>
              </div>
            )}
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
      <div className={styles.grid}>
        {day.factors.filter(f => f.max_penalty > 0).map(f => {
          const { label, color } = getImpact(f.penalty, f.max_penalty)
          const barPct = Math.min(100, (Math.abs(f.penalty) / f.max_penalty) * 100)
          const ratio = Math.abs(f.penalty) / f.max_penalty
          const barColor = ratio === 0 ? '#1a6b4a' : ratio < 0.4 ? '#d4850a' : ratio < 0.75 ? '#e06c00' : '#c0392b'
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
    </div>
  )
}
