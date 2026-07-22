interface Props {
  /** Meteorological wind direction in degrees — the bearing the wind blows
   *  *from*. The arrow points toward this bearing so it lines up with the
   *  compass label shown alongside (e.g. a "NW" wind points to the
   *  north-west), matching the convention used by the swell compass. */
  dir: number
  /** Pixel size of the square SVG. */
  size?: number
  className?: string
  /** Optional hover tooltip text. The arrow is decorative for screen readers
   *  (aria-hidden) — surrounding text is expected to convey the direction. */
  title?: string
}

/**
 * Tiny inline arrow indicating wind direction. At dir=0 the arrow points up
 * (north); it rotates clockwise with the bearing. Rotation is applied via an
 * SVG transform around the viewBox centre (12,12) so it is deterministic
 * across browsers, rather than relying on CSS transform-origin.
 */
export function WindArrow({ dir, size = 12, className, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      {title && <title>{title}</title>}
      <g transform={`rotate(${dir} 12 12)`}>
        <path d="M12 2 L18 21 L12 16 L6 21 Z" fill="currentColor" />
      </g>
    </svg>
  )
}
