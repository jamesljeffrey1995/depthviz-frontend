import type { DayForecast } from '../types'
import { visForDay, categoriseVis, categoryColor, weekdayShort, weekdayLong } from '../lib/visTrend'
import { visibilityInUnits } from '../lib/units'
import { useElementWidth } from '../hooks/useElementWidth'
import styles from './VisTrendChart.module.css'

interface Props {
  days: DayForecast[]
  selectedIndex: number
  onSelect?: (index: number) => void
  units?: 'ft' | 'm'
}

const H = 132
const PAD = { top: 28, right: 10, bottom: 28, left: 44 }
const MAX_VIS = 15
const MIN_LABEL_SPACING = 54

/** Compact sparkline of predicted visibility across the forecast days. */
export function VisTrendChart({ days, selectedIndex, onSelect, units = 'm' }: Props) {
  const { ref: chartRef, width: measuredWidth } = useElementWidth<HTMLDivElement>()
  const n = days.length
  if (n === 0) return null

  const W = Math.max(280, measuredWidth)
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const slotW = plotW / n
  const x = (i: number) => PAD.left + (i + 0.5) * slotW
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
  const maxLabels = Math.max(2, Math.floor(plotW / MIN_LABEL_SPACING))
  const labelEvery = Math.max(1, Math.ceil(n / maxLabels))
  const selectedX = x(Math.min(Math.max(selectedIndex, 0), n - 1))
  const interactive = typeof onSelect === 'function'
  const referenceLabel = `${visibilityInUnits(8, units).toFixed(0)}${units}`

  return (
    <figure className={styles.wrap}>
      <figcaption className={styles.caption}>
        <span>Visibility outlook</span>
        <span className={styles.referenceKey}>{referenceLabel}+ clear-water guide</span>
      </figcaption>
      <div className={styles.chart} ref={chartRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={styles.svg}
          preserveAspectRatio="none"
          role={interactive ? 'group' : 'img'}
          aria-label={`Predicted visibility trend over ${n} day${n === 1 ? '' : 's'}`}
        >
        {/* 8 m "good" reference line */}
        <line
          x1={PAD.left} x2={W - PAD.right} y1={y(8)} y2={y(8)}
          stroke="var(--sev-good)" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="3 3"
        />
        <text x={PAD.left - 8} y={y(8) + 4} textAnchor="end" className={styles.refLabel}>{referenceLabel}</text>
        {areaPath && <path d={areaPath} fill="var(--accent)" fillOpacity={0.1} />}
        {n > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map(p => {
          const selected = p.i === selectedIndex
          const showLabel = selected
            || (p.i % labelEvery === 0 && Math.abs(p.cx - selectedX) >= MIN_LABEL_SPACING)
          return (
            <g key={p.i}>
              {selected && (
                <text x={p.cx} y={p.cy - 8} textAnchor="middle" className={styles.valueLabel}>
                  {visibilityInUnits(p.vis, units).toFixed(1)}{units}
                </text>
              )}
              <circle
                cx={p.cx} cy={p.cy} r={selected ? 4.5 : 3}
                fill={categoryColor(p.cat)}
                stroke={selected ? 'var(--paper)' : 'transparent'}
                strokeWidth={selected ? 1.5 : 0}
              />
              {showLabel && (
                <text
                  x={p.cx} y={H - 8} textAnchor="middle"
                  className={selected ? styles.dayLabelSelected : styles.dayLabel}
                >
                  {weekdayShort(p.date)}
                </text>
              )}
              {interactive && (
                <rect
                  x={PAD.left + p.i * slotW}
                  y={0}
                  width={slotW}
                  height={H}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect!(p.i)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${weekdayLong(p.date)}: ${visibilityInUnits(p.vis, units).toFixed(1)} ${units === 'ft' ? 'feet' : 'metres'}`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(p.i) }
                  }}
                />
              )}
            </g>
          )
        })}
        </svg>
      </div>
    </figure>
  )
}
