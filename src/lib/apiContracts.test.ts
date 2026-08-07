import { describe, expect, test } from 'vitest'
import {
  normalizeBestVisResponse,
  normalizeForecastResponse,
  normalizeLocation,
  normalizeLocations,
  normalizeReportList,
  normalizeUserProfile,
} from './apiContracts'

describe('api contracts', () => {
  test('normalizes a minimal forecast payload with safe defaults', () => {
    const out = normalizeForecastResponse({
      location_name: 'Portland',
      lat: 50.5,
      lon: -2.5,
      days: [{ date: '2026-08-07', vis_estimate: 8.2, verdict: 'Good', color_class: 'good' }],
      report_count: 3,
      model_confidence: 'high',
      calibration_active: true,
    })

    expect(out.days).toHaveLength(1)
    expect(out.days[0]?.wave_height).toBe(0)
    expect(out.model_confidence).toBe('high')
  })

  test('rejects invalid forecast payloads', () => {
    expect(() => normalizeForecastResponse({ location_name: 'x', lat: 1, lon: 1, days: [] }))
      .toThrow(/usable forecast days/i)
  })

  test('nulls malformed nested forecast contracts', () => {
    const out = normalizeForecastResponse({
      location_name: 'Portland',
      lat: 50.5,
      lon: -2.5,
      days: [{
        date: '2026-08-07',
        vis_estimate: 8.2,
        verdict: 'Good',
        color_class: 'good',
        resuspension: { risk_level: 'high', penalty: '5', resuspension_risk: 0.7, recovery_state: 0.4 },
        river_discharge: { risk_level: 'moderate', penalty: 1.2, distance_km: 'nearby' },
        water_quality: { bgc_kd: '0.2', erddap_obs_date: 123 },
        bias_attribution: { similar_reports: 'invalid', mean_error: 0.6, total_reports: 4 },
        explanation: { visibility_m: '8', confidence: 'high', main_reason: 'Clear water', contributing_factors: ['Calm seas'] },
      }],
    })

    expect(out.days[0]?.resuspension).toBeNull()
    expect(out.days[0]?.river_discharge?.distance_km).toBeNull()
    expect(out.days[0]?.water_quality?.bgc_kd).toBeNull()
    expect(out.days[0]?.water_quality?.erddap_obs_date).toBeNull()
    expect(out.days[0]?.bias_attribution).toBeNull()
    expect(out.days[0]?.explanation).toBeNull()
  })

  test('normalizes locations and optional encryption fields', () => {
    const out = normalizeLocations([
      {
        id: 1,
        name: 'Spot A',
        lat: 1,
        lon: 2,
        is_public: true,
        is_predefined: false,
        vote_count: 2,
        user_vote: 'up',
      },
    ])

    expect(out[0]?.encrypted_lat).toBeNull()
    expect(out[0]?.encrypted_lon).toBeNull()
  })

  test('normalizes user profile with tolerant optional fields', () => {
    const out = normalizeUserProfile({
      supabase_uid: 'uid1',
      email: 'u@example.com',
      report_count: 1,
      trusted: true,
      is_admin: false,
      unknown_field: 'ignored',
    })

    expect(out.display_name).toBeNull()
    expect(out.report_count).toBe(1)
  })

  test('normalizes report lists', () => {
    const out = normalizeReportList([
      {
        id: 9,
        user_id: 'uid',
        location_id: 1,
        report_date: '2026-08-07',
        actual_vis: 7,
        predicted_vis: 6,
        trust_weight: 1,
        is_quarantined: false,
        created_at: '2026-08-07T00:00:00Z',
      },
    ])

    expect(out[0]?.id).toBe(9)
    expect(out[0]?.notes).toBeUndefined()
  })

  test('normalizes best-vis responses and drops malformed spots', () => {
    const out = normalizeBestVisResponse({
      spots: [
        {
          name: 'A',
          lat: 1,
          lon: 2,
          day: { date: '2026-08-07', vis_estimate: 7, verdict: 'Good', color_class: 'good' },
        },
        { bad: true },
      ],
    })

    expect(out.spots).toHaveLength(1)
    expect(out.spots[0]?.name).toBe('A')
  })

  test('normalizes one location payload', () => {
    const out = normalizeLocation({
      id: 3,
      name: 'Reef',
      lat: 10,
      lon: 11,
      is_public: false,
      is_predefined: false,
      vote_count: 0,
      user_vote: null,
      depth_m: 12,
      seabed_class: 'sand',
    })

    expect(out.depth_m).toBe(12)
    expect(out.seabed_class).toBe('sand')
  })
})
