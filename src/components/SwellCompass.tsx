import type { SwellComponent } from '../types'

interface Props {
  components: SwellComponent[]
  windDir: number
  /** Display unit for component heights — must match the unit the API was
   *  asked to return (`/forecast?units=ft|m`). Defaults to 'm' for backwards
   *  compatibility with callers that haven't been updated. */
  units?: 'ft' | 'm'
}

// primary reuses the system accent; secondary/wind_wave are a small
// categorical (non-severity) palette distinguishing swell component types —
// not a good/bad scale, so they intentionally don't route through --sev-*.
const COLORS: Record<string, string> = {
  primary: 'var(--accent)',
  secondary: '#7a6a2e',
  wind_wave: '#3d5a73',
}

const SIZE = 160
const CX = SIZE / 2
const CY = SIZE / 2
const RING_R = 62
const LABEL_R = 72
const TICK_INNER = 56
const TICK_OUTER = 62

const CARDINALS = [
  { label: 'N', deg: 0 },
  { label: 'E', deg: 90 },
  { label: 'S', deg: 180 },
  { label: 'W', deg: 270 },
]

function arrowPath(length: number): string {
  const tipY = -length
  const baseY = 0
  const halfW = 4
  return `M0,${baseY} L-${halfW},${baseY + 8} L0,${tipY} L${halfW},${baseY + 8} Z`
}

export function SwellCompass({ components, windDir, units = 'm' }: Props) {
  // Find max height to scale arrows
  const maxHeight = Math.max(...components.map(c => c.height), 0.5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ overflow: 'visible' }}
      >
        {/* Background circle */}
        <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke="rgba(16,24,32,0.15)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={RING_R * 0.5} fill="none" stroke="rgba(16,24,32,0.08)" strokeWidth="1" strokeDasharray="2 3" />

        {/* Cardinal ticks + labels */}
        {CARDINALS.map(({ label, deg }) => {
          const rad = (deg - 90) * Math.PI / 180
          const x1 = CX + TICK_INNER * Math.cos(rad)
          const y1 = CY + TICK_INNER * Math.sin(rad)
          const x2 = CX + TICK_OUTER * Math.cos(rad)
          const y2 = CY + TICK_OUTER * Math.sin(rad)
          const lx = CX + LABEL_R * Math.cos(rad)
          const ly = CY + LABEL_R * Math.sin(rad)
          return (
            <g key={label}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(16,24,32,0.4)" strokeWidth="1" />
              <text
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--ink-dim)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* Intercardinal ticks */}
        {[45, 135, 225, 315].map(deg => {
          const rad = (deg - 90) * Math.PI / 180
          const x1 = CX + (TICK_INNER + 2) * Math.cos(rad)
          const y1 = CY + (TICK_INNER + 2) * Math.sin(rad)
          const x2 = CX + TICK_OUTER * Math.cos(rad)
          const y2 = CY + TICK_OUTER * Math.sin(rad)
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(16,24,32,0.22)" strokeWidth="1" />
        })}

        {/* Wind direction indicator (thin dashed line) */}
        <g transform={`translate(${CX},${CY}) rotate(${windDir})`}>
          <line x1="0" y1="0" x2="0" y2={-RING_R + 5} stroke="rgba(16,24,32,0.3)" strokeWidth="1" strokeDasharray="3 3" />
          <text
            x="0" y={-RING_R + 14}
            textAnchor="middle"
            fill="var(--ink-faint)"
            fontSize="7"
            fontFamily="var(--font-mono)"
          >
            wind
          </text>
        </g>

        {/* Swell component arrows */}
        {components.map((c) => {
          if (c.direction == null) return null
          const color = COLORS[c.type] ?? 'var(--accent)'
          const lengthPct = Math.max(0.3, c.height / maxHeight)
          const arrowLen = 12 + lengthPct * 36

          return (
            <g key={c.type} transform={`translate(${CX},${CY}) rotate(${c.direction})`}>
              <path
                d={arrowPath(arrowLen)}
                fill={color}
                fillOpacity={0.85}
                stroke={color}
                strokeWidth="0.5"
              />
            </g>
          )
        })}

        {/* Centre dot */}
        <circle cx={CX} cy={CY} r="2" fill="var(--ink-faint)" />
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
        {components.map(c => {
          const color = COLORS[c.type] ?? 'var(--accent)'
          return (
            <div key={c.type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', background: color, borderRadius: 'var(--radius-sm)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--ink-dim)' }}>
                {c.label}: <span style={{ color }}>{c.height.toFixed(1)}{units}</span>
                {c.dir_label && <span style={{ color: 'var(--ink-faint)' }}> {c.dir_label} {Math.round(c.direction!)}°</span>}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
