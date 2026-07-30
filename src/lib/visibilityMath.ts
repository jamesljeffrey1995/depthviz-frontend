// Pure numerical helpers for the underwater-visibility analysis.
// Kept free of OpenCV / DOM imports so they can be unit-tested directly
// (the worker that uses them cannot be imported under vitest).

/** Linear-interpolated percentile of an already-ascending-sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const loV = sorted[lo]
  const hiV = sorted[hi]
  if (loV === undefined || hiV === undefined) return 0
  if (lo === hi) return loV
  return loV + (hiV - loV) * (idx - lo)
}

// Transmission must stay strictly inside (0, 1) before taking the log:
//  - at t = 1, -log(t) is -0, so calib / -0 = -Infinity
//  - at t = 0, -log(t) is +Infinity, so calib / +Infinity = 0
// Either extreme poisons the aggregate stats (mean → ±Infinity, and a
// percentile interpolated between two Infinities → NaN), which is what
// produced the "-Infinity m" / "NaN" headline for near-clear footage.
const T_FLOOR = 0.01
const T_CEIL = 0.99

// Clear water beyond this is not meaningful for temperate diving and is
// flagged as "not underwater" by validation; capping keeps a degenerate
// clear-video result a believable number rather than hundreds of metres.
const MAX_VISIBILITY_M = 50

/** Beer–Lambert visibility (metres) from a median transmission. Always finite. */
export function beerLambert(tMedian: number, calib: number): number {
  const t = Math.min(Math.max(tMedian, T_FLOOR), T_CEIL)
  return Math.min(calib / -Math.log(t), MAX_VISIBILITY_M)
}

/**
 * Contrast threshold that *defines* a visibility range: the point at which a
 * target's contrast against the background has decayed enough that a diver can
 * no longer make it out. 5% (Duntley's widely used sighting threshold) is what
 * the reported visibility figure means, so anything drawing "how far can I see"
 * has to use the same number or it will contradict the headline.
 */
export const CONTRAST_THRESHOLD = 0.05

/**
 * The forward direction of the same Beer–Lambert relation: given a visibility
 * in metres, how much of a target's contrast survives at `rangeM`.
 *
 * `beerLambert` above runs this backwards, turning a measured transmission from
 * dive video into a visibility. This runs it forwards, turning a forecast
 * visibility into what the diver will actually be able to pick out at 2 m, 4 m,
 * 6 m and so on. Keeping both directions in one module is deliberate: the
 * forecast display and the video analyser must not disagree about the physics.
 *
 * Attenuation follows from the definition of visibility: contrast falls to
 * CONTRAST_THRESHOLD at exactly `visibilityM`, so c = ln(1/0.05) / visibility.
 * Returns a value in (0, 1]; range 0 is full contrast.
 */
export function contrastAtRange(visibilityM: number, rangeM: number): number {
  if (rangeM <= 0) return 1
  const vis = Math.max(visibilityM, 0.2)
  const attenuation = Math.log(1 / CONTRAST_THRESHOLD) / vis
  return Math.exp(-attenuation * rangeM)
}

// Scattering coefficient ω in the dark-channel transmission map. Kept just below
// 1 so even the clearest patch retains a little haze (a fully transparent t = 1
// is physically unreachable underwater and would blow visibility up to the cap).
const OMEGA = 0.95

/** Haze transmission t from a (normalised) dark-channel value d, t = 1 − ω·d,
 *  clamped to [0, 1]. Low dark channel → t near 1 (clear); high dark channel →
 *  t low (turbid). With the Underwater DCP the dark channel is taken over the
 *  green and blue channels only, so d reflects real backscatter rather than the
 *  absorbed (near-zero) red channel that pinned t at 1 for genuine footage. */
export function transmissionFromDarkChannel(darkChannel: number, omega: number = OMEGA): number {
  return Math.max(0, Math.min(1, 1 - omega * darkChannel))
}
