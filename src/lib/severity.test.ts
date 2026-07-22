import { describe, test, expect } from 'vitest'
import { SEVERITY_TOKEN, impactToken, riskToken } from './severity'

/**
 * The severity ramp is the single source of truth for *alert* colour across
 * the location page, so its threshold boundaries and token outputs are pinned
 * here — the same guard the other lib helpers (visibility, units) carry. If a
 * boundary or token reference drifts, a screen silently mis-grades a risk.
 */

describe('SEVERITY_TOKEN', () => {
  test('every step is a design-token reference, never a raw hex', () => {
    for (const value of Object.values(SEVERITY_TOKEN)) {
      expect(value).toMatch(/^var\(--ds-[a-z]+\)$/)
    }
  })

  test('maps each step to its documented status token', () => {
    expect(SEVERITY_TOKEN.safe).toBe('var(--ds-success)')
    expect(SEVERITY_TOKEN.low).toBe('var(--ds-warn)')
    expect(SEVERITY_TOKEN.moderate).toBe('var(--ds-caution)')
    expect(SEVERITY_TOKEN.high).toBe('var(--ds-danger)')
  })
})

describe('impactToken', () => {
  test('non-positive ratios are safe (no impact)', () => {
    expect(impactToken(0)).toBe(SEVERITY_TOKEN.safe)
    expect(impactToken(-0.5)).toBe(SEVERITY_TOKEN.safe)
  })

  test('threshold boundaries: [0,0.4) low, [0.4,0.75) moderate, [0.75,∞) high', () => {
    // just inside "low"
    expect(impactToken(0.0001)).toBe(SEVERITY_TOKEN.low)
    expect(impactToken(0.39)).toBe(SEVERITY_TOKEN.low)
    // boundary is inclusive of the upper band
    expect(impactToken(0.4)).toBe(SEVERITY_TOKEN.moderate)
    expect(impactToken(0.74)).toBe(SEVERITY_TOKEN.moderate)
    expect(impactToken(0.75)).toBe(SEVERITY_TOKEN.high)
    expect(impactToken(1)).toBe(SEVERITY_TOKEN.high)
  })

  test('non-finite ratios do not fall through to a high-severity colour', () => {
    // A NaN ratio (e.g. a zero-max factor) must not read as danger — callers
    // guard the divide, but the mapping is defensive too.
    expect(impactToken(NaN)).toBe(SEVERITY_TOKEN.safe)
  })
})

describe('riskToken', () => {
  test('maps each named risk level to its token', () => {
    expect(riskToken('none')).toBe(SEVERITY_TOKEN.safe)
    expect(riskToken('low')).toBe(SEVERITY_TOKEN.low)
    expect(riskToken('moderate')).toBe(SEVERITY_TOKEN.moderate)
    expect(riskToken('high')).toBe(SEVERITY_TOKEN.high)
  })

  test('an unknown level fails safe rather than throwing', () => {
    expect(riskToken('')).toBe(SEVERITY_TOKEN.safe)
    expect(riskToken('bogus')).toBe(SEVERITY_TOKEN.safe)
  })
})
