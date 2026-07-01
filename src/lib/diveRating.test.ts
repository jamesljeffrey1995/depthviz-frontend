import { describe, it, expect } from 'vitest'
import { getDiveRating, findBestWindow, computeConfidence } from './diveRating'
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
    ...overrides,
  }
}

describe('getDiveRating (NE UK spearfishing calibration)', () => {
  it('never calls 3.1m "poor" or "very poor"', () => {
    const r = getDiveRating(3.1)
    expect(r.key).toBe('workable')
    expect(r.label).toBe('Workable')
  })

  it('buckets under 1m as blown out', () => {
    expect(getDiveRating(0.5).key).toBe('blown_out')
  })

  it('buckets 1–2m as poor', () => {
    expect(getDiveRating(1.0).key).toBe('poor')
    expect(getDiveRating(1.9).key).toBe('poor')
  })

  it('buckets 2–3m as marginal', () => {
    expect(getDiveRating(2.5).key).toBe('marginal')
  })

  it('buckets 4–6m as good', () => {
    expect(getDiveRating(4.5).key).toBe('good')
    expect(getDiveRating(5.9).key).toBe('good')
  })

  it('buckets 6m+ as excellent', () => {
    expect(getDiveRating(6.0).key).toBe('excellent')
    expect(getDiveRating(9.0).key).toBe('excellent')
  })
})

describe('findBestWindow', () => {
  it('finds the longest good-or-better run and its peak', () => {
    const days = [
      mkDay({ date: '2025-07-01', vis_estimate: 2.0 }),
      mkDay({ date: '2025-07-02', vis_estimate: 4.5 }),
      mkDay({ date: '2025-07-03', vis_estimate: 5.5 }),
      mkDay({ date: '2025-07-04', vis_estimate: 3.0 }),
    ]
    const w = findBestWindow(days)
    expect(w).not.toBeNull()
    expect(w!.startIndex).toBe(1)
    expect(w!.endIndex).toBe(2)
    expect(w!.bestVis).toBeCloseTo(5.5)
  })

  it('falls back to the single best day when nothing is workable', () => {
    const days = [
      mkDay({ date: '2025-07-01', vis_estimate: 0.5 }),
      mkDay({ date: '2025-07-02', vis_estimate: 1.4 }),
      mkDay({ date: '2025-07-03', vis_estimate: 1.9 }),
    ]
    const w = findBestWindow(days)
    expect(w).not.toBeNull()
    expect(w!.startIndex).toBe(2)
    expect(w!.endIndex).toBe(2)
  })
})

describe('computeConfidence', () => {
  it('downgrades high to medium when there are no reports', () => {
    const day = mkDay({})
    const info = computeConfidence(day, { report_count: 0, model_confidence: 'high' })
    expect(info.level).toBe('medium')
    expect(info.reasons.some(r => r.includes('no recent community reports'))).toBe(true)
  })

  it('keeps high when reports and stable conditions', () => {
    const day = mkDay({ wave_height: 0.2, wind_speed: 5, water_quality: { bgc_kd: 0.2, bgc_kd_vis: null, bgc_source: 'BGC', erddap_chlorophyll: null, erddap_kd490: null, erddap_kd490_vis: null, erddap_obs_date: '2025-06-30' } })
    const info = computeConfidence(day, { report_count: 6, model_confidence: 'high' })
    expect(info.level).toBe('high')
  })
})
