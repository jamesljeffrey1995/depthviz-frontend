import type { SuspicionBand } from '../../types'
import styles from './TrafficAnalytics.module.css'

// Design-token palette. Series hues come from the categorical ramp (--ds-cat-*);
// ok/warning/danger are genuine status; grid/axis and text use the chart and
// neutral tokens so the charts theme correctly. All are consumed in inline SVG
// or inline styles where var() resolves.
export const COLORS = {
  accent: 'var(--ds-cat-1)',
  ok: 'var(--ds-success)',
  warning: 'var(--ds-warn)',
  danger: 'var(--ds-danger)',
  purple: 'var(--ds-cat-4)',
  grid: 'var(--ds-chart-grid)',
  axis: 'var(--ds-chart-axis)',
}

// ── Suspicion chip ───────────────────────────────────────────────────────────

const BAND_LABEL: Record<SuspicionBand, string> = {
  normal: 'Normal',
  monitor: 'Monitor',
  suspicious: 'Suspicious',
  likely_scraper: 'Likely scraper',
}

const BAND_CLASS: Record<SuspicionBand, string> = {
  normal: styles.susNormal ?? '',
  monitor: styles.susMonitor ?? '',
  suspicious: styles.susSuspicious ?? '',
  likely_scraper: styles.susScraper ?? '',
}

export function SuspicionChip({ score, band }: { score: number; band: SuspicionBand }) {
  return (
    <span className={`${styles.susChip} ${BAND_CLASS[band]}`} title={`${BAND_LABEL[band]} — score ${score}`}>
      {score} · {BAND_LABEL[band]}
    </span>
  )
}

// ── Stat tile ────────────────────────────────────────────────────────────────

export function StatTile({
  label, value, sub, tone,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'warn' | 'bad' | 'good'
}) {
  const toneCls = tone === 'warn' ? styles.warn : tone === 'bad' ? styles.bad : tone === 'good' ? styles.good : ''
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={`${styles.tileValue} ${toneCls}`}>{value}</div>
      {sub && <div className={styles.tileSub}>{sub}</div>}
    </div>
  )
}

// ── Multi-series line chart ──────────────────────────────────────────────────

interface SeriesSpec<T> {
  key: keyof T
  label: string
  color: string
  fill?: boolean
}

const W = 640
const H = 220
const PAD = { top: 14, right: 14, bottom: 26, left: 42 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

export function LineChart<T>({
  data, series, yLabel, timeKey = 't' as keyof T, valueSuffix = '',
}: {
  data: T[]
  series: SeriesSpec<T>[]
  yLabel?: string
  timeKey?: keyof T
  valueSuffix?: string
}) {
  if (data.length === 0) return <div className={styles.empty}>No data in range</div>

  const maxY = Math.max(
    1,
    ...data.flatMap(d => series.map(s => Number(d[s.key]) || 0)),
  )
  const niceMax = niceCeil(maxY)
  const n = data.length
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * CW)
  const y = (v: number) => PAD.top + CH - (v / niceMax) * CH

  const ticks = axisTicks(niceMax, 4)
  const xLabelIdx = labelIndices(n, 5)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={yLabel || 'time series'}>
        {ticks.map(t => (
          <g key={`y${t}`}>
            <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke={COLORS.grid} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fill={COLORS.axis} fontSize="9" fontFamily="monospace">
              {fmtCompact(t)}{valueSuffix}
            </text>
          </g>
        ))}
        {xLabelIdx.map(i => (
          <text key={`x${i}`} x={x(i)} y={H - PAD.bottom + 14} textAnchor="middle" fill={COLORS.axis} fontSize="8" fontFamily="monospace">
            {fmtTime(data[i]?.[timeKey] as string)}
          </text>
        ))}
        {series.map(s => {
          const pts = data.map((d, i) => `${x(i)},${y(Number(d[s.key]) || 0)}`).join(' ')
          const area = `${PAD.left},${y(0)} ${pts} ${x(n - 1)},${y(0)}`
          return (
            <g key={String(s.key)}>
              {s.fill && <polygon points={area} fill={s.color} opacity={0.12} />}
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="1.6" />
            </g>
          )
        })}
      </svg>
      <div className={styles.legend}>
        {series.map(s => (
          <span key={String(s.key)} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Horizontal bar list ──────────────────────────────────────────────────────

export function BarList({
  rows, valueSuffix = '', color = COLORS.accent,
}: {
  rows: { label: string; value: number }[]
  valueSuffix?: string
  color?: string
}) {
  if (rows.length === 0) return <div className={styles.empty}>No data</div>
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 90, fontFamily: 'monospace', fontSize: 11, color: 'var(--ds-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
            {r.label}
          </span>
          <div style={{ flex: 1, height: 10, background: 'var(--ds-surface-sunken)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', background: color, opacity: 0.75 }} />
          </div>
          <span style={{ width: 56, textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: 'var(--ds-text-strong)' }}>
            {fmtCompact(r.value)}{valueSuffix}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Formatting helpers ───────────────────────────────────────────────────────

export function fmtCompact(v: number | null | undefined): string {
  if (v == null) return '—'
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return `${Math.round(v * 10) / 10}`
}

export function fmtTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const secs = (Date.now() - new Date(iso).getTime()) / 1000
  if (secs < 60) return `${Math.max(0, Math.round(secs))}s ago`
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`
  return `${Math.round(secs / 86400)}d ago`
}

function niceCeil(v: number): number {
  if (v <= 5) return 5
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  return Math.ceil(v / mag) * mag
}

function axisTicks(max: number, count: number): number[] {
  const step = max / count
  return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i))
}

function labelIndices(n: number, count: number): number[] {
  if (n <= count) return Array.from({ length: n }, (_, i) => i)
  const step = (n - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(i * step))
}
