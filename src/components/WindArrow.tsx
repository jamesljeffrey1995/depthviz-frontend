interface Props {
  /** Meteorological wind direction in degrees — the bearing the wind blows
   *  *from*. The arrow points toward this bearing so it lines up visually with
   *  the compass label shown alongside (e.g. a "NW" wind points to the
   *  north-west), matching the convention used by the swell compass. */
  dir: number
  /** Pixel size of the square SVG. */
  size?: number
  className?: string
  title?: string
}

/**
 * Tiny inline arrow indicating wind direction. At dir=0 the arrow points up
 * (north); it rotates clockwise with the bearing.
 */
export function WindArrow({ dir, size = 12, className, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ transform: `rotate(${dir}deg)`, flexShrink: 0 }}
      role="img"
      aria-label={title ?? `Wind from ${Math.round(dir)} degrees`}
    >
      {title && <title>{title}</title>}
      <path d="M12 2 L18 21 L12 16 L6 21 Z" fill="currentColor" />
    </svg>
  )
}
