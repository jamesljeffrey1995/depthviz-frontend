import type { DayForecast } from '../types'
import { weekdayShort, weekdayLong } from '../lib/visTrend'
import styles from './SwellChart.module.css'

interface Props {
  days: DayForecast[]
  selectedIndex: number
  onSelect?: (index: number) => void
  units?: 'ft' | 'm'
}

const W = 320
const H = 108
const PAD = { top: 22, right: 30, bottom: 24, left: 14 }
const FT_PER_M = 3.28084

function maxScale(units: 'ft' | 'm') {
  return units === 'ft' ? 4 * FT_PER_M : 4
}

function swellColor(heightInDisplayUnits: number, units: 'ft' | 'm'): string {
  const m = units === 'ft' ? heightInDisplayUnits / FT_PER_M : heightInDisplayUnits
  if (m < 0.5) return '#1a8a5a'
  if (m < 1.0) return '#d4850a'
  if (m < 1.5) return '#e06c00'
  return '#c0392b'
}

/** Compact bar chart: swell height (solid) + wave height (translucent) per day. */
export function SwellChart({ days, selectedIndex, onSelect, units = 'm' }: Props) {
  const n = days.length
  if (n === 0) return null

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const scale = maxScale(units)
  const barW = Math.min(20, (plotW / n) * 0.58)
  const baseline = PAD.top + plotH

  const cx = (i: number) =>
    n === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (n - 1)) * plotW

  const yVal = (v: number) =>
    baseline - (Math.min(scale, Math.max(0, v)) / scale) * plotH

  // Reference lines — 1 m and 1.5 m converted to display units
  const ref1  = units === 'ft' ? 1.0 * FT_PER_M : 1.0
  const ref15 = units === 'ft' ? 1.5 * FT_PER_M : 1.5
  const y1   = yVal(ref1)
  const y15  = yVal(ref15)
  const ref1Label  = units === 'ft' ? '3ft'  : '1m'
  const ref15Label = units === 'ft' ? '5ft'  : '1.5m'

  const labelEvery = n > 8 ? 2 : 1
  const interactive = typeof onSelect === 'function'

  return (
    <figure className={styles.wrap}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>Swell &amp; Waves</span>
        <span className={styles.legend}>
          <span className={styles.legendSwell}>&#9646; swell</span>
          <span className={styles.legendWave}>&#9646; wave</span>
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        preserveAspectRatio="xMidYMid meet"
        role={interactive ? 'group' : 'img'}
        aria-label={`Swell and wave height forecast over ${n} days`}
      >
        {/* Reference lines */}
        <line
          x1={PAD.left} x2={W - PAD.right} y1={y15} y2={y15}
          stroke="rgba(192,57,43,0.45)" strokeWidth={1} strokeDasharray="3 3"
        />
        <line
          x1={PAD.left} x2={W - PAD.right} y1={y1} y2={y1}
          stroke="rgba(212,133,10,0.45)" strokeWidth={1} strokeDasharray="3 3"
        />
        <text x={W - PAD.right + 3} y={y15 + 3.5} className={styles.refLabel}>{ref15Label}</text>
        <text x={W - PAD.right + 3} y={y1  + 3.5} className={styles.refLabel}>{ref1Label}</text>

        {days.map((d, i) => {
          const bx    = cx(i)
          const swell = d.swell_height
          const wave  = d.wave_height
          const color = swellColor(swell, units)
          const sel   = i === selectedIndex
          const showLabel = sel || i % labelEvery === 0

          const swellTop = yVal(swell)
          const waveTop  = yVal(wave)
          const swellH   = Math.max(2, baseline - swellTop)
          const waveH    = Math.max(2, baseline - waveTop)
          const topY     = Math.min(swellTop, waveTop)

          // Annotate selected day: "1.4m · 12s" or just "1.4m"
          const dominant = Math.max(swell, wave)
          const annot = d.swell_period != null
            ? `${dominant.toFixed(1)}${units}·${Math.round(d.swell_period)}s`
            : `${dominant.toFixed(1)}${units}`
          const annotY = Math.max(PAD.top - 2, topY - 5)

          return (
            <g key={i}>
              {/* Wave bar — wider, translucent (drawn first so swell overlaps) */}
              <rect
                x={bx - barW / 2 - 2}
                y={waveTop}
                width={barW + 4}
                height={waveH}
                fill={`${color}28`}
                rx={2}
              />
              {/* Swell bar — solid */}
              <rect
                x={bx - barW / 2}
                y={swellTop}
                width={barW}
                height={swellH}
                fill={color}
                opacity={sel ? 1 : 0.78}
                rx={2}
                stroke={sel ? 'rgba(255,255,255,0.55)' : 'transparent'}
                strokeWidth={sel ? 1 : 0}
              />

              {sel && (
                <text x={bx} y={annotY} textAnchor="middle" className={styles.valueLabel}>
                  {annot}
                </text>
              )}

              {showLabel && (
                <text
                  x={bx} y={H - 8} textAnchor="middle"
                  className={sel ? styles.dayLabelSelected : styles.dayLabel}
                >
                  {weekdayShort(d.date)}
                </text>
              )}

              {interactive && (
                <rect
                  x={bx - plotW / (2 * Math.max(n - 1, 1))}
                  y={0}
                  width={plotW / Math.max(n - 1, 1)}
                  height={H}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect!(i)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={sel}
                  aria-label={`${weekdayLong(d.date)}: swell ${swell.toFixed(1)}${units}, waves ${wave.toFixed(1)}${units}`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(i) }
                  }}
                />
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
