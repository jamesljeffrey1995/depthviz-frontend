import { useState, useEffect } from 'react'
import { getTides } from '../lib/api'
import type { TidesResponse, TideEvent } from '../types'
import styles from './TidesPage.module.css'

interface Props {
  lat: number
  lon: number
  locationName: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function getCurrentStateColor(state: string): string {
  switch (state) {
    case 'slack': return 'var(--good)'
    case 'weak': return 'var(--good)'
    case 'moderate': return 'var(--warn)'
    case 'strong': return 'var(--danger)'
    default: return 'var(--text)'
  }
}

function getRangeColor(category: string): string {
  switch (category) {
    case 'micro': return 'var(--good)'
    case 'meso': return 'var(--warn)'
    case 'macro': return 'var(--danger)'
    default: return 'var(--text)'
  }
}

function buildChartPath(hourly: { time: string; height: number | null }[]): { path: string; fillPath: string; minH: number; maxH: number; points: { x: number; y: number; height: number; time: string }[] } {
  // Filter out entries with null heights
  const valid = hourly.filter((h): h is { time: string; height: number } => h.height != null)
  if (valid.length === 0) return { path: '', fillPath: '', minH: 0, maxH: 1, points: [] }
  const heights = valid.map(h => h.height)
  const minH = Math.min(...heights) - 0.3
  const maxH = Math.max(...heights) + 0.3
  const range = maxH - minH || 1

  const W = 600
  const H = 200
  const padTop = 20
  const padBot = 30
  const chartH = H - padTop - padBot

  const points = valid.map((h, i) => ({
    x: (i / (valid.length - 1)) * W,
    y: padTop + chartH - ((h.height - minH) / range) * chartH,
    height: h.height,
    time: h.time,
  }))

  // Smooth curve using cardinal spline
  let path = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }

  const fillPath = path + ` L${W},${H} L0,${H} Z`

  return { path, fillPath, minH, maxH, points }
}

function findEventPositions(events: TideEvent[], chartPoints: { x: number; y: number; height: number; time: string }[]) {
  if (chartPoints.length === 0) return []
  return events.filter(ev => ev.height != null).map(ev => {
    const evTime = new Date(ev.time).getTime()
    // Find closest chart point
    let closestIdx = 0
    let closestDiff = Infinity
    for (let i = 0; i < chartPoints.length; i++) {
      const diff = Math.abs(new Date(chartPoints[i].time).getTime() - evTime)
      if (diff < closestDiff) { closestDiff = diff; closestIdx = i }
    }
    return {
      ...ev,
      height: ev.height as number,
      x: chartPoints[closestIdx].x,
      y: chartPoints[closestIdx].y,
    }
  })
}

