import type {
  ConditionsData,
  VisibilityFactor,
  VisibilityResult,
  Verdict,
  ColorClass,
  VerdictLabel,
  ImpactLevel,
} from '../types'

// ── Decay weights by days ago (index 0 = today) ──
const SWELL_DECAY = [1.0, 0.7, 0.5, 0.35, 0.2, 0.1, 0.05]
const RAIN_DECAY  = [1.0, 0.6, 0.3, 0.15, 0.05, 0.02, 0.01]
const WIND_DECAY  = [1.0, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01]

function getDailyMaxes(timestamps: string[], values: number[]): number[] {
  const byDay: Record<string, number> = {}
  timestamps.forEach((ts, i) => {
    const day = ts.split('T')[0]
    byDay[day] = Math.max(byDay[day] ?? 0, values[i] ?? 0)
  })
  return Object.keys(byDay)
    .sort()
    .reverse()
    .map(d => byDay[d])
}

function decayScore(dailyMaxes: number[], weights: number[]): number {
  let weightedSum = 0
  let totalWeight = 0
  weights.forEach((w, i) => {
    if (i < dailyMaxes.length) {
      weightedSum += (dailyMaxes[i] ?? 0) * w
      totalWeight += w
    }
  })
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

export function degToCompass(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

export function getImpact(penalty: number, maxPenalty: number): { label: ImpactLevel; color: string } {
  if (maxPenalty === 0 || penalty === 0) return { label: 'NO IMPACT', color: '#1a8a5a' }
  const ratio = Math.abs(penalty) / maxPenalty
  if (ratio < 0.3)   return { label: 'LOW IMPACT',  color: '#d4850a' }
  if (ratio < 0.6)   return { label: 'MODERATE',    color: '#e06c00' }
  if (ratio < 0.85)  return { label: 'HIGH IMPACT', color: '#c0392b' }
  return               { label: 'SEVERE',            color: '#c0392b' }
}

export function getVerdict(vis: number): Verdict {
  const map: Array<[number, VerdictLabel, ColorClass, string | null]> = [
    [0,  'STAY ASHORE', 'blocked',  '⚠ Sea state makes this dive unsafe. Do not enter the water.'],
    [1,  'POOR',        'poor',     null],
    [3,  'LIMITED',     'poor',     null],
    [5,  'MARGINAL',    'marginal', null],
    [8,  'DECENT',      'decent',   null],
    [12, 'GOOD',        'good',     null],
  ]
  for (const [threshold, label, colorClass, alert] of map) {
    if (vis <= threshold) return { label, colorClass, alert }
  }
  return { label: 'EXCELLENT', colorClass: 'excellent', alert: null }
}

export interface CalibrationWeights {
  swell_multiplier: number
  wind_multiplier: number
  rain_multiplier: number
}

/** Piecewise-linear interpolation between breakpoints — matches API swell_penalty(). */
function interpolatePenalty(value: number, breakpoints: [number, number][]): number {
  if (value <= breakpoints[0][0]) return breakpoints[0][1]
  for (let i = 1; i < breakpoints.length; i++) {
    const [loV, loP] = breakpoints[i - 1]
    const [hiV, hiP] = breakpoints[i]
    if (value <= hiV) {
      const t = (value - loV) / (hiV - loV)
      return loP + t * (hiP - loP)
    }
  }
  return breakpoints[breakpoints.length - 1][1]
}

// Breakpoints aligned with API services/visibility.py
const SWELL_BREAKPOINTS: [number, number][] = [
  [0.0, 0.0], [0.5, -0.5], [1.0, -1.5], [1.5, -2.5], [2.5, -4.5], [3.5, -6.5], [5.0, -8.0],
]
const WIND_BREAKPOINTS: [number, number][] = [
  [0, 0], [10, 0], [15, -0.5], [20, -1.5], [28, -2.5], [36, -4.0],
]
const RAIN_BREAKPOINTS: [number, number][] = [
  [0, 0], [0.2, 0], [1, -0.5], [3, -1.5], [8, -3.0],
]

export function calculateVisibility(
  { weather, marine, histWeather, histMarine }: ConditionsData,
  lat: number,
  weights?: CalibrationWeights,
): VisibilityResult {
  const c = weather.current
  const mc = marine.current ?? { wave_height: 0, wave_period: 0, swell_wave_height: 0 }

  const windKnots    = c.wind_speed_10m ?? 0
  const precipitation = c.precipitation ?? 0
  const humidity     = c.relative_humidity_2m ?? 70
  const waveHeight   = mc.wave_height ?? 0
  const swellHeight  = mc.swell_wave_height ?? 0
  const windDir      = c.wind_direction_10m ?? 0

  // ── Build historical daily maxes ──
  let histWaveMaxes: number[] = []
  let histRainMaxes: number[] = []
  let histWindMaxes: number[] = []

  if (histMarine?.hourly) {
    const domWaves = histMarine.hourly.wave_height.map((v: number, i: number) =>
      Math.max(v ?? 0, histMarine.hourly!.swell_wave_height[i] ?? 0)
    )
    histWaveMaxes = getDailyMaxes(histMarine.hourly.time, domWaves)
  }
  if (histWeather?.hourly) {
    histRainMaxes = getDailyMaxes(histWeather.hourly.time, histWeather.hourly.precipitation)
    histWindMaxes = getDailyMaxes(histWeather.hourly.time, histWeather.hourly.wind_speed_10m)
  }

  const historicalSwell = decayScore(histWaveMaxes, SWELL_DECAY)
  const historicalRain  = decayScore(histRainMaxes, RAIN_DECAY)
  const historicalWind  = decayScore(histWindMaxes, WIND_DECAY)

  // Effective = worse of current or weighted historical
  const rawSwell       = Math.max(waveHeight, swellHeight)
  const effectiveSwell = Math.max(rawSwell, historicalSwell * 0.6)
  const effectiveRain  = Math.max(precipitation, historicalRain * 0.5)
  const effectiveWind  = Math.max(windKnots, historicalWind * 0.4)

  // North Sea pessimistic baseline
  const isNorthSea = lat > 50 && lat < 62
  const baseVis = isNorthSea ? 8 : 11

  const factors: VisibilityFactor[] = []

  // Apply ML calibration multipliers if available
  const sm = weights?.swell_multiplier ?? 1.0
  const wm = weights?.wind_multiplier ?? 1.0
  const rm = weights?.rain_multiplier ?? 1.0

  // 1. Swell — piecewise-linear interpolation (matches API)
  const wavePenalty = interpolatePenalty(effectiveSwell, SWELL_BREAKPOINTS)
  factors.push({
    name: 'Swell / Wave',
    value: `${rawSwell.toFixed(1)}m`,
    note: histWaveMaxes[1] > rawSwell * 1.3 ? '↑ recent history' : null,
    penalty: wavePenalty * sm,
    max_penalty: 8,
  })

  // 2. Wind speed — piecewise-linear interpolation
  const windPenalty = interpolatePenalty(effectiveWind, WIND_BREAKPOINTS)
  factors.push({
    name: 'Wind',
    value: `${Math.round(windKnots)}kn`,
    penalty: windPenalty * wm,
    max_penalty: 4,
  })

  // 3. Wind direction
  const isOnshore = windDir >= 180 && windDir <= 320
  const dirPenalty = isOnshore ? -1 : 0
  factors.push({
    name: 'Wind Dir',
    value: degToCompass(windDir),
    note: isOnshore ? 'onshore' : 'offshore',
    penalty: dirPenalty,
    max_penalty: 1.5,
  })

  // 4. Precipitation — piecewise-linear interpolation
  const rainPenalty = interpolatePenalty(effectiveRain, RAIN_BREAKPOINTS)
  factors.push({
    name: 'Precip',
    value: `${precipitation.toFixed(1)}mm/h`,
    note: historicalRain > precipitation * 1.5 && historicalRain > 1 ? '↑ recent rain' : null,
    penalty: rainPenalty * rm,
    max_penalty: 3,
  })

  // 5. Humidity
  let humidPenalty = 0
  if (humidity > 88) humidPenalty = -0.5
  if (humidity > 94) humidPenalty = -1
  factors.push({
    name: 'Humidity',
    value: `${Math.round(humidity)}%`,
    penalty: humidPenalty,
    max_penalty: 1,
  })

  const totalPenalty = (wavePenalty * sm) + (windPenalty * wm) + dirPenalty + (rainPenalty * rm) + humidPenalty
  let vis = Math.max(0, Math.min(15, baseVis + totalPenalty))
  if (effectiveSwell > 4 || (windKnots > 35 && effectiveSwell > 2)) vis = 0

  return {
    vis: Math.round(vis * 10) / 10,
    factors,
    verdict: getVerdict(vis),
  }
}

export function getShallowWaterConfidence(
  waveHeightM: number,
  windKnots: number,
  maxDiveDepthM: number,
): { severity: 'low' | 'moderate' | 'high'; waveExceeded: boolean; windExceeded: boolean; waveHeightM: number; windKnots: number } | null {
  if (!Number.isFinite(maxDiveDepthM) || maxDiveDepthM <= 0 || maxDiveDepthM >= 20) return null

  // Thresholds scale with depth: at 10m, flag above 0.67m wave / 16kn wind
  const waveThreshold = maxDiveDepthM / 15
  const windThreshold = maxDiveDepthM * 1.6

  const waveExceeded = waveHeightM > waveThreshold
  const windExceeded = windKnots > windThreshold

  if (!waveExceeded && !windExceeded) return null

  const ratio = Math.max(
    waveExceeded ? waveHeightM / waveThreshold : 0,
    windExceeded ? windKnots / windThreshold : 0,
  )
  const severity: 'low' | 'moderate' | 'high' = ratio > 2.5 ? 'high' : ratio > 1.6 ? 'moderate' : 'low'

  return { severity, waveExceeded, windExceeded, waveHeightM, windKnots }
}
