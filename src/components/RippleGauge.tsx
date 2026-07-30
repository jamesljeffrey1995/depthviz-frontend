import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { contrastAtRange } from '../lib/visibilityMath'
import styles from './RippleGauge.module.css'

/** Ranges the rings are drawn at, in metres. */
const RINGS = [2, 4, 6, 8, 10, 12] as const
/** The outermost ring, which sets the scale. */
const MAX_RANGE = 12
/** Ranges that get a printed label; all six would crowd the vertical axis. */
const LABELLED = new Set([4, 8, 12])
/** At thumbnail size six rings turn into a smudge, so the compact form thins
    them to every 4 m. */
const COMPACT_RINGS = [4, 8, 12] as const

const SIZE = 336
const CENTRE = SIZE / 2
const INNER_R = 20
const OUTER_R = 144

/** Ring radius for a range, linear in distance so the scale reads evenly. */
function radiusFor(metres: number): number {
  return INNER_R + (metres / MAX_RANGE) * (OUTER_R - INNER_R)
}

interface RippleGaugeProps {
  /** Forecast horizontal visibility, in metres. */
  vis: number
  /** Formats a metre value for display, honouring the app's ft/m setting. */
  format: (metres: number) => string
  /**
   * Thumbnail form for the day strip: three rings instead of six, no printed
   * scale, no caption, and heavier strokes so it survives being drawn at 56px.
   * The geometry is shared with the full size on purpose, so a day in the strip
   * and the same day in the hero are the same picture at two scales.
   */
  compact?: boolean
  /** Rendered width in px. Defaults to the full 336 hero size. */
  size?: number
  /** Content laid over the centre, used by the strip to show the figure. */
  children?: ReactNode
  /** Inline style, so a caller can set the clarity colour without a class. */
  style?: CSSProperties
  /**
   * Band class from `getVerdict().colorClass`, applied by the caller's stylesheet
   * to set `color`. Everything inside the gauge draws in `currentColor`, so the
   * clarity band flows through without this component knowing the ramp.
   */
  className?: string
}

/**
 * The forecast reading as a set of rings you can see through: one ring every
 * 2 m, each drawn at the contrast a target would actually retain at that range,
 * with the sight line marked where contrast reaches the threshold that defines
 * the visibility figure.
 *
 * Two passes are drawn on purpose. The faint pass keeps the 2 m scale readable
 * whatever the forecast, so the gauge never looks empty on a bad day; the lit
 * pass carries the contrast, so the fade means something. The number itself is
 * rendered by the caller alongside, not inside the rings, because a diver reads
 * the figure far more often than the picture.
 */
export function RippleGauge({ vis, format, className, compact = false, size, children, style }: RippleGaugeProps) {
  const rings = compact ? COMPACT_RINGS : RINGS
  const stroke = compact ? 7 : 2.4
  // The day strip renders one gauge per day, so a fixed gradient id would put
  // several of them in the document at once and leave url(#id) resolving to
  // whichever came first.
  const waterId = `rippleWater-${useId()}`
  // Ring spacing differs between the two sizes, and the caller may be
  // formatting in feet, so the described step is derived rather than asserted.
  const step = rings.length > 1 ? (rings[1] as number) - (rings[0] as number) : MAX_RANGE
  const sightR = radiusFor(Math.min(vis, MAX_RANGE))
  // Label sits on the ring, up and to the right, clear of the range labels.
  const labelAngle = (-40 * Math.PI) / 180
  const labelX = CENTRE + sightR * Math.cos(labelAngle)
  const labelY = CENTRE + sightR * Math.sin(labelAngle)

  return (
    <div
      className={`${styles.wrap} ${compact ? styles.compact : ''} ${className ?? ''}`}
      style={{ ...(size ? { width: size, maxWidth: size } : null), ...style }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.svg}
        role="img"
        aria-label={`Rings every ${format(step)}, fading out at about ${format(vis)}, which is how far you are expected to see`}
      >
        <defs>
          <radialGradient id={waterId} cx="42%" cy="34%" r="74%">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.20" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.06" />
          </radialGradient>
        </defs>

        <circle cx={CENTRE} cy={CENTRE} r={OUTER_R + 8} fill={`url(#${waterId})`} />

        {/* faint pass: the scale, always legible */}
        {rings.map(m => (
          <circle
            key={`scale-${m}`}
            cx={CENTRE}
            cy={CENTRE}
            r={radiusFor(m)}
            fill="none"
            stroke="var(--ink-faint)"
            strokeWidth={compact ? 3 : 1}
            opacity={0.22}
          />
        ))}

        {/* lit pass: what you can actually make out at that range */}
        {rings.map(m => (
          <circle
            key={`lit-${m}`}
            className={styles.ring}
            cx={CENTRE}
            cy={CENTRE}
            r={radiusFor(m)}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            opacity={Math.min(0.95, contrastAtRange(vis, m) * 1.5)}
          />
        ))}

        {/* the sight line: the one ring carrying the answer */}
        <circle
          className={styles.sight}
          cx={CENTRE}
          cy={CENTRE}
          r={sightR}
          fill="none"
          stroke="currentColor"
          strokeWidth={compact ? 16 : 9}
          opacity={0.16}
        />
        <circle
          className={styles.sight}
          cx={CENTRE}
          cy={CENTRE}
          r={sightR}
          fill="none"
          stroke="currentColor"
          strokeWidth={compact ? 8 : 2.6}
        />
        {!compact && (
          <>
            <circle cx={labelX} cy={labelY} r={4.5} fill="currentColor" />
            <text x={labelX + 10} y={labelY - 8} fill="currentColor" className={styles.sightLabel}>
              {format(vis)}
            </text>
          </>
        )}

        {!compact && RINGS.filter(m => LABELLED.has(m)).map(m => (
          <text
            key={`label-${m}`}
            x={CENTRE}
            y={CENTRE - radiusFor(m) - 8}
            textAnchor="middle"
            fill="var(--ink-faint)"
            className={styles.rangeLabel}
          >
            {format(m)}
          </text>
        ))}

        {!compact && (
          <>
            <circle cx={CENTRE} cy={CENTRE} r={14} fill="currentColor" opacity={0.14} />
            <circle cx={CENTRE} cy={CENTRE} r={4.5} fill="currentColor" />
          </>
        )}
      </svg>
      {children && <div className={styles.overlay}>{children}</div>}
      {!compact && (
        <p className={styles.caption}>
          Rings every {format(step)}. The solid ring is your sight line.
        </p>
      )}
    </div>
  )
}
