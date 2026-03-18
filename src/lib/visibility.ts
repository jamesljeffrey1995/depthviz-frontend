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
    [0,  'STAY ASHORE',  'blocked',  '⚠ Sea state makes this dive unsafe. Do not enter the water.'],
    [2,  'NOT WORTH IT', 'poor',     null],
    [4,  'VERY POOR',    'poor',     null],
    [6,  'MARGINAL',     'marginal', null],
    [9,  'DECENT',       'decent',   null],
    [12, 'GOOD',         'good',     null],
  ]
  for (const [threshold, label, colorClass, alert] of map) {
    if (vis <= threshold) return { label, colorClass, alert }
  }
  return { label: 'EXCELLENT', colorClass: 'excellent', alert: null }
}

export function calculateVisibility(
  { weather, marine, histWeather, histMarine }: ConditionsData,
  lat: number
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

  // 1. Swell
  let wavePenalty = 0
  if (effectiveSwell > 0.5) wavePenalty = -1
  if (effectiveSwell > 1.0) wavePenalty = -2.5
  if (effectiveSwell > 1.5) wavePenalty = -4
  if (effectiveSwell > 2.5) wavePenalty = -6
  if (effectiveSwell > 3.5) wavePenalty = -8
  factors.push({
    name: 'Swell / Wave',
    value: `${rawSwell.toFixed(1)}m`,
    note: histWaveMaxes[1] > rawSwell * 1.3 ? '↑ recent history' : null,
    penalty: wavePenalty,
    max_penalty: 8,
  })

  // 2. Wind speed
  let windPenalty = 0
  if (effectiveWind > 10) windPenalty = -0.5
  if (effectiveWind > 15) windPenalty = -1.5
  if (effectiveWind > 20) windPenalty = -2.5
  if (effectiveWind > 28) windPenalty = -4
  factors.push({
    name: 'Wind',
    value: `${Math.round(windKnots)}kn`,
    penalty: windPenalty,
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

  // 4. Precipitation
  let rainPenalty = 0
  if (effectiveRain > 0.2) rainPenalty = -0.5
  if (effectiveRain > 1)   rainPenalty = -1.5
  if (effectiveRain > 3)   rainPenalty = -3
  factors.push({
    name: 'Precip',
    value: `${precipitation.toFixed(1)}mm/h`,
    note: historicalRain > precipitation * 1.5 && historicalRain > 1 ? '↑ recent rain' : null,
    penalty: rainPenalty,
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

  const totalPenalty = wavePenalty + windPenalty + dirPenalty + rainPenalty + humidPenalty
  let vis = Math.max(0, Math.min(15, baseVis + totalPenalty))
  if (effectiveSwell > 4 || (windKnots > 35 && effectiveSwell > 2)) vis = 0

  return {
    vis: Math.round(vis * 10) / 10,
    factors,
    verdict: getVerdict(vis),
  }
}
