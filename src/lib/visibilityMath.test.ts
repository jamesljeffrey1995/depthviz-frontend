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
import {
  CONTRAST_THRESHOLD,
  beerLambert,
  contrastAtRange,
  percentile,
  transmissionFromDarkChannel,
} from './visibilityMath'

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

/**
 * Tests for the Underwater Dark Channel Prior fix.
 *
 * Reported bug: genuine dive footage analysed to t̃ = 1.000, median visibility
 * pinned at the 50 m cap with P10 = P90 (near-zero variance), and a "video does
 * not appear to be underwater" / 0% confidence banner.
 *
 * Root cause: the dark channel was taken over all of R, G, B. Underwater the red
 * channel is absorbed to near-zero, so min(R,G,B) ≈ 0 everywhere → transmission
 * collapses to ≈ 1. The fix builds the dark channel from green + blue only, so
 * the dark-channel value reflects real backscatter and transmission stays below
 * 1 for real footage. transmissionFromDarkChannel is the worker's t = 1 − ω·d
 * mapping, now shared and tested.
 */
describe('transmissionFromDarkChannel', () => {
  test('a zero dark channel (perfectly clear patch) gives t ≈ 1', () => {
    expect(transmissionFromDarkChannel(0)).toBeCloseTo(1, 5)
  })

  test('a strong dark channel (turbid backscatter) drives t well below 1', () => {
    expect(transmissionFromDarkChannel(1)).toBeCloseTo(0.05, 5)
  })

  test('is monotonic decreasing in the dark-channel value', () => {
    expect(transmissionFromDarkChannel(0.2)).toBeGreaterThan(transmissionFromDarkChannel(0.5))
    expect(transmissionFromDarkChannel(0.5)).toBeGreaterThan(transmissionFromDarkChannel(0.8))
  })

  test('stays clamped within [0, 1] for out-of-range input', () => {
    expect(transmissionFromDarkChannel(-0.5)).toBe(1)
    expect(transmissionFromDarkChannel(5)).toBe(0)
  })

  test('omega is configurable', () => {
    expect(transmissionFromDarkChannel(0.5, 1.0)).toBeCloseTo(0.5, 5)
    expect(transmissionFromDarkChannel(0.5, 0.8)).toBeCloseTo(0.6, 5)
  })
})

describe('UDCP transmission → visibility contract for real dive footage', () => {
  // Under UDCP, genuine underwater footage has a meaningful green/blue dark
  // channel (backscatter). These values must NOT collapse to the degenerate
  // t ≈ 1 / 50 m / "not underwater" result the user reported.
  const turbidDarkChannels = [0.25, 0.35, 0.45, 0.55]

  test('produces realistic, finite diving visibilities (not the 50 m cap)', () => {
    for (const d of turbidDarkChannels) {
      const t = transmissionFromDarkChannel(d)
      const vis = beerLambert(t, CALIB)
      expect(Number.isFinite(vis)).toBe(true)
      expect(vis).toBeGreaterThan(0)
      // Below the validation "unrealistically high" threshold (40 m) and the
      // 50 m cap, so the "not underwater" banner no longer fires.
      expect(vis).toBeLessThan(40)
    }
  })

  test('lower transmission (more turbid) yields lower visibility', () => {
    const vis = turbidDarkChannels.map((d) => beerLambert(transmissionFromDarkChannel(d), CALIB))
    for (let i = 1; i < vis.length; i++) {
      expect(vis[i]).toBeLessThan(vis[i - 1]!)
    }
  })
})

describe('contrastAtRange', () => {
  test('hits the sighting threshold exactly at the visibility range', () => {
    for (const vis of [1.5, 3, 6.4, 12, 25]) {
      expect(contrastAtRange(vis, vis)).toBeCloseTo(CONTRAST_THRESHOLD, 6)
    }
  })

  test('is full contrast at zero range and decays monotonically', () => {
    expect(contrastAtRange(8, 0)).toBe(1)
    const series = [1, 2, 4, 8, 16].map((d) => contrastAtRange(8, d))
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!).toBeLessThan(series[i - 1]!)
    }
  })

  test('clearer water keeps more contrast at the same range', () => {
    expect(contrastAtRange(12, 5)).toBeGreaterThan(contrastAtRange(4, 5))
  })

  test('agrees with beerLambert about the same water', () => {
    // beerLambert turns a transmission into a visibility; contrastAtRange turns
    // that visibility back into a per-metre contrast. Round-tripping through
    // both should land on the range we started from.
    const vis = beerLambert(0.86, 1.2)
    const c = contrastAtRange(vis, vis)
    expect(c).toBeCloseTo(CONTRAST_THRESHOLD, 6)
  })

  test('never returns a non-finite number, even for a zero visibility', () => {
    for (const vis of [0, -1, 0.0001]) {
      const c = contrastAtRange(vis, 3)
      expect(Number.isFinite(c)).toBe(true)
      expect(c).toBeGreaterThanOrEqual(0)
    }
  })
})
