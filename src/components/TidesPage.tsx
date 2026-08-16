import { useState, useEffect } from 'react'
import { getTides } from '../lib/api'
import { normalizeIsoDate, shiftIsoDate } from '../lib/dateOnly'
import type { TidesResponse, TideEvent } from '../types'
import styles from './TidesPage.module.css'

interface Props {
  lat: number
  lon: number
  locationName: string
  embedded?: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  // Parse at local noon so a date-only value always displays on its intended
  // calendar day. YYYY-MM-DD alone is interpreted as midnight UTC and can
  // display as the previous day west of Greenwich.
  const normalized = normalizeIsoDate(iso)
  if (!normalized) return 'Date unavailable'
  return new Date(`${normalized}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

const CHART = { width: 600, height: 210, left: 30, right: 30, top: 24, bottom: 34 } as const

function getCurrentStateColor(state: string): string {
  switch (state) {
    case 'slack': return 'var(--sev-good)'
    case 'weak': return 'var(--sev-good)'
    case 'moderate': return 'var(--sev-marginal)'
    case 'strong': return 'var(--sev-poor)'
    default: return 'var(--ink-dim)'
  }
}

function getRangeColor(category: string): string {
  switch (category) {
    case 'micro': return 'var(--sev-good)'
    case 'meso': return 'var(--sev-marginal)'
    case 'macro': return 'var(--sev-poor)'
    default: return 'var(--ink-dim)'
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

  const plotWidth = CHART.width - CHART.left - CHART.right
  const chartH = CHART.height - CHART.top - CHART.bottom

  const points = valid.map((h, i) => ({
    x: valid.length === 1 ? CHART.left + plotWidth / 2 : CHART.left + (i / (valid.length - 1)) * plotWidth,
    y: CHART.top + chartH - ((h.height - minH) / range) * chartH,
    height: h.height,
    time: h.time,
  }))

  // Smooth curve using cardinal spline
  const start = points[0]
  let path = start ? `M${start.x},${start.y}` : ''
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    if (!p0 || !p1 || !p2 || !p3) continue
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }

  const first = points[0]
  const last = points[points.length - 1]
  const baseline = CHART.height - CHART.bottom
  const fillPath = first && last ? `${path} L${last.x},${baseline} L${first.x},${baseline} Z` : ''

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
      const cp = chartPoints[i]
      if (!cp) continue
      const diff = Math.abs(new Date(cp.time).getTime() - evTime)
      if (diff < closestDiff) { closestDiff = diff; closestIdx = i }
    }
    const closest = chartPoints[closestIdx]
    return {
      ...ev,
      height: ev.height as number,
      x: closest?.x ?? 0,
      y: closest?.y ?? 0,
    }
  })
}

export function TidesPage({ lat, lon, locationName, embedded = false }: Props) {
  const [tides, setTides] = useState<TidesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Let the tide service resolve "today" for the requested location on first
  // load. Browser UTC is not the same thing as the location's calendar date.
  const locationKey = `${lat.toFixed(5)}:${lon.toFixed(5)}`
  const [dateSelection, setDateSelection] = useState<{ locationKey: string; date: string | null }>({
    locationKey,
    date: null,
  })
  const selectedDate = dateSelection.locationKey === locationKey ? dateSelection.date : null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getTides(lat, lon, locationName, selectedDate ?? undefined)
      .then(data => { if (!cancelled) setTides(data) })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load tide data') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [lat, lon, locationName, selectedDate])

  const handleDateChange = (offset: number) => {
    const activeDate = selectedDate ?? normalizeIsoDate(tides?.date ?? '')
    if (activeDate) setDateSelection({ locationKey, date: shiftIsoDate(activeDate, offset) })
  }

  if (loading) {
    return (
      <div className={`${styles.hero} ${embedded ? styles.heroEmbedded : ''}`}>
        <div className={styles.loadingState}>
          <div className={styles.loadingPulse} />
          <div className={styles.loadingText}>Loading tide data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${styles.hero} ${embedded ? styles.heroEmbedded : ''}`}>
        <div className={styles.errorState}>{error}</div>
      </div>
    )
  }

  if (!tides) return null

  const activeDate = selectedDate
    ?? normalizeIsoDate(tides.date)
    ?? normalizeIsoDate(tides.events[0]?.time ?? '')
    ?? new Date().toISOString().slice(0, 10)

  const { path, fillPath, minH, maxH, points } = buildChartPath(tides.hourly)
  const eventPositions = findEventPositions(tides.events, points)

  // Current time marker
  const now = new Date()
  let nowX: number | null = null
  const firstPt = points[0]
  const lastPt = points[points.length - 1]
  if (firstPt && lastPt) {
    const startTime = new Date(firstPt.time).getTime()
    const endTime = new Date(lastPt.time).getTime()
    const nowTime = now.getTime()
    if (nowTime >= startTime && nowTime <= endTime) {
      nowX = CHART.left + ((nowTime - startTime) / (endTime - startTime)) * (CHART.width - CHART.left - CHART.right)
    }
  }

  // Generate tick labels for Y axis
  const yTicks: number[] = []
  const step = (maxH - minH) > 4 ? 1 : 0.5
  for (let v = Math.ceil(minH / step) * step; v <= maxH; v += step) {
    yTicks.push(Math.round(v * 10) / 10)
  }

  // Generate time labels for X axis (evenly spaced from chart points)
  const labelInterval = Math.max(1, Math.ceil(points.length / 7))
  const timeLabelIndexes = Array.from(new Set([
    ...points.map((_, i) => i).filter(i => i % labelInterval === 0),
    points.length - 1,
  ])).filter(i => i >= 0)
  const timeLabels = timeLabelIndexes.map(i => points[i]).filter((p): p is NonNullable<typeof p> => !!p).map(p => ({
    label: formatTime(p.time),
    x: p.x,
  }))

  return (
    <div className={`${styles.page} ${embedded ? styles.pageEmbedded : ''}`}>
      {!embedded && (
        <header className={styles.pageHeading}>
          <p className={styles.pageEyebrow}>Marine planning</p>
          <h1>Tides for {locationName}</h1>
        </header>
      )}
      {/* Hero — current tide state + the range chart, the one reading on
          this screen that gets full priority treatment. */}
      <div className={`${styles.hero} ${embedded ? styles.heroEmbedded : ''}`}>
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

        <div className={styles.sectionLabel}>Tide Chart</div>
        <div className={styles.chartWrapper}>
          <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className={styles.chart} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0.25)" />
                <stop offset="100%" stopColor="rgba(var(--accent-rgb), 0.02)" />
              </linearGradient>
            </defs>

            {/* Y grid lines */}
            {yTicks.map(v => {
              const chartH = CHART.height - CHART.top - CHART.bottom
              const y = CHART.top + chartH - ((v - minH) / (maxH - minH || 1)) * chartH
              return (
                <g key={v}>
                  <line x1={CHART.left} y1={y} x2={CHART.width - CHART.right} y2={y} stroke="var(--surface-border)" strokeWidth="1" />
                  <text x={CHART.left + 4} y={y - 5} fill="var(--ink-faint)" fontSize="12" fontFamily="var(--font-sans)">{v.toFixed(1)}m</text>
                </g>
              )
            })}

            {/* Fill area */}
            {fillPath && <path d={fillPath} fill="url(#tideFill)" />}

            {/* Tide curve */}
            {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />}

            {/* Now marker */}
            {nowX !== null && (
              <line x1={nowX} y1={CHART.top} x2={nowX} y2={CHART.height - CHART.bottom} stroke="var(--surface-border-strong)" strokeWidth="1" strokeDasharray="4,4" />
            )}

            {/* High/low markers */}
            {eventPositions.map((ev, i) => (
              <g key={i}>
                <circle cx={ev.x} cy={ev.y} r="4" fill={ev.type === 'high' ? 'var(--accent)' : 'var(--sev-marginal)'} />
                <text
                  x={ev.x}
                  y={ev.type === 'high' ? ev.y - 10 : ev.y + 16}
                  textAnchor="middle"
                  fill="var(--ink)"
                  fontSize="12"
                  fontFamily="var(--font-sans)"
                >
                  {ev.height != null ? `${ev.height.toFixed(1)}m` : ''}
                </text>
              </g>
            ))}

            {/* X-axis time labels */}
            {timeLabels.map((t, i) => (
              <text key={i} x={t.x} y={CHART.height - 8} textAnchor="middle" fill="var(--ink-faint)" fontSize="12" fontFamily="var(--font-sans)">
                {t.label}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Date navigator — secondary, sits between the hero and the
          lower-priority lists it steps through */}
      <div className={styles.dateNav}>
        <button className={styles.dateBtn} onClick={() => handleDateChange(-1)} aria-label="Previous day">&larr;</button>
        <div className={styles.dateLabel}>{formatDate(activeDate)}</div>
        <button className={styles.dateBtn} onClick={() => handleDateChange(1)} aria-label="Next day">&rarr;</button>
      </div>

      {/* High/Low events — secondary list, lower visual weight than the hero */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>High &amp; Low Tides</div>
        <div className={styles.eventsGrid}>
          {tides.events.map((ev, i) => (
            <div key={i} className={styles.eventCard}>
              <div className={styles.eventType} style={{ color: ev.type === 'high' ? 'var(--accent-text)' : 'var(--sev-marginal)' }}>
                {ev.type === 'high' ? 'HIGH' : 'LOW'}
              </div>
              <div className={styles.eventHeight}>{ev.height != null ? `${ev.height.toFixed(2)}m` : 'N/A'}</div>
              <div className={styles.eventTime}>{formatTime(ev.time)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tidal range — tertiary, least visual weight */}
      <div className={styles.rangeCard}>
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
              transform: `scaleX(${Math.min(100, ((tides.tidal_range_m ?? 0) / 8) * 100) / 100})`,
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
