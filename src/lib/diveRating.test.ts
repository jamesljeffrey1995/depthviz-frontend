import { describe, it, expect } from 'vitest'
import { getDiveRating, findBestWindow, computeConfidence, summariseDrivers } from './diveRating'
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

  it('applies the 2m sea-state threshold in metres even when heights are in feet', () => {
    // 1.5 m swell = ~4.9 ft. The API sends 4.92 when units='ft'. The metre
    // threshold (>2 m = unsettled) must not fire off the raw feet number.
    const calmDay = mkDay({
      wave_height: 4.92, swell_height: 4.92, wind_speed: 5,
      water_quality: { bgc_kd: 0.2, bgc_kd_vis: null, bgc_source: 'BGC', erddap_chlorophyll: null, erddap_kd490: null, erddap_kd490_vis: null, erddap_obs_date: '2025-06-30' },
    })
    const ft = computeConfidence(calmDay, { report_count: 6, model_confidence: 'high' }, 'ft')
    expect(ft.reasons.some(r => r.includes('settled'))).toBe(true)
    expect(ft.reasons.some(r => r.includes('unsettled'))).toBe(false)
    // The same physical sea state read as metres would (wrongly, pre-fix) look
    // huge — confirm the metre path agrees the day is calm.
    const m = computeConfidence(mkDay({ wave_height: 1.5, swell_height: 1.5, wind_speed: 5, water_quality: calmDay.water_quality }), { report_count: 6, model_confidence: 'high' }, 'm')
    expect(m.reasons.some(r => r.includes('settled'))).toBe(true)
  })
})

describe('summariseDrivers unit handling (regression: feet values labelled "m")', () => {
  it('labels the swell driver in the requested unit, not always metres', () => {
    // 1.8 m swell → hurting. In ft view the number is ~5.9 ft and must read
    // "5.9ft", never "5.9m" or the metres number "1.8ft".
    const ftDay = mkDay({ wave_height: 5.91, swell_height: 5.91 })
    const { hurting } = summariseDrivers(ftDay, 'ft')
    const swell = hurting.find(d => d.label === 'Swell')
    expect(swell).toBeDefined()
    expect(swell!.detail).toContain('5.9ft')
    expect(swell!.detail).not.toContain('5.9m')
  })

  it('classifies a calm day (in feet) as low swell, not stirring the surface', () => {
    // 0.4 m swell = ~1.3 ft. Below the 0.6 m "low swell" threshold.
    const ftDay = mkDay({ wave_height: 1.31, swell_height: 1.31 })
    const { helping, hurting } = summariseDrivers(ftDay, 'ft')
    expect(helping.some(d => d.label === 'Swell' && d.detail.includes('low swell'))).toBe(true)
    expect(hurting.some(d => d.label === 'Swell')).toBe(false)
  })
})