export function TidesPage({ lat, lon, locationName }: Props) {
  const [tides, setTides] = useState<TidesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getTides(lat, lon, locationName, selectedDate)
      .then(data => { if (!cancelled) setTides(data) })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load tide data') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [lat, lon, locationName, selectedDate])

  const handleDateChange = (offset: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.loadingState}>
          <div className={styles.loadingPulse} />
          <div className={styles.loadingText}>Loading tide data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.card}>
        <div className={styles.errorState}>{error}</div>
      </div>
    )
  }

  if (!tides) return null

  const { path, fillPath, minH, maxH, points } = buildChartPath(tides.hourly)
  const eventPositions = findEventPositions(tides.events, points)

  // Current time marker
  const now = new Date()
  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === todayStr
  let nowX: number | null = null
  if (isToday && points.length > 1) {
    const startTime = new Date(points[0].time).getTime()
    const endTime = new Date(points[points.length - 1].time).getTime()
    const nowTime = now.getTime()
    if (nowTime >= startTime && nowTime <= endTime) {
      nowX = ((nowTime - startTime) / (endTime - startTime)) * 600
    }
  }

  // Generate tick labels for Y axis
  const yTicks: number[] = []
  const step = (maxH - minH) > 4 ? 1 : 0.5
  for (let v = Math.ceil(minH / step) * step; v <= maxH; v += step) {
    yTicks.push(Math.round(v * 10) / 10)
  }

  // Generate time labels for X axis (evenly spaced from chart points)
  const labelInterval = Math.max(1, Math.floor(points.length / 8))
  const timeLabels = points.filter((_, i) => i % labelInterval === 0).map(p => ({
    label: formatTime(p.time),
    x: p.x,
  }))

  return (
    <div>
      {/* Header */}
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.locationLabel}>{locationName}</div>
            <div className={styles.datumLabel}>Datum: {tides.datum}</div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.currentBadge} style={{ color: getCurrentStateColor(tides.current.state) }}>
              {tides.current.state.toUpperCase()}
            </div>
            <div className={styles.currentDirection}>
              {tides.current.direction === 'flooding' ? 'Flooding' :
               tides.current.direction === 'ebbing' ? 'Ebbing' : 'Slack water'}
              {tides.current.speed_knots != null && ` · ${tides.current.speed_knots.toFixed(1)} kn`}
            </div>
          </div>
        </div>
      </div>

      {/* Date navigator */}
      <div className={styles.dateNav}>
        <button className={styles.dateBtn} onClick={() => handleDateChange(-1)}>&larr;</button>
        <div className={styles.dateLabel}>{formatDate(selectedDate)}</div>
        <button className={styles.dateBtn} onClick={() => handleDateChange(1)}>&rarr;</button>
      </div>

      {/* Tide chart */}
      <div className={styles.card}>
        <div className={styles.sectionLabel}>Tide Chart</div>
        <div className={styles.chartWrapper}>
          <svg viewBox="0 0 600 200" className={styles.chart} preserveAspectRatio="none">
            <defs>
              <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(0,201,255,0.25)" />
                <stop offset="100%" stopColor="rgba(0,201,255,0.02)" />
              </linearGradient>
            </defs>

            {/* Y grid lines */}
            {yTicks.map(v => {
              const chartH = 200 - 20 - 30
              const y = 20 + chartH - ((v - minH) / (maxH - minH || 1)) * chartH
              return (
                <g key={v}>
                  <line x1="0" y1={y} x2="600" y2={y} stroke="rgba(0,201,255,0.06)" strokeWidth="1" />
                  <text x="4" y={y - 4} fill="rgba(139,184,204,0.4)" fontSize="9" fontFamily="var(--font-mono)">{v.toFixed(1)}m</text>
                </g>
              )
            })}

            {/* Fill area */}
            {fillPath && <path d={fillPath} fill="url(#tideFill)" />}

            {/* Tide curve */}
            {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />}

            {/* Now marker */}
            {nowX !== null && (
              <line x1={nowX} y1="20" x2={nowX} y2="170" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4,4" />
            )}

            {/* High/low markers */}
            {eventPositions.map((ev, i) => (
              <g key={i}>
                <circle cx={ev.x} cy={ev.y} r="4" fill={ev.type === 'high' ? 'var(--accent)' : 'var(--warn)'} />
                <text
                  x={ev.x}
                  y={ev.type === 'high' ? ev.y - 10 : ev.y + 16}
                  textAnchor="middle"
                  fill="var(--text-bright)"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                >
                  {ev.height != null ? `${ev.height.toFixed(1)}m` : ''}
                </text>
              </g>
            ))}

            {/* X-axis time labels */}
            {timeLabels.map((t, i) => (
              <text key={i} x={t.x} y="195" textAnchor="middle" fill="rgba(139,184,204,0.4)" fontSize="9" fontFamily="var(--font-mono)">
                {t.label}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* High/Low event cards */}
      <div className={styles.card}>
        <div className={styles.sectionLabel}>High &amp; Low Tides</div>
        <div className={styles.eventsGrid}>
          {tides.events.map((ev, i) => (
            <div key={i} className={styles.eventCard}>
              <div className={styles.eventType} style={{ color: ev.type === 'high' ? 'var(--accent)' : 'var(--warn)' }}>
                {ev.type === 'high' ? 'HIGH' : 'LOW'}
              </div>
              <div className={styles.eventHeight}>{ev.height != null ? `${ev.height.toFixed(2)}m` : 'N/A'}</div>
              <div className={styles.eventTime}>{formatTime(ev.time)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tidal range */}
      <div className={styles.card}>
        <div className={styles.rangeRow}>
          <div className={styles.rangeInfo}>
            <div className={styles.sectionLabel}>Tidal Range</div>
            <div className={styles.rangeValue}>{tides.tidal_range_m != null ? `${tides.tidal_range_m.toFixed(1)}m` : 'N/A'}</div>
          </div>
          <div className={styles.rangeBadge} style={{ color: getRangeColor(tides.range_category) }}>
            {tides.range_category === 'micro' ? 'MICRO-TIDAL' :
             tides.range_category === 'meso' ? 'MESO-TIDAL' : 'MACRO-TIDAL'}
          </div>
        </div>
        <div className={styles.rangeBar}>
          <div
            className={styles.rangeFill}
            style={{
              width: `${Math.min(100, ((tides.tidal_range_m ?? 0) / 8) * 100)}%`,
              background: getRangeColor(tides.range_category),
            }}
          />
        </div>
        <div className={styles.rangeScale}>
          <span>0m</span>
          <span>2m (micro)</span>
          <span>4m (meso)</span>
          <span>8m+ (macro)</span>
        </div>
      </div>
    </div>
  )
}
