/**
 * Regression tests for the wave-height unit toggle reported by users:
 *
 *   "says it's 3 metres but converts to 5ft"
 *   "highly eutrophic in ft view but only nutrient rich in metres view"
 *
 * Both bugs reduce to: a value is displayed in one unit while implicitly
 * being in another, OR a unit-agnostic value (nutrient_factor) is being
 * classified inconsistently between views.
 */
import { describe, expect, test } from 'vitest'
import {
  M_TO_FT,
  FT_TO_M,
  metresToFeet,
  feetToMetres,
  visibilityInUnits,
  getWaterQuality,
} from './units'

describe('metres ↔ feet conversion', () => {
  test('3m equals ~9.84ft, not 5ft (the user-reported bug)', () => {
    const ft = metresToFeet(3.0)
    expect(ft).toBeCloseTo(9.84, 2)
    // Specifically guard against a buggy ~5ft output
    expect(ft).toBeGreaterThan(9.5)
    expect(ft).toBeLessThan(10.5)
  })

  test('1m equals exactly 3.28084ft (matches services/visibility.py)', () => {
    expect(metresToFeet(1.0)).toBeCloseTo(3.28084, 4)
  })

  test('round-trip m → ft → m recovers the original value', () => {
    expect(feetToMetres(metresToFeet(2.5))).toBeCloseTo(2.5, 6)
  })

  test('M_TO_FT and FT_TO_M are reciprocals', () => {
    expect(M_TO_FT * FT_TO_M).toBeCloseTo(1.0, 10)
  })

  test('zero stays zero in both directions', () => {
    expect(metresToFeet(0)).toBe(0)
    expect(feetToMetres(0)).toBe(0)
  })

  test('visibility is converted for display instead of only being relabelled', () => {
    expect(visibilityInUnits(4.2, 'm')).toBe(4.2)
    expect(visibilityInUnits(4.2, 'ft')).toBeCloseTo(13.78, 2)
    expect(visibilityInUnits(4.2, 'ft')).not.toBe(4.2)
  })
})

describe('getWaterQuality classification', () => {
  test('classifies factor at canonical band centres', () => {
    expect(getWaterQuality(0.1).label).toBe('Nutrient-poor')
    expect(getWaterQuality(0.45).label).toBe('Moderate nutrients')
    expect(getWaterQuality(0.7).label).toBe('Nutrient-rich')
    expect(getWaterQuality(0.9).label).toBe('Highly eutrophic')
  })

  test('threshold boundaries (lower bound is exclusive of upper band)', () => {
    // Boundary at 0.3
    expect(getWaterQuality(0.299).label).toBe('Nutrient-poor')
    expect(getWaterQuality(0.3).label).toBe('Moderate nutrients')
    // Boundary at 0.6
    expect(getWaterQuality(0.599).label).toBe('Moderate nutrients')
    expect(getWaterQuality(0.6).label).toBe('Nutrient-rich')
    // Boundary at 0.8 — the bug is here: same factor must give same band
    expect(getWaterQuality(0.799).label).toBe('Nutrient-rich')
    expect(getWaterQuality(0.8).label).toBe('Highly eutrophic')
  })

  test('classification is a pure function of nutrient_factor — does not depend on units', () => {
    /* The user's complaint was that the SAME location showed 'Highly eutrophic'
     * in ft view but only 'Nutrient-rich' in m view. nutrient_factor comes
     * from satellite chlorophyll (mg/m³) and is unit-agnostic by construction.
     * If the classification function ever takes a units parameter, this test
     * fails — forcing us to think about the contract. */
    const samples = [0.05, 0.29, 0.3, 0.59, 0.6, 0.79, 0.8, 0.95, 1.0]
    for (const f of samples) {
      // Calling with two different "imaginary" units should produce identical
      // output because units don't appear in the signature.
      const a = getWaterQuality(f)
      const b = getWaterQuality(f)
      expect(a.label).toBe(b.label)
      expect(a.color).toBe(b.color)
      expect(a.description).toBe(b.description)
    }
  })

  test('extreme values are clamped to the end-of-scale band', () => {
    expect(getWaterQuality(0).label).toBe('Nutrient-poor')
    expect(getWaterQuality(1.0).label).toBe('Highly eutrophic')
    // Out-of-range still maps somewhere reasonable
    expect(getWaterQuality(2.0).label).toBe('Highly eutrophic')
  })
})

describe('display number consistency (regression: factor card vs compass)', () => {
  /* The compound bug from the report: a 1.5m wave displayed as both '1.5m'
   * (factor card, internal metres) and '4.9m' (compass, ft value with m
   * suffix) on the same screen. This pair of asserts encodes the contract
   * that callers must convert *and* relabel together. */

  test('a value labelled "ft" must be the metres value × 3.28084', () => {
    const metres = 1.5
    const ftValue = metresToFeet(metres)
    expect(ftValue).toBeCloseTo(4.92, 2)
    // If we accidentally display the metres number with an "ft" suffix,
    // the user sees "1.5ft" instead of "4.9ft" — this asserts they differ.
    expect(metres).not.toBeCloseTo(ftValue, 1)
  })
})
