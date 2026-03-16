import { useEffect, useRef } from 'react'
import type { VisibilityResult } from '../types'
import { getImpact } from '../lib/visibility'
import styles from './VisibilityDisplay.module.css'

interface VisibilityDisplayProps {
  result: VisibilityResult
  locationName: string
}

export function VisibilityDisplay({ result, locationName }: VisibilityDisplayProps) {
  const { vis, verdict } = result
  const numRef = useRef<HTMLDivElement>(null)

  // Animate the number on mount / change
  useEffect(() => {
    const el = numRef.current
    if (!el) return
    const duration = 1200
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const ease = 1 - Math.pow(1 - t, 3)
      el.textContent = (vis * ease).toFixed(1)
      if (t < 1) requestAnimationFrame(tick)
      else el.textContent = vis.toFixed(1)
    }
    requestAnimationFrame(tick)
  }, [vis])

  const pct = (vis / 15) * 100

  return (
    <div className={styles.card}>
      <div className={styles.location}>{locationName.toUpperCase()}</div>

      <div className={styles.depthRow}>
        <div ref={numRef} className={`${styles.number} ${styles[verdict.colorClass]}`}>0.0</div>
        <div className={styles.unitBlock}>
          <div className={styles.unitLabel}>Est. visibility</div>
          <div className={styles.unit}>METRES</div>
        </div>
      </div>

      <div className={styles.barContainer}>
        <div className={styles.barLabels}>
          <span>0m — Blackout</span>
          <span>15m — Crystal</span>
        </div>
        <div className={styles.barTrack}>
          <div
            className={`${styles.barFill} ${styles[`bg_${verdict.colorClass}`]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={styles.barMarkers}>
          {[{ label: '2m', pct: 13 }, { label: '5m', pct: 33 }, { label: '10m', pct: 66 }, { label: '15m', pct: 100 }].map(m => (
            <span key={m.label} className={styles.marker} style={{ left: `${m.pct}%` }}>{m.label}</span>
          ))}
        </div>
      </div>

      <div className={`${styles.verdict} ${styles[verdict.colorClass]}`}>{verdict.label}</div>

      {verdict.alert && (
        <div className={styles.alert}>{verdict.alert}</div>
      )}
    </div>
  )
}

interface FactorGridProps {
  factors: VisibilityResult['factors']
}

export function FactorGrid({ factors }: FactorGridProps) {
  return (
    <div className={styles.grid}>
      {factors.map(f => {
        const { label: impactLabel, color: impactColor } = getImpact(f.penalty, f.max_penalty)
        const barPct = Math.min(100, (Math.abs(f.penalty) / f.max_penalty) * 100)
        const ratio = Math.abs(f.penalty) / f.max_penalty
        const barColor = ratio === 0 ? '#1a6b4a' : ratio < 0.4 ? '#d4850a' : ratio < 0.75 ? '#e06c00' : '#c0392b'

        return (
          <div key={f.name} className={styles.factorCard}>
            <div className={styles.factorName}>{f.name}</div>
            <div className={styles.factorValue}>{f.value}</div>
            {f.note && <div className={styles.factorNote}>{f.note}</div>}
            <div className={styles.factorImpact} style={{ color: impactColor }}>{impactLabel}</div>
            <div className={styles.factorBar} style={{ width: `${barPct}%`, background: barColor }} />
          </div>
        )
      })}
    </div>
  )
}
