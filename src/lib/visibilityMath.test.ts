/**
 * Regression tests for the broken visibility headline reported by users:
 *
 *   "-INFINITY m" median / mean visibility, "NaN" P10, with a "transmission
 *   too high" banner — produced by near-clear footage (t̃ ≈ 1.000).
 *
 * Root cause: beerLambert divided by -log(t). At t = 1, -log(1) is -0, so
 * calib / -0 = -Infinity, which then poisoned the aggregate stats (mean →
 * -Infinity; a percentile interpolated between two -Infinity values → NaN).
 */
import { describe, expect, test } from 'vitest'
import { beerLambert, percentile } from './visibilityMath'

const CALIB = 4.0

describe('beerLambert', () => {
  test('t = 1.000 yields a finite number, not -Infinity (the user-reported bug)', () => {
    const vis = beerLambert(1.0, CALIB)
    expect(Number.isFinite(vis)).toBe(true)
    expect(vis).toBeGreaterThan(0)
  })

  test('is finite and non-negative across the full transmission range', () => {
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const vis = beerLambert(t, CALIB)
      expect(Number.isFinite(vis)).toBe(true)
      expect(vis).toBeGreaterThanOrEqual(0)
    }
  })

  test('lower transmission means lower visibility (monotonic)', () => {
    expect(beerLambert(0.3, CALIB)).toBeLessThan(beerLambert(0.6, CALIB))
    expect(beerLambert(0.6, CALIB)).toBeLessThan(beerLambert(0.85, CALIB))
  })

  test('a realistic mid-range transmission gives a plausible diving visibility', () => {
    // t ≈ 0.85 → ~24-25 m, within plausible diving range
    expect(beerLambert(0.85, CALIB)).toBeCloseTo(24.6, 1)
  })

  test('caps absurd clear-water visibility instead of returning hundreds of metres', () => {
    expect(beerLambert(1.0, CALIB)).toBeLessThanOrEqual(50)
    // Still above the validation "unrealistically high" threshold (40 m) so the
    // "not underwater" warning still fires for clear footage.
    expect(beerLambert(1.0, CALIB)).toBeGreaterThan(40)
  })
})

describe('percentile over visibilities derived from near-clear frames', () => {
  test('aggregates of clamped visibilities are finite (no -Infinity / NaN)', () => {
    const tMedians = [1.0, 1.0, 1.0, 0.952, 1.0, 0.98]
    const vis = tMedians.map((t) => beerLambert(t, CALIB)).sort((a, b) => a - b)

    const median = percentile(vis, 50)
    const p10 = percentile(vis, 10)
    const p90 = percentile(vis, 90)
    const mean = vis.reduce((s, v) => s + v, 0) / vis.length

    for (const v of [median, p10, p90, mean]) {
      expect(Number.isFinite(v)).toBe(true)
      expect(Number.isNaN(v)).toBe(false)
    }
  })
})
