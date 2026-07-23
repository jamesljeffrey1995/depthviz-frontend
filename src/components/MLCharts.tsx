import { useState, useEffect } from 'react'
import { getMLPredictions, getFeatureImportance, quarantineReport } from '../lib/api'
import type {
  MLPredictionPoint, MLTrainingLogEntry, FeatureImportance,
  MLResidual, MLResidualSummary,
} from '../types'
import styles from './MLCharts.module.css'

// ── Shared constants ─────────────────────────────────────────────────────────
const W = 600
const H = 300
const PAD = { top: 20, right: 20, bottom: 40, left: 45 }
const CW = W - PAD.left - PAD.right  // chart width
const CH = H - PAD.top - PAD.bottom   // chart height

// ── Scatter Plot: Actual vs Predicted ────────────────────────────────────────

interface ScatterProps {
  points: MLPredictionPoint[]
}

function ScatterPlot({ points }: ScatterProps) {
  if (points.length === 0) return <div className={styles.empty}>No prediction data</div>

  const maxVal = Math.ceil(Math.max(
    ...points.map(p => Math.max(p.actual, p.predicted)),
    1,
  ))
  const minVal = 0

  const scale = (v: number) => ((v - minVal) / (maxVal - minVal))

  // Y-axis ticks
  const step = maxVal > 10 ? 2 : 1
  const ticks = []
  for (let v = minVal; v <= maxVal; v += step) ticks.push(v)

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitle}>Actual vs Predicted Visibility</div>
      <div className={styles.chartSubtitle}>Points on the diagonal = perfect predictions</div>
      <div className={styles.chartWrapper}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
          {/* Grid lines */}
          {ticks.map(v => {
            const y = PAD.top + CH - scale(v) * CH
            return (
              <g key={`y-${v}`}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(14, 124, 134,0.06)" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fill="rgba(139,184,204,0.4)" fontSize="9" fontFamily="monospace">{v}m</text>
              </g>
            )
          })}
          {ticks.map(v => {
            const x = PAD.left + scale(v) * CW
            return (
              <g key={`x-${v}`}>
                <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke="rgba(14, 124, 134,0.06)" />
                <text x={x} y={H - PAD.bottom + 14} textAnchor="middle" fill="rgba(139,184,204,0.4)" fontSize="9" fontFamily="monospace">{v}m</text>
              </g>
            )
          })}

          {/* Perfect prediction line (diagonal) */}
          <line
            x1={PAD.left}
            y1={PAD.top + CH}
            x2={PAD.left + CW}
            y2={PAD.top}
            stroke="rgba(14, 124, 134,0.2)"
            strokeWidth="1"
            strokeDasharray="6,4"
          />

          {/* Data points */}
          {points.map((p, i) => {
            const x = PAD.left + scale(p.predicted) * CW
            const y = PAD.top + CH - scale(p.actual) * CH
            const err = Math.abs(p.error)
            const color = err < 1 ? 'rgba(15,179,122,0.7)' : err < 2.5 ? 'rgba(212,133,10,0.7)' : 'rgba(192,57,43,0.7)'
            return (
              <circle key={i} cx={x} cy={y} r="3.5" fill={color} stroke="none" opacity="0.8">
                <title>{p.location}: actual={p.actual}m, predicted={p.predicted}m, error={p.error}m ({p.date})</title>
              </circle>
            )
          })}

          {/* Axis labels */}
          <text x={W / 2} y={H - 4} textAnchor="middle" fill="rgba(139,184,204,0.5)" fontSize="10" fontFamily="monospace">Predicted (m)</text>
          <text x={12} y={H / 2} textAnchor="middle" fill="rgba(139,184,204,0.5)" fontSize="10" fontFamily="monospace" transform={`rotate(-90,12,${H / 2})`}>Actual (m)</text>
        </svg>
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'rgba(15,179,122,0.8)' }} /> &lt;1m error</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'rgba(212,133,10,0.8)' }} /> 1-2.5m</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'rgba(192,57,43,0.8)' }} /> &gt;2.5m</span>
      </div>
    </div>
  )
}

// ── Error Distribution Histogram ─────────────────────────────────────────────

interface HistogramProps {
  points: MLPredictionPoint[]
}

