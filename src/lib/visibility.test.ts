import { describe, it, expect } from 'vitest'
import { getVerdict, calculateVisibility, getImpact } from './visibility'
import type { ConditionsData } from '../types'

// ── getVerdict: pin every boundary of the fixed verdict scale ──
// map thresholds: 0 STAY ASHORE, 1 POOR, 3 LIMITED, 5 MARGINAL, 8 DECENT,
// 12 GOOD, else EXCELLENT (first threshold where vis <= threshold wins).
describe('getVerdict thresholds', () => {
  const cases: Array<[number, string]> = [
    [0, 'STAY ASHORE'],
    [0.5, 'POOR'],
    [1, 'POOR'],
    [1.01, 'LIMITED'],
    [3, 'LIMITED'],
    [3.01, 'MARGINAL'],
    [5, 'MARGINAL'],
    [5.01, 'DECENT'],
    [8, 'DECENT'],
    [8.01, 'GOOD'],
    [12, 'GOOD'],
    [12.01, 'EXCELLENT'],
    [30, 'EXCELLENT'],
  ]
  for (const [vis, label] of cases) {
    it(`vis ${vis} → ${label}`, () => {
      expect(getVerdict(vis).label).toBe(label)
    })
  }

  it('only STAY ASHORE carries a safety alert', () => {
    expect(getVerdict(0).alert).toMatch(/unsafe/i)
    expect(getVerdict(0).colorClass).toBe('blocked')
    expect(getVerdict(6).alert).toBeNull()
    expect(getVerdict(14).alert).toBeNull()
  })
})

// Minimal ConditionsData builder — only the fields calculateVisibility reads.
function conditions(
  weather: Partial<ConditionsData['weather']['current']> = {},
  marine: Partial<NonNullable<ConditionsData['marine']['current']>> = {},
): ConditionsData {
  return {
    weather: { current: { ...weather } },
    marine: { current: { wave_height: 0, wave_period: 0, swell_wave_height: 0, ...marine } },
  }
}

describe('calculateVisibility', () => {
  it('uses the 11 m baseline outside the North Sea in calm conditions', () => {
    // lat 40 → not North Sea; no wind/swell/rain, offshore wind (dir 0).
    const r = calculateVisibility(conditions(), 40)
    expect(r.vis).toBe(11)
    expect(r.verdict.label).toBe('GOOD')
  })

  it('uses the pessimistic 8 m North Sea baseline (50 < lat < 62)', () => {
    const r = calculateVisibility(conditions(), 55)
    expect(r.vis).toBe(8)
    expect(r.verdict.label).toBe('DECENT')
  })

  it('interpolates the swell penalty piecewise-linearly between breakpoints', () => {
    // swell 0.75 m is halfway between (0.5, -0.5) and (1.0, -1.5) → penalty -1.0.
    // baseline 11 − 1.0 = 10.0. No other active factors.
    const r = calculateVisibility(conditions({}, { swell_wave_height: 0.75 }), 40)
    expect(r.vis).toBeCloseTo(10.0, 5)
    const swell = r.factors.find(f => f.name === 'Swell / Wave')
    expect(swell?.penalty).toBeCloseTo(-1.0, 5)
  })

  it('forces STAY ASHORE (vis 0) when effective swell exceeds 4 m', () => {
    const r = calculateVisibility(conditions({}, { swell_wave_height: 5 }), 40)
    expect(r.vis).toBe(0)
    expect(r.verdict.label).toBe('STAY ASHORE')
  })

  it('forces STAY ASHORE when wind > 35 kn and swell > 2 m together', () => {
    const r = calculateVisibility(conditions({ wind_speed_10m: 40 }, { swell_wave_height: 2.5 }), 40)
    expect(r.vis).toBe(0)
  })

  it('applies the ML swell multiplier to the swell penalty', () => {
    const base = calculateVisibility(conditions({}, { swell_wave_height: 1.0 }), 40)
    const scaled = calculateVisibility(conditions({}, { swell_wave_height: 1.0 }), 40, {
      swell_multiplier: 2,
      wind_multiplier: 1,
      rain_multiplier: 1,
    })
    const basePen = base.factors.find(f => f.name === 'Swell / Wave')!.penalty
    const scaledPen = scaled.factors.find(f => f.name === 'Swell / Wave')!.penalty
    expect(scaledPen).toBeCloseTo(basePen * 2, 5)
  })

  it('never returns a visibility below 0 or above 15', () => {
    const stormy = calculateVisibility(
      conditions({ wind_speed_10m: 50, precipitation: 20 }, { swell_wave_height: 6 }),
      55,
    )
    expect(stormy.vis).toBeGreaterThanOrEqual(0)
    expect(stormy.vis).toBeLessThanOrEqual(15)
  })
})

describe('getImpact', () => {
  it('reports NO IMPACT when penalty or maxPenalty is zero', () => {
    expect(getImpact(0, 8).label).toBe('NO IMPACT')
    expect(getImpact(-3, 0).label).toBe('NO IMPACT')
  })

  it('scales the label by the penalty:maxPenalty ratio', () => {
    expect(getImpact(-2, 8).label).toBe('LOW IMPACT')   // 0.25
    expect(getImpact(-4, 8).label).toBe('MODERATE')     // 0.50
    expect(getImpact(-6, 8).label).toBe('HIGH IMPACT')  // 0.75
    expect(getImpact(-8, 8).label).toBe('SEVERE')       // 1.0
  })
})
