import { useEffect, useRef, useState } from 'react'
import styles from './DiveScore.module.css'

interface DiveScoreProps {
  /** 0–100. */
  score: number
  color: string
  /** Band label, e.g. "Good". */
  label: string
  /** Optional line under the label, e.g. "A good day to dive". */
  caption?: string
  size?: number
  /** Animate the arc on mount (disabled under reduced-motion automatically). */
  animate?: boolean
}

const SWEEP = 0.75           // 270° gauge — the gap sits at the bottom
const STROKE = 12
const TWEEN_MS = 620         // matches --ds-dur-reveal, the system's one reveal duration

/**
 * The single, prominent Dive Quality Score gauge. A 270° radial arc keeps the
 * number the hero of the location page while the colour, band label and gap
 * position give three redundant reads of the same value (WCAG 1.4.1).
 *
 * The arc and the number count together between whatever value is currently
 * shown and the new one — on first mount (0 → score) and on every later
 * change, e.g. flipping to a different forecast day. The tween is
 * interruptible: switching days again mid-count redirects from wherever the
 * animation currently sits rather than jumping.
 */
export function DiveScore({ score, color, label, caption, size = 148, animate = true }: DiveScoreProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const [shown, setShown] = useState(animate ? 0 : clamped)
  const shownRef = useRef(shown)

  useEffect(() => {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animate || prefersReduced) { setShown(clamped); shownRef.current = clamped; return }
    if (shownRef.current === clamped) return

    const from = shownRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const value = Math.round(from + (clamped - from) * eased)
      setShown(value)
      shownRef.current = value
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clamped, animate])

  const r = (size - STROKE) / 2
  const cx = size / 2
  const circumference = 2 * Math.PI * r
  const arcLen = circumference * SWEEP
  const fill = arcLen * (shown / 100)

  return (
    <div
      className={styles.wrap}
      style={{ width: size, height: size, ['--score-color' as string]: color }}
      role="img"
      aria-label={`Dive quality score ${clamped} out of 100 — ${label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.svg}>
        {/* 135° rotation puts the 25% gap centred at the bottom */}
        <g transform={`rotate(135 ${cx} ${cx})`}>
          <circle
            cx={cx} cy={cx} r={r}
            className={styles.track}
            strokeWidth={STROKE}
            strokeDasharray={`${arcLen} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={cx} cy={cx} r={r}
            className={styles.fill}
            stroke={color}
            strokeWidth={STROKE}
            strokeDasharray={`${fill} ${circumference}`}
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className={styles.center}>
        <div className={styles.number}>{shown}</div>
        <div className={styles.outOf}>/ 100</div>
        <div className={styles.label}>{label}</div>
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </div>
  )
}