function ErrorHistogram({ points }: HistogramProps) {
  if (points.length === 0) return null

  // Bucket errors into 0.5m-wide bins from -6 to +6
  const binWidth = 0.5
  const minBin = -6
  const maxBin = 6
  const bins: { center: number; count: number }[] = []
  for (let v = minBin; v < maxBin; v += binWidth) {
    bins.push({ center: v + binWidth / 2, count: 0 })
  }
  for (const p of points) {
    const idx = Math.floor((p.error - minBin) / binWidth)
    const bin = bins[idx]
    if (bin) bin.count++
  }

  const maxCount = Math.max(...bins.map(b => b.count), 1)
  const barW = CW / bins.length

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitle}>Prediction Error Distribution</div>
      <div className={styles.chartSubtitle}>Negative = model over-predicts, Positive = model under-predicts</div>
      <div className={styles.chartWrapper}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
          {/* Y-axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1.0].map(frac => {
            const v = Math.round(frac * maxCount)
            const y = PAD.top + CH - frac * CH
            return (
              <g key={frac}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(14, 124, 134,0.06)" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fill="rgba(139,184,204,0.4)" fontSize="9" fontFamily="monospace">{v}</text>
              </g>
            )
          })}

          {/* Zero line */}
          {(() => {
            const zeroIdx = Math.floor((0 - minBin) / binWidth)
            const zeroX = PAD.left + zeroIdx * barW + barW / 2
            return <line x1={zeroX} y1={PAD.top} x2={zeroX} y2={H - PAD.bottom} stroke="rgba(14, 124, 134,0.15)" strokeDasharray="4,4" />
          })()}

          {/* Bars */}
          {bins.map((bin, i) => {
            const barH = (bin.count / maxCount) * CH
            const x = PAD.left + i * barW + 1
            const y = PAD.top + CH - barH
            const isNeg = bin.center < 0
            const color = isNeg ? 'rgba(212,133,10,0.6)' : 'rgba(15,179,122,0.6)'
            return (
              <rect key={i} x={x} y={y} width={Math.max(0, barW - 2)} height={barH} fill={color} rx="1">
                <title>{bin.center.toFixed(1)}m: {bin.count} reports</title>
              </rect>
            )
          })}

          {/* X-axis labels */}
          {[-6, -4, -2, 0, 2, 4, 6].map(v => {
            const x = PAD.left + ((v - minBin) / (maxBin - minBin)) * CW
            return (
              <text key={v} x={x} y={H - PAD.bottom + 14} textAnchor="middle" fill="rgba(139,184,204,0.4)" fontSize="9" fontFamily="monospace">{v > 0 ? `+${v}` : v}m</text>
            )
          })}

          <text x={W / 2} y={H - 4} textAnchor="middle" fill="rgba(139,184,204,0.5)" fontSize="10" fontFamily="monospace">Prediction Error (m)</text>
          <text x={12} y={H / 2} textAnchor="middle" fill="rgba(139,184,204,0.5)" fontSize="10" fontFamily="monospace" transform={`rotate(-90,12,${H / 2})`}>Count</text>
        </svg>
      </div>
    </div>
  )
}

// ── Training Metrics Over Time ───────────────────────────────────────────────

interface MetricsTimelineProps {
  trainingLog: MLTrainingLogEntry[]
}

