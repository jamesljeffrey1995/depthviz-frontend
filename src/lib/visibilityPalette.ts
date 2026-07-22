/** Shared visibility rating colour-class helper.
 *
 *  The forecast API tags each day with a `color_class` bucket. Components map
 *  that bucket to a CSS class whose colour is defined per-module (mirroring the
 *  shared palette in index.css: --danger / --warn / --good / --excellent).
 *  Keeping the allow-list and fallback here means both the Best Visibility page
 *  and the homepage teaser stay in lockstep when a new bucket is added. */
export const VIS_COLOR_CLASSES = new Set([
  'blocked', 'poor', 'marginal', 'decent', 'good', 'excellent',
])

/** Coerce an API-supplied colour class to a known bucket, defaulting to the
 *  neutral 'decent' when the value is missing or unrecognised. */
export function safeColorClass(cls: string | undefined): string {
  return cls && VIS_COLOR_CLASSES.has(cls) ? cls : 'decent'
}
