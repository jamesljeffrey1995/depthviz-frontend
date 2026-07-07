import { describe, expect, test } from 'vitest'
import {
  calculateWeight,
  bodySurfaceArea,
  kgToLb,
  type WeightCalcInput,
} from './weightCalc'

const base: WeightCalcInput = {
  heightCm: 180,
  weightKg: 80,
  build: 'average',
  wetsuitMm: 5,
  suitType: 'full',
  neutralDepthM: 10,
  water: 'salt',
}

describe('bodySurfaceArea (Mosteller)', () => {
  test('180cm / 80kg ≈ 2.0 m²', () => {
    expect(bodySurfaceArea(180, 80)).toBeCloseTo(2.0, 2)
  })
})

describe('calculateWeight', () => {
  test('returns a sensible starting load for a typical 5mm freediver', () => {
    const r = calculateWeight(base)
    expect(r.recommendedKg).toBeGreaterThan(3)
    expect(r.recommendedKg).toBeLessThan(8)
    // Range brackets the recommendation.
    expect(r.minKg).toBeLessThanOrEqual(r.recommendedKg)
    expect(r.maxKg).toBeGreaterThanOrEqual(r.recommendedKg)
    expect(r.minKg).toBeGreaterThanOrEqual(0)
  })

  test('thicker neoprene requires more lead', () => {
    const thin = calculateWeight({ ...base, wetsuitMm: 3 })
    const thick = calculateWeight({ ...base, wetsuitMm: 8 })
    expect(thick.recommendedKg).toBeGreaterThan(thin.recommendedKg)
  })

  test('deeper neutral target requires less lead (suit compresses)', () => {
    const shallow = calculateWeight({ ...base, neutralDepthM: 5 })
    const deep = calculateWeight({ ...base, neutralDepthM: 25 })
    expect(deep.recommendedKg).toBeLessThan(shallow.recommendedKg)
  })

  test('higher body fat is more buoyant and needs more lead than muscular', () => {
    const muscular = calculateWeight({ ...base, build: 'muscular' })
    const stocky = calculateWeight({ ...base, build: 'stocky' })
    expect(stocky.recommendedKg).toBeGreaterThan(muscular.recommendedKg)
  })

  test('salt water needs more lead than fresh', () => {
    const salt = calculateWeight({ ...base, water: 'salt' })
    const fresh = calculateWeight({ ...base, water: 'fresh' })
    expect(salt.recommendedKg).toBeGreaterThanOrEqual(fresh.recommendedKg)
  })

  test('no suit ignores any thickness value', () => {
    const a = calculateWeight({ ...base, suitType: 'none', wetsuitMm: 7 })
    const b = calculateWeight({ ...base, suitType: 'none', wetsuitMm: 0 })
    expect(a.recommendedKg).toBe(b.recommendedKg)
    expect(a.suitBuoyancySurface).toBe(0)
  })

  test('fuller coverage requires more lead than a shorty of the same thickness', () => {
    const shorty = calculateWeight({ ...base, suitType: 'shorty' })
    const full = calculateWeight({ ...base, suitType: 'full' })
    expect(full.recommendedKg).toBeGreaterThan(shorty.recommendedKg)
  })

  test('never recommends negative weight', () => {
    const r = calculateWeight({
      heightCm: 160,
      weightKg: 55,
      build: 'muscular',
      wetsuitMm: 0,
      suitType: 'none',
      neutralDepthM: 30,
      water: 'fresh',
    })
    expect(r.recommendedKg).toBeGreaterThanOrEqual(0)
    expect(r.minKg).toBeGreaterThanOrEqual(0)
  })

  test('rounds to the nearest half kilogram', () => {
    const r = calculateWeight(base)
    expect(r.recommendedKg * 2).toBe(Math.round(r.recommendedKg * 2))
  })

  test('clamps absurd inputs instead of producing NaN', () => {
    const r = calculateWeight({ ...base, weightKg: NaN, heightCm: NaN })
    expect(Number.isFinite(r.recommendedKg)).toBe(true)
  })
})

describe('per-region suit model', () => {
  const regionBase = {
    heightCm: 180,
    weightKg: 80,
    build: 'average' as const,
    neutralDepthM: 10,
    water: 'salt' as const,
  }

  test('a uniform 5mm full suit + hood matches the legacy fullHood coverage', () => {
    const legacy = calculateWeight({ ...base, suitType: 'fullHood', wetsuitMm: 5 })
    const region = calculateWeight({
      ...regionBase,
      regions: { hood: 5, body: 5, legs: 5 },
    })
    expect(region.suitBuoyancySurface).toBeCloseTo(legacy.suitBuoyancySurface, 6)
  })

  test('a uniform 5mm full suit (no hood) matches the legacy full coverage', () => {
    const legacy = calculateWeight({ ...base, suitType: 'full', wetsuitMm: 5 })
    const region = calculateWeight({
      ...regionBase,
      regions: { body: 5, legs: 5 },
    })
    expect(region.suitBuoyancySurface).toBeCloseTo(legacy.suitBuoyancySurface, 6)
  })

  test('thicker legs alone increases suit buoyancy', () => {
    const thin = calculateWeight({ ...regionBase, regions: { legs: 3 } })
    const thick = calculateWeight({ ...regionBase, regions: { legs: 7 } })
    expect(thick.suitBuoyancySurface).toBeGreaterThan(thin.suitBuoyancySurface)
  })

  test('empty / bare regions contribute no suit buoyancy', () => {
    const bare = calculateWeight({ ...regionBase, regions: {} })
    expect(bare.suitBuoyancySurface).toBe(0)
  })

  test('missing region entries count as bare, not NaN', () => {
    const r = calculateWeight({ ...regionBase, regions: { body: 5 } })
    expect(Number.isFinite(r.suitBuoyancySurface)).toBe(true)
    expect(r.suitBuoyancySurface).toBeGreaterThan(0)
  })

  test('regions take precedence over legacy suitType/wetsuitMm', () => {
    const r = calculateWeight({
      ...base,
      suitType: 'fullHood',
      wetsuitMm: 8,
      regions: {},
    })
    expect(r.suitBuoyancySurface).toBe(0)
  })
})

describe('kgToLb', () => {
  test('converts kilograms to pounds', () => {
    expect(kgToLb(10)).toBeCloseTo(22.05, 1)
  })
})