function MetricsTimeline({ trainingLog }: MetricsTimelineProps) {
  // Filter to entries that have MAE data and reverse for chronological order
  const entries = [...trainingLog].filter(e => e.global_mae != null).reverse()
  if (entries.length < 2) return null

  const maxMAE = Math.max(...entries.map(e => e.global_mae ?? 0), 0.5)
  const yMax = Math.ceil(maxMAE * 2) / 2 // round up to nearest 0.5

  const step = yMax > 4 ? 1 : 0.5
  const ticks = []
  for (let v = 0; v <= yMax; v += step) ticks.push(v)

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitle}>Model MAE Over Training Runs</div>
      <div className={styles.chartSubtitle}>Lower is better — tracking prediction accuracy over time</div>
      <div className={styles.chartWrapper}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
          {/* Y grid */}
          {ticks.map(v => {
            const y = PAD.top + CH - (v / yMax) * CH
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="rgba(14, 124, 134,0.06)" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fill="rgba(139,184,204,0.4)" fontSize="9" fontFamily="monospace">{v.toFixed(1)}</text>
              </g>
            )
          })}

          {/* Line path */}
          {(() => {
            const pts = entries.map((e, i) => ({
              x: PAD.left + (i / (entries.length - 1)) * CW,
              y: PAD.top + CH - ((e.global_mae ?? 0) / yMax) * CH,
            }))
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
            // Fill path
            const firstP = pts[0]
            const lastP = pts[pts.length - 1]
            const fillD = firstP && lastP
              ? `${d} L${lastP.x},${PAD.top + CH} L${firstP.x},${PAD.top + CH} Z`
              : d
            return (
              <>
                <path d={fillD} fill="rgba(14, 124, 134,0.08)" />
                <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" stroke="rgba(2,13,20,0.8)" strokeWidth="1.5">
                    <title>Run {i + 1}: MAE={entries[i]?.global_mae?.toFixed(3)}, {entries[i]?.sample_count} samples ({entries[i]?.trigger})</title>
                  </circle>
                ))}
              </>
            )
          })()}

          {/* X-axis labels (dates) */}
          {entries.length <= 10
            ? entries.map((e, i) => {
                const x = PAD.left + (i / (entries.length - 1)) * CW
                const label = new Date(e.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                return (
                  <text key={i} x={x} y={H - PAD.bottom + 14} textAnchor="middle" fill="rgba(139,184,204,0.4)" fontSize="8" fontFamily="monospace">{label}</text>
                )
              })
            : [0, Math.floor(entries.length / 2), entries.length - 1].map(i => {
                const x = PAD.left + (i / (entries.length - 1)) * CW
                const entry = entries[i]
                const label = entry ? new Date(entry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''
                return (
                  <text key={i} x={x} y={H - PAD.bottom + 14} textAnchor="middle" fill="rgba(139,184,204,0.4)" fontSize="8" fontFamily="monospace">{label}</text>
                )
              })
          }

          <text x={W / 2} y={H - 4} textAnchor="middle" fill="rgba(139,184,204,0.5)" fontSize="10" fontFamily="monospace">Training Run</text>
          <text x={12} y={H / 2} textAnchor="middle" fill="rgba(139,184,204,0.5)" fontSize="10" fontFamily="monospace" transform={`rotate(-90,12,${H / 2})`}>MAE (m)</text>
        </svg>
      </div>
    </div>
  )
}

// ── Feature Importance Horizontal Bar Chart ─────────────────────────────────

interface FeatureImportanceChartProps {
  features: FeatureImportance[]
}

function FeatureImportanceChart({ features }: FeatureImportanceChartProps) {
  if (features.length === 0) return <div className={styles.empty}>No feature importance data</div>

  const barH = 22
  const gap = 4
  const labelW = 160
  const valueW = 60
  const chartH = features.length * barH + (features.length - 1) * gap + PAD.top + PAD.bottom
  const barArea = W - labelW - valueW - PAD.right

  const maxCorr = Math.max(...features.map(f => f.abs_correlation), 0.1)

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitle}>Feature Importance (Correlation with Visibility)</div>
      <div className={styles.chartSubtitle}>
        Absolute Pearson correlation — higher bars mean stronger relationship with actual visibility
      </div>
      <div className={styles.chartWrapper}>
        <svg viewBox={`0 0 ${W} ${chartH}`} className={styles.chart}>
          {features.map((f, i) => {
            const y = PAD.top + i * (barH + gap)
            const barW = (f.abs_correlation / maxCorr) * barArea
            const isNeg = f.correlation < 0
            const color = isNeg ? 'rgba(192,57,43,0.7)' : 'rgba(15,179,122,0.7)'
            return (
              <g key={f.name}>
                <text
                  x={labelW - 6}
                  y={y + barH / 2 + 3}
                  textAnchor="end"
                  fill="rgba(139,184,204,0.7)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {f.label}
                </text>
                <rect
                  x={labelW}
                  y={y + 2}
                  width={Math.max(2, barW)}
                  height={barH - 4}
                  fill={color}
                  rx="2"
                >
                  <title>
                    {f.label}: r={f.correlation.toFixed(3)}, R²={f.variance_explained.toFixed(3)}, mean={f.mean}, std={f.std}
                  </title>
                </rect>
                <text
                  x={labelW + barW + 6}
                  y={y + barH / 2 + 3}
                  textAnchor="start"
                  fill={color}
                  fontSize="9"
                  fontFamily="monospace"
                >
                  r={f.correlation > 0 ? '+' : ''}{f.correlation.toFixed(3)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'rgba(15,179,122,0.8)' }} /> Positive (increases viz)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: 'rgba(192,57,43,0.8)' }} /> Negative (reduces viz)
        </span>
      </div>
    </div>
  )
}

// ── Largest Residuals: outlier diagnostic ────────────────────────────────────

interface ResidualTableProps {
  residuals: MLResidual[]
  summary: MLResidualSummary | null
  quarantined: Set<number>
  onQuarantine: (id: number) => void
}

