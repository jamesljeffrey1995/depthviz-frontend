import { useState } from 'react'
import type { DayForecast } from '../types'
import { getImpact } from '../lib/visibility'
import { SwellCompass } from './SwellCompass'
import styles from './DayDetail.module.css'

interface Props {
  day: DayForecast
  locationName: string
  reportCount: number
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

function getAirTempSeverity(temp: number): { color: string; note: string | null } {
  if (temp < 4)  return { color: '#c0392b', note: 'fog risk' }
  if (temp < 10) return { color: '#d4850a', note: null }
  return { color: '#1a8a5a', note: null }
}

function getSeaTempSeverity(temp: number): { color: string; note: string | null } {
  if (temp > 20) return { color: '#c0392b', note: 'bloom risk' }
  if (temp > 15) return { color: '#d4850a', note: 'algae risk' }
  return { color: '#1a8a5a', note: null }
}

function getHumiditySeverity(humidity: number): { color: string; note: string | null } {
  if (humidity > 94) return { color: '#c0392b', note: null }
  if (humidity > 88) return { color: '#d4850a', note: null }
  return { color: '#1a8a5a', note: null }
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
  return [...new Set(warnings)]
}

export function DayDetail({ day, locationName, reportCount }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const vis = day.vis_corrected ?? day.vis_estimate
  const pct = (vis / 15) * 100

  const waterQuality = day.nutrient_factor != null ? getWaterQuality(day.nutrient_factor) : null
  const turbidity = day.turbidity_penalty != null && day.turbidity_penalty > 0
    ? getTurbidity(day.turbidity_penalty)
    : null

  const airSev  = getAirTempSeverity(day.air_temp)
  const seaSev  = day.sea_temp != null ? getSeaTempSeverity(day.sea_temp) : null
  const humSev  = getHumiditySeverity(day.humidity)

  const elevatedWarnings = getElevatedWarnings(day)
  const advancedAvailable = hasAdvancedData(day)

  return (
    <div className={styles.card} data-location={locationName} data-report-count={reportCount}>
      {/* Safety-relevant caveats — promoted directly under the verdict, ahead
          of any chart or collapsible section, per Constitution §1: warnings
          are never hidden behind disclosure or buried below the fold. These
          were previously rendered after the (mobile-collapsed) Conditions
          panel and the trend charts; moved here so a diver sees them before
          any scrolling, not one tap or one scroll down. */}
      {elevatedWarnings.length > 0 && (
        <div className={styles.warningBanner}>
          {elevatedWarnings.map((w) => (
            <div key={w} className={styles.warningItem}>{w}</div>
          ))}
        </div>
      )}

      {/* Metrics top bar */}
      <div className={styles.metricsBar}>
        <div className={styles.metricChip} style={{ borderColor: `${airSev.color}40` }}>
          <div className={styles.metricChipLabel}>Air Temp</div>
          <div className={styles.metricChipValue} style={{ color: airSev.color }}>{day.air_temp.toFixed(1)}°C</div>
          {airSev.note && <div className={styles.metricChipNote} style={{ color: airSev.color }}>{airSev.note}</div>}
        </div>
        {seaSev && day.sea_temp != null && (
          <div className={styles.metricChip} style={{ borderColor: `${seaSev.color}40` }}>
            <div className={styles.metricChipLabel}>Sea Temp</div>
            <div className={styles.metricChipValue} style={{ color: seaSev.color }}>{day.sea_temp.toFixed(1)}°C</div>
            {seaSev.note && <div className={styles.metricChipNote} style={{ color: seaSev.color }}>{seaSev.note}</div>}
          </div>
        )}
        <div className={styles.metricChip} style={{ borderColor: `${humSev.color}40` }}>
          <div className={styles.metricChipLabel}>Humidity</div>
          <div className={styles.metricChipValue} style={{ color: humSev.color }}>{Math.round(day.humidity)}%</div>
          {humSev.note && <div className={styles.metricChipNote} style={{ color: humSev.color }}>{humSev.note}</div>}
        </div>
        {day.swell_dir_label != null && (
          <div className={styles.metricChip} style={{ borderColor: '#00c9ff40' }}>
            <div className={styles.metricChipLabel}>Swell Dir</div>
            <div className={styles.metricChipValue} style={{ color: '#00c9ff' }}>{day.swell_dir_label}</div>
            {day.swell_direction != null && <div className={styles.metricChipNote} style={{ color: '#00c9ff' }}>{Math.round(day.swell_direction)}°</div>}
          </div>
        )}
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

      {/* Swell compass */}
      {day.swell_components && day.swell_components.length > 0 && (
        <div className={styles.compassContainer}>
          <SwellCompass
            components={day.swell_components}
            windDir={day.wind_dir}
          />
        </div>
      )}

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
          {showAdvanced ? 'Hide details' : 'Show detailed breakdown'}
          <span className={styles.toggleArrow} aria-hidden="true">{showAdvanced ? ' ▲' : ' ▼'}</span>
        </button>
      )}

      {/* Advanced sections — hidden by default */}
      {showAdvanced && (
        <>
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
                {day.river_discharge.distance_km != null && (
                  <span>Distance: {day.river_discharge.distance_km.toFixed(1)} km</span>
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

          {/* Water Clarity Data — BGC forecast + ERDDAP satellite (both per-day) */}
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
          {day.factors.some(f => f.max_penalty > 0) && (
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
          )}
        </>
      )}
    </div>
  )
}
