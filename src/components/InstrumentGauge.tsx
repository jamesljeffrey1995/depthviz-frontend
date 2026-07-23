import { useId } from 'react'
import styles from './InstrumentGauge.module.css'

export type GaugeConfidence = 'high' | 'medium' | 'low' | 'none'

interface Props {
  /** Current reading, metres. */
  value: number
  /** Scale max, metres — the gauge always starts at 0. */
  max?: number
  /** Severity color for the fill arc and numeral — pass a `--sev-*-face` token value. */
  color: string
  /** Track color behind the fill arc. */
  trackColor?: string
  /** Widens the "uncertainty band" straddling the needle position — the
   *  gauge's confidence signal. Omit to hide the band entirely. */
  confidence?: GaugeConfidence
  size?: number
  /** Ticks + numeral scale down or disappear below this size; thumbnails
   *  (the day strip) pass `compact` to get a bare arc, no tick labels. */
  compact?: boolean
  children?: React.ReactNode
}

const CONFIDENCE_HALFWIDTH: Record<GaugeConfidence, number> = {
  high: 5,
  medium: 12,
  low: 20,
  none: 0,
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg)
  const end = polar(cx, cy, r, endDeg)
  const large = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

// The dial is a 270° instrument sweep with a 90° gap centered at the bottom —
// a calibrated scale, not a decorative progress ring: every degree maps to a
// real metre value and the ticks/labels are load-bearing, not ornamental.
const START = 135
const SWEEP = 270

export function InstrumentGauge({ value, max = 15, color, trackColor = 'rgba(255,255,255,0.1)', confidence, size = 220, compact = false, children }: Props) {
  const uid = useId()
  const r = size / 2 - (compact ? 6 : 16)
  const cx = size / 2
  const cy = size / 2
  const clamped = Math.max(0, Math.min(max, value))
  const angleForValue = (v: number) => START + (v / max) * SWEEP
  const valueAngle = angleForValue(clamped)
  const ticks = compact ? [] : [0, max / 3, (2 * max) / 3, max]

  const bandHalf = confidence ? CONFIDENCE_HALFWIDTH[confidence] : 0
  const bandStart = Math.max(START, valueAngle - bandHalf)
  const bandEnd = Math.min(START + SWEEP, valueAngle + bandHalf)

  return (
    <svg
      className={styles.svg}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${value.toFixed(1)} of ${max} metres on the instrument scale`}
    >
      <defs>
        <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={compact ? 1.5 : 3} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track */}
      <path d={arcPath(cx, cy, r, START, START + SWEEP)} fill="none" stroke={trackColor} strokeWidth={compact ? 4 : 8} strokeLinecap="round" />

      {/* Tick marks + scale labels */}
      {ticks.map(t => {
        const a = angleForValue(t)
        const inner = polar(cx, cy, r - 7, a)
        const outer = polar(cx, cy, r + 7, a)
        const labelPos = polar(cx, cy, r + 20, a)
        return (
          <g key={t}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="var(--face-ink-faint)" strokeWidth={1.5} />
            <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle" className={styles.tickLabel}>
              {t}
            </text>
          </g>
        )
      })}

      {/* Confidence band — the uncertainty straddling the reading */}
      {bandHalf > 0 && (
        <path
          d={arcPath(cx, cy, r, bandStart, bandEnd)}
          fill="none"
          stroke={color}
          strokeOpacity={0.28}
          strokeWidth={compact ? 8 : 16}
          strokeLinecap="round"
        />
      )}

      {/* Fill — the calibrated reading itself */}
      <path
        d={arcPath(cx, cy, r, START, valueAngle)}
        fill="none"
        stroke={color}
        strokeWidth={compact ? 4 : 8}
        strokeLinecap="round"
        filter={compact ? undefined : `url(#glow-${uid})`}
      />

      {/* Needle tip */}
      {(() => {
        const tip = polar(cx, cy, r, valueAngle)
        return <circle cx={tip.x} cy={tip.y} r={compact ? 2.5 : 5} fill={color} />
      })()}

      {children && (
        <foreignObject x={0} y={0} width={size} height={size}>
          <div className={styles.center}>{children}</div>
        </foreignObject>
      )}
    </svg>
  )
}
