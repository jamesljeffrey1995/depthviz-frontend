import { describe, it, expect } from 'vitest'
import {
  computeDiveScore,
  visibilitySub,
  seaStateSub,
  windSub,
  rainSub,
  algaeSub,
  bandForScore,
} from './diveScore'
import type { DayForecast } from '../types'

function mkDay(overrides: Partial<DayForecast>): DayForecast {
  return {
    date: '2025-07-01',
    is_forecast: true,
    vis_estimate: 3.1,
    vis_corrected: null,
    vis_corrected_offset: null,
    verdict: 'workable',
    color_class: 'decent',
    wave_height: 0.3,
    swell_height: 0.4,
    swell_period: 6,
    swell_direction: 45,
    swell_dir_label: 'NE',
    swell_components: [],
    wind_speed: 8,
    wind_dir: 180,
    wind_dir_label: 'S',
    wind_gust: null,
    precipitation: 0.1,
    air_temp: 15,
    sea_temp: 14,
    humidity: 70,
    cloud_cover: 40,
    algae: { risk: 'low', score: 0.1, drivers: [] },
    factors: [],
    nutrient_factor: null,
    turbidity_penalty: null,
    resuspension: null,
    river_discharge: null,
    water_quality: null,
    bias_attribution: null,
    explanation: null,
    ...overrides,
  }
}

describe('sub-score curves', () => {
  it('are monotonic and clamped to 0–100', () => {
    for (const fn of [visibilitySub, seaStateSub, windSub, rainSub]) {
      for (const x of [-5, 0, 0.5, 1, 2, 5, 10, 50, 1000]) {
        const v = fn(x)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('visibility rises with clearer water', () => {
    expect(visibilitySub(0)).toBeLessThan(visibilitySub(3))
    expect(visibilitySub(3)).toBeLessThan(visibilitySub(6))
    expect(visibilitySub(6)).toBeLessThan(visibilitySub(10))
  })

  it('sea state, wind and rain fall as conditions worsen', () => {
    expect(seaStateSub(0.2)).toBeGreaterThan(seaStateSub(1.5))
    expect(windSub(4)).toBeGreaterThan(windSub(22))
    expect(rainSub(0)).toBeGreaterThan(rainSub(4))
  })

  it('handles NaN gracefully', () => {
    expect(visibilitySub(NaN)).toBe(0)
  })

  it('algae buckets map as expected', () => {
    expect(algaeSub('low')).toBe(100)
    expect(algaeSub('moderate')).toBe(60)
    expect(algaeSub('high')).toBe(25)
  })
})

describe('bandForScore', () => {
  it('assigns the right verdict at boundaries', () => {
    expect(bandForScore(90).key).toBe('excellent')
    expect(bandForScore(70).key).toBe('good')
    expect(bandForScore(50).key).toBe('fair')
    expect(bandForScore(35).key).toBe('marginal')
    expect(bandForScore(20).key).toBe('poor')
    expect(bandForScore(5).key).toBe('blown')
  })

  it('maps bands to go / maybe / skip answers', () => {
    expect(bandForScore(90).answer).toBe('go')
    expect(bandForScore(50).answer).toBe('maybe')
    expect(bandForScore(5).answer).toBe('skip')
  })
})

describe('computeDiveScore', () => {
  it('rates a clear, calm day highly and says go', () => {
    const day = mkDay({
      vis_estimate: 7, wave_height: 0.2, swell_height: 0.2, wind_speed: 4,
      precipitation: 0, algae: { risk: 'low', score: 0, drivers: [] },
    })
    const s = computeDiveScore(day, 'm')
    expect(s.score).toBeGreaterThanOrEqual(82)
    expect(s.answer).toBe('go')
    expect(s.keyDriver.key).toBe('visibility')
  })

  it('rates a blown-out day poorly and says skip', () => {
    const day = mkDay({
      vis_estimate: 0.5, wave_height: 2.5, swell_height: 2.8, wind_speed: 28,
      precipitation: 5, algae: { risk: 'high', score: 0.9, drivers: ['runoff'] },
    })
    const s = computeDiveScore(day, 'm')
    expect(s.score).toBeLessThan(30)
    expect(s.answer).toBe('skip')
    // The worst-weighted contributor should surface as the driver.
    expect(s.keyDriver.impact).toBe('negative')
  })

  it('prefers the corrected visibility when present', () => {
    const base = mkDay({ vis_estimate: 2, vis_corrected: 6, wave_height: 0.2, swell_height: 0.2, wind_speed: 4 })
    const s = computeDiveScore(base, 'm')
    expect(s.factors.find(f => f.key === 'visibility')!.valueLabel).toBe('6.0 m')
  })

  it('normalises wave height from feet', () => {
    const inFeet = mkDay({ wave_height: 3.3, swell_height: 3.3 }) // ~1 m
    const f = computeDiveScore(inFeet, 'ft').factors.find(x => x.key === 'seaState')!
    expect(parseFloat(f.valueLabel)).toBeCloseTo(1.0, 1)
  })

  it('always returns exactly five explainable factors summing weights to ~1', () => {
    const s = computeDiveScore(mkDay({}), 'm')
    expect(s.factors).toHaveLength(5)
    const total = s.factors.reduce((a, f) => a + f.weight, 0)
    expect(total).toBeCloseTo(1, 5)
  })
})
