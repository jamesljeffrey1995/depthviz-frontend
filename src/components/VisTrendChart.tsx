import type { DayForecast } from '../types'
import { visForDay, categoriseVis, categoryColor } from '../lib/visTrend'
import styles from './VisTrendChart.module.css'

interface Props {
  days: DayForecast[]
  selectedIndex: number
  onSelect?: (index: number) => void
}

// viewBox geometry — the SVG scales to the container width while keeping this
// aspect ratio, so there is no layout shift on narrow viewports.
const W = 320
const H = 104
const PAD = { top: 16, right: 14, bottom: 24, left: 14 }
const MAX_VIS = 15

/** Compact sparkline of predicted visibility across the forecast days. */
export function VisTrendChart({ days, selectedIndex, onSelect }: Props) {
  const n = days.length
  if (n === 0) return null

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) => (n === 1 ? W / 2 : PAD.left + (i / (n - 1)) * plotW)
  const y = (vis: number) => PAD.top + (1 - Math.min(MAX_VIS, Math.max(0, vis)) / MAX_VIS) * plotH

  const points = days.map((d, i) => {
    const vis = visForDay(d)
    return { i, vis, cat: categoriseVis(vis), cx: x(i), cy: y(vis), date: d.date }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
  const areaPath = n > 1
    ? `${linePath} L${x(n - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`
    : ''

  // Thin out weekday labels when there are many days so they don't collide on
  // a phone; the selected day is always labelled.
  const labelEvery = n > 8 ? 2 : 1
  const interactive = typeof onSelect === 'function'

  return (
    <figure
      className={styles.wrap}
      aria-label={`Predicted visibility trend over ${n} day${n === 1 ? '' : 's'}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" preserveAspectRatio="xMidYMid meet">
        {/* 8 m "good" reference line */}
        <line
          x1={PAD.left} x2={W - PAD.right} y1={y(8)} y2={y(8)}
          stroke="rgba(26,138,90,0.35)" strokeWidth={1} strokeDasharray="3 3"
        />
        {areaPath && <path d={areaPath} fill="rgba(0,201,255,0.08)" />}
        {n > 1 && <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={1.5} />}

        {points.map(p => {
          const selected = p.i === selectedIndex
          const showLabel = selected || p.i % labelEvery === 0
          return (
            <g key={p.i}>
              {selected && (
                <text x={p.cx} y={p.cy - 8} textAnchor="middle" className={styles.valueLabel}>
                  {p.vis.toFixed(1)}m
                </text>
              )}
              <circle
                cx={p.cx} cy={p.cy} r={selected ? 4.5 : 3}
                fill={categoryColor(p.cat)}
                stroke={selected ? '#fff' : 'transparent'}
                strokeWidth={selected ? 1.5 : 0}
              />
              {showLabel && (
                <text
                  x={p.cx} y={H - 8} textAnchor="middle"
                  className={selected ? styles.dayLabelSelected : styles.dayLabel}
                >
                  {new Date(p.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                </text>
              )}
              {interactive && (
                <rect
                  x={p.cx - plotW / (2 * Math.max(n - 1, 1))}
                  y={0}
                  width={plotW / Math.max(n - 1, 1)}
                  height={H}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect!(p.i)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${new Date(p.date).toLocaleDateString('en-GB', { weekday: 'long' })}: ${p.vis.toFixed(1)} metres`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(p.i) }
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
