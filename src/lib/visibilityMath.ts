// Pure numerical helpers for the underwater-visibility analysis.
// Kept free of OpenCV / DOM imports so they can be unit-tested directly
// (the worker that uses them cannot be imported under vitest).

/** Linear-interpolated percentile of an already-ascending-sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
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
