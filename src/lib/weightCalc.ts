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

/**
 * Individually-selectable neoprene regions on the body figure. "body" covers
 * the torso and arms together (a wetsuit jacket), which is how two-piece
 * freediving suits are actually cut.
 */
export type SuitRegion = 'hood' | 'body' | 'legs'

/** Ordered region keys (used to iterate deterministically). */
export const SUIT_REGIONS: SuitRegion[] = ['hood', 'body', 'legs']

/** Per-region neoprene thickness in mm (0 or absent = bare skin there). */
export type SuitRegions = Partial<Record<SuitRegion, number>>

export interface WeightCalcInput {
  /** Standing height in centimetres. */
  heightCm: number
  /** Body weight in kilograms. */
  weightKg: number
  /** Body composition / build. */
  build: Build
  /**
   * Per-region neoprene thickness in millimetres. This is the preferred way to
   * describe the suit — the diver sets the thickness of the hood, torso, arms
   * and legs independently. When present it overrides `suitType` / `wetsuitMm`.
   */
  regions?: SuitRegions
  /**
   * Wetsuit neoprene thickness in millimetres (0 = no suit).
   * Legacy single-thickness model, used only when `regions` is not supplied.
   */
  wetsuitMm?: number
  /**
   * How much of the body the suit covers.
   * Legacy coverage model, used only when `regions` is not supplied.
   */
  suitType?: SuitType
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

/**
 * Fraction of total body surface area covered by each region. Body (torso +
 * arms) and legs sum to 1.0 (a full suit), and the hood adds 0.12 on top — so
 * a uniform 5 mm full suit + hood matches the legacy `fullHood` coverage of
 * 1.12.
 */
export const REGION_COVERAGE: Record<SuitRegion, number> = {
  hood: 0.12,
  body: 0.58,
  legs: 0.42,
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
 * The result is floored at 0 kg and can round down to 0 for a diver who is
 * barely buoyant at the target depth (e.g. lean build, no wetsuit, deep target).
 */
export function calculateWeight(input: WeightCalcInput): WeightCalcResult {
  const heightCm = clamp(input.heightCm, 120, 230)
  const weightKg = clamp(input.weightKg, 35, 200)
  const depthM = clamp(input.neutralDepthM, 0, 40)

  const bsa = bodySurfaceArea(heightCm, weightKg)

  // Suit buoyancy at the surface, then compressed to depth. Two ways to
  // describe the suit: the per-region thickness model (preferred) or the
  // legacy single-thickness + coverage model.
  const suitBuoyancySurface = SUIT_K * bsa * coveredThicknessMm(input)
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

/**
 * Coverage-weighted neoprene thickness (mm) for the whole body. Multiplying by
 * SUIT_K and BSA gives the suit's surface buoyancy. Uses the per-region model
 * when `regions` is supplied, otherwise falls back to the legacy suit type.
 */
function coveredThicknessMm(input: WeightCalcInput): number {
  if (input.regions) {
    let weighted = 0
    for (const region of SUIT_REGIONS) {
      const mm = clamp(input.regions[region] ?? 0, 0, 8)
      weighted += mm * REGION_COVERAGE[region]
    }
    return weighted
  }
  const suitType = input.suitType ?? 'none'
  // No-suit selection overrides any thickness value.
  const mm = suitType === 'none' ? 0 : clamp(input.wetsuitMm ?? 0, 0, 8)
  return mm * SUIT_COVERAGE[suitType]
}

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo
  return Math.min(hi, Math.max(lo, v))
}

/** kg → lb. */
export function kgToLb(kg: number): number {
  return kg * 2.2046226218
}
