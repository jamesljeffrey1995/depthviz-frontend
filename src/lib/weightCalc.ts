/**
 * Freediving / spearfishing weight-belt estimator.
 *
 * Estimates a STARTING lead weight to be approximately neutrally buoyant at a
 * chosen target depth. This is a rough physical model, not a safety device —
 * every diver must confirm their weighting with an in-water buoyancy check in
 * shallow water before diving. See the on-page disclaimer and /legal/disclaimer.
 *
 * Model summary (all forces expressed in kg of buoyant lift):
 *   • Wetsuit buoyancy at the surface scales with neoprene thickness and the
 *     body-surface-area covered by the suit.
 *   • Neoprene compresses with depth (its gas cells shrink under pressure), so
 *     the suit loses buoyancy the deeper you go — this is the main reason a
 *     diver can be positive at the surface yet neutral at depth.
 *   • The body itself is slightly positive (more so with higher body fat, less
 *     so for lean/muscular builds, and more in salt water) and compresses only
 *     a little with depth (lung air).
 *   • The recommended lead equals the positive buoyancy that remains at the
 *     target neutral depth.
 */

export type Build = 'muscular' | 'lean' | 'average' | 'stocky'
export type SuitType = 'none' | 'shorty' | 'full' | 'fullHood'
export type WaterType = 'salt' | 'fresh'

export interface WeightCalcInput {
  /** Standing height in centimetres. */
  heightCm: number
  /** Body weight in kilograms. */
  weightKg: number
  /** Body composition / build. */
  build: Build
  /** Wetsuit neoprene thickness in millimetres (0 = no suit). */
  wetsuitMm: number
  /** How much of the body the suit covers. */
  suitType: SuitType
  /** Depth (metres) at which the diver wants to be neutrally buoyant. */
  neutralDepthM: number
  /** Salt or fresh water. */
  water: WaterType
}

export interface WeightCalcResult {
  /** Recommended starting lead, kg (rounded to nearest 0.5 kg). */
  recommendedKg: number
  /** Lower end of the suggested starting range, kg. */
  minKg: number
  /** Upper end of the suggested starting range, kg. */
  maxKg: number
  /** Body surface area used (Mosteller), m². */
  bsa: number
  /** Suit buoyancy at the surface, kg. */
  suitBuoyancySurface: number
  /** Suit buoyancy remaining at the target depth, kg. */
  suitBuoyancyAtDepth: number
  /** Body buoyancy at the target depth, kg. */
  bodyBuoyancyAtDepth: number
}

/** Buoyancy (kg lift) per kg of body weight, by build. Higher fat ⇒ more positive. */
const BUILD_FACTOR: Record<Build, number> = {
  muscular: 0.004,
  lean: 0.010,
  average: 0.014,
  stocky: 0.024,
}

/** Fraction of body surface area covered by neoprene, by suit type. */
const SUIT_COVERAGE: Record<SuitType, number> = {
  none: 0,
  shorty: 0.55,
  full: 1.0,
  fullHood: 1.12,
}

/** Neoprene surface buoyancy, kg per mm thickness per m² of covered skin. */
const SUIT_K = 0.55
/** Extra body buoyancy in salt water, as a fraction of body weight. */
const SALT_FACTOR = 0.015

/** Mosteller body surface area, m². */
export function bodySurfaceArea(heightCm: number, weightKg: number): number {
  return Math.sqrt((heightCm * weightKg) / 3600)
}

/** Round to the nearest 0.5 kg (how lead is actually carried). */
function roundHalf(kg: number): number {
  return Math.round(kg * 2) / 2
}

/**
 * Estimate the starting weight-belt load.
 * Returns 0 kg (no weight) when the diver is already non-positive at depth.
 */
export function calculateWeight(input: WeightCalcInput): WeightCalcResult {
  const heightCm = clamp(input.heightCm, 120, 230)
  const weightKg = clamp(input.weightKg, 35, 200)
  const depthM = clamp(input.neutralDepthM, 0, 40)
  const suitType = input.suitType
  // No-suit selection overrides any thickness value.
  const mm = suitType === 'none' ? 0 : clamp(input.wetsuitMm, 0, 8)

  const bsa = bodySurfaceArea(heightCm, weightKg)

  // Suit buoyancy at the surface, then compressed to depth.
  const suitBuoyancySurface = SUIT_K * mm * bsa * SUIT_COVERAGE[suitType]
  const suitCompression = 1 / (1 + depthM / 16)
  const suitBuoyancyAtDepth = suitBuoyancySurface * suitCompression

  // Body buoyancy at the surface (build + salt), lightly compressed to depth.
  const bodyBuoyancySurface =
    weightKg * BUILD_FACTOR[input.build] +
    (input.water === 'salt' ? weightKg * SALT_FACTOR : 0)
  const bodyCompression = 1 / (1 + depthM / 40)
  const bodyBuoyancyAtDepth = bodyBuoyancySurface * bodyCompression

  const recommended = Math.max(0, suitBuoyancyAtDepth + bodyBuoyancyAtDepth)

  return {
    recommendedKg: roundHalf(recommended),
    minKg: roundHalf(Math.max(0, recommended - 1)),
    maxKg: roundHalf(recommended + 1),
    bsa,
    suitBuoyancySurface,
    suitBuoyancyAtDepth,
    bodyBuoyancyAtDepth,
  }
}

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo
  return Math.min(hi, Math.max(lo, v))
}

/** kg → lb. */
export function kgToLb(kg: number): number {
  return kg * 2.2046226218
}
