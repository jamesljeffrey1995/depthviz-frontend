import { useState } from 'react'
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
const H = 100
const PAD = { top: 16, right: 30, bottom: 24, left: 14 }
const FT_PER_M = 3.28084

const COLORS = {
  calm:     '#1a8a5a',
  light:    '#d4850a',
  moderate: '#e06c00',
  rough:    '#c0392b',
}

function maxScale(units: 'ft' | 'm') {
  return units === 'ft' ? 4 * FT_PER_M : 4
}

function swellColor(heightInDisplayUnits: number, units: 'ft' | 'm'): string {
  const m = units === 'ft' ? heightInDisplayUnits / FT_PER_M : heightInDisplayUnits
  if (m < 0.5) return COLORS.calm
  if (m < 1.0) return COLORS.light
  if (m < 1.5) return COLORS.moderate
  return COLORS.rough
}

export function SwellChart({ days, selectedIndex, onSelect, units = 'm' }: Props) {
  const [showInfo, setShowInfo] = useState(false)
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

  const ref1  = units === 'ft' ? 1.0 * FT_PER_M : 1.0
  const ref15 = units === 'ft' ? 1.5 * FT_PER_M : 1.5
  const y1    = yVal(ref1)
  const y15   = yVal(ref15)
  const ref1Label  = units === 'ft' ? '3ft'  : '1m'
  const ref15Label = units === 'ft' ? '5ft'  : '1.5m'

  const labelEvery = n > 8 ? 2 : 1
  const interactive = typeof onSelect === 'function'

  const t1 = units === 'ft' ? '1.6ft' : '0.5m'
  const t2 = units === 'ft' ? '3.3ft' : '1m'
  const t3 = units === 'ft' ? '5ft'   : '1.5m'

  const selDay    = days[selectedIndex]
  const selSwell  = selDay?.swell_height ?? null
  const selWave   = selDay?.wave_height  ?? null
  const selPeriod = selDay?.swell_period ?? null

  return (
    <figure className={styles.wrap}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>Swell &amp; Waves</span>
        <span className={styles.captionRight}>
          <span className={styles.legend}>
            <span className={styles.legendSwell}>&#9646; swell</span>
            <span className={styles.legendWave}>&#9646; wave</span>
          </span>
          <button
            className={styles.infoBtn}
            onClick={() => setShowInfo(v => !v)}
            aria-expanded={showInfo}
            aria-label="How to read this chart"
          >
            &#9432;
          </button>
        </span>
      </figcaption>

      {showInfo && (
        <div className={styles.infoPanel}>
          <div className={styles.infoRow}>
            <span className={styles.swatchSolid} />
            <span><strong>Solid bar</strong> = swell height &mdash; travels from distant storms, stirs up sediment and kills visibility</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.swatchGhost} />
            <span><strong>Ghost bar</strong> = wave height &mdash; local wind chop, less impact at depth</span>
          </div>
          <div className={styles.infoColorScale}>
            <span className={styles.colorChip} style={{ background: COLORS.calm }} />
            <span className={styles.colorLabel}>Calm<br /><span className={styles.colorThresh}>&lt;{t1}</span></span>
            <span className={styles.colorChip} style={{ background: COLORS.light }} />
            <span className={styles.colorLabel}>Light<br /><span className={styles.colorThresh}>{t1}&ndash;{t2}</span></span>
            <span className={styles.colorChip} style={{ background: COLORS.moderate }} />
            <span className={styles.colorLabel}>Moderate<br /><span className={styles.colorThresh}>{t2}&ndash;{t3}</span></span>
            <span className={styles.colorChip} style={{ background: COLORS.rough }} />
            <span className={styles.colorLabel}>Rough<br /><span className={styles.colorThresh}>&ge;{t3}</span></span>
          </div>
        </div>
      )}

      {selSwell !== null && selWave !== null && (
        <div className={styles.annotPanel}>
          <span className={styles.annotDay}>{weekdayShort(selDay?.date ?? '')}</span>
          <span className={styles.annotSep} />
          <span className={styles.annotItem}>
            <span className={styles.annotKey}>S</span>
            <span className={styles.annotVal}>
              {selSwell.toFixed(1)}{units}
              {selPeriod != null && (
                <span className={styles.annotPeriod}> &middot; {Math.round(selPeriod)}s</span>
              )}
            </span>
          </span>
          <span className={styles.annotSep} />
          <span className={styles.annotItem}>
            <span className={styles.annotKey}>W</span>
            <span className={styles.annotVal}>{selWave.toFixed(1)}{units}</span>
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        preserveAspectRatio="xMidYMid meet"
        role={interactive ? 'group' : 'img'}
        aria-label={`Swell and wave height forecast over ${n} days`}
      >
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
          const showLabel = i % labelEvery === 0

          const swellTop = yVal(swell)
          const waveTop  = yVal(wave)
          const swellH   = Math.max(2, baseline - swellTop)
          const waveH    = Math.max(2, baseline - waveTop)

          return (
            <g key={i}>
              <rect
                x={bx - barW / 2 - 2} y={waveTop}
                width={barW + 4} height={waveH}
                fill={`${color}28`} rx={2}
              />
              <rect
                x={bx - barW / 2} y={swellTop}
                width={barW} height={swellH}
                fill={color} opacity={sel ? 1 : 0.78} rx={2}
                stroke={sel ? 'rgba(255,255,255,0.55)' : 'transparent'}
                strokeWidth={sel ? 1 : 0}
              />
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
