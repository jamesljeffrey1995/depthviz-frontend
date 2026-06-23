import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query and re-render when it changes.
 *
 * Used to drive the adaptive list-detail layout: the map + forecast split view
 * is a width decision, not a device or orientation one, so the same query also
 * collapses the panes back to a single column under high zoom or in tablet
 * split-screen (keeping WCAG Reflow and Orientation satisfied).
 *
 * SSR-safe: returns `false` until mounted, then reads the real value.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