function ResidualTable({ residuals, summary, quarantined, onQuarantine }: ResidualTableProps) {
  if (residuals.length === 0) return <div className={styles.empty}>No residual data</div>

  const share = summary?.top3_sse_share ?? null
  const concentrated = share !== null && share > 0.5

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTitle}>Largest Residuals</div>
      <div className={styles.chartSubtitle}>
        {share !== null ? (
          <>
            Top 3 reports account for{' '}
            <strong style={{ color: concentrated ? 'var(--danger)' : 'var(--text-bright)' }}>
              {(share * 100).toFixed(0)}%
            </strong>{' '}
            of squared error
            {concentrated ? ' — a few outliers dominate; consider quarantining them' : ''}
          </>
        ) : 'Worst-fitting reports first'}
      </div>
      <div className={styles.tableScroll}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-dim, #4b5661)' }}>
              <th style={{ padding: '4px 5px' }}>Date</th>
              <th style={{ padding: '4px 5px' }}>Location</th>
              <th style={{ padding: '4px 5px', textAlign: 'right' }}>Actual</th>
              <th style={{ padding: '4px 5px', textAlign: 'right' }}>Pred</th>
              <th style={{ padding: '4px 5px', textAlign: 'right' }}>Error</th>
              <th style={{ padding: '4px 5px', textAlign: 'right' }}>Conf</th>
              <th style={{ padding: '4px 5px', textAlign: 'center' }} scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {residuals.map(r => {
              const isQ = quarantined.has(r.id)
              return (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(139,184,204,0.15)', opacity: isQ ? 0.4 : 1 }}>
                  <td style={{ padding: '4px 5px' }}>{r.date}</td>
                  <td style={{ padding: '4px 5px' }}>{r.location}</td>
                  <td style={{ padding: '4px 5px', textAlign: 'right' }}>{r.actual.toFixed(1)}</td>
                  <td style={{ padding: '4px 5px', textAlign: 'right' }}>{r.predicted.toFixed(1)}</td>
                  <td style={{ padding: '4px 5px', textAlign: 'right',
                               color: Math.abs(r.error) > 2 ? 'var(--danger)' : 'var(--text-bright)' }}>
                    {r.error > 0 ? '+' : ''}{r.error.toFixed(1)}m
                  </td>
                  <td style={{ padding: '4px 5px', textAlign: 'right' }}>
                    {r.video_confidence !== null ? r.video_confidence.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '4px 5px' }}>
                    {isQ ? (
                      <span style={{ color: 'var(--text-dim, #4b5661)', fontSize: 10 }}>quarantined</span>
                    ) : (
                      <button
                        onClick={() => onQuarantine(r.id)}
                        title="Quarantine this report"
                        aria-label={`Quarantine report ${r.id}`}
                        style={{
                          background: 'rgba(192,57,43,0.12)',
                          border: '1px solid rgba(192,57,43,0.35)',
                          color: 'rgba(192,57,43,0.85)',
                          borderRadius: 3,
                          padding: '1px 6px',
                          fontSize: 10,
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          lineHeight: '16px',
                        }}
                      >
                        Q
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Exported Combined Component ──────────────────────────────────────────────

interface MLChartsProps {
  trainingLog: MLTrainingLogEntry[]
}

export function MLCharts({ trainingLog }: MLChartsProps) {
  const [predictions, setPredictions] = useState<MLPredictionPoint[]>([])
  const [residuals, setResiduals] = useState<MLResidual[]>([])
  const [summary, setSummary] = useState<MLResidualSummary | null>(null)
  const [features, setFeatures] = useState<FeatureImportance[]>([])
  const [loading, setLoading] = useState(true)
  const [quarantinedIds, setQuarantinedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getMLPredictions()
        .then(data => {
          if (!cancelled) {
            setPredictions(data.points)
            setResiduals(data.residuals ?? [])
            setSummary(data.summary ?? null)
          }
        })
        .catch(() => {}),
      getFeatureImportance()
        .then(data => {
          if (!cancelled) setFeatures(data.features)
        })
        .catch(() => {}),
    ]).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleQuarantine(id: number) {
    setQuarantinedIds(prev => new Set([...prev, id]))
    try {
      await quarantineReport(id)
    } catch {
      setQuarantinedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (loading) return <div className={styles.loading}>Loading chart data...</div>

  return (
    <div className={styles.chartsContainer}>
      <ScatterPlot points={predictions} />
      <ErrorHistogram points={predictions} />
      <ResidualTable
        residuals={residuals}
        summary={summary}
        quarantined={quarantinedIds}
        onQuarantine={handleQuarantine}
      />
      <FeatureImportanceChart features={features} />
      <MetricsTimeline trainingLog={trainingLog} />
    </div>
  )
}
