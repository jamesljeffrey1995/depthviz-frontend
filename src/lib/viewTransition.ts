import { flushSync } from 'react-dom'

/**
 * Run a state update inside the View Transitions API so elements tagged with
 * `view-transition-name` morph between the before/after snapshots instead of
 * hard-swapping — used for the day-selection change on the forecast screen.
 * Falls back to a plain synchronous update when the API is unsupported or the
 * user prefers reduced motion, so the update itself never depends on it.
 */
export function startDayTransition(update: () => void): void {
  const supportsViewTransition = typeof document !== 'undefined'
    && typeof document.startViewTransition === 'function'
  const prefersReduced = typeof window !== 'undefined' && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!supportsViewTransition || prefersReduced) {
    update()
    return
  }
  document.startViewTransition(() => flushSync(update))
}
