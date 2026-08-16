import { useEffect, useRef, useState } from 'react'

/**
 * Track an element's content width without tying data visualisations to a
 * fixed SVG coordinate system. Keeping the viewBox width in CSS pixels means
 * SVG text remains the requested size instead of growing with the container.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = (nextWidth: number) => {
      if (nextWidth > 0) setWidth(Math.round(nextWidth))
    }

    update(element.getBoundingClientRect().width)

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) update(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
