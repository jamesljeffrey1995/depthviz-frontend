import type { ReactNode } from 'react'
import styles from './Meter.module.css'

interface MeterProps {
  label: ReactNode
  /** Right-aligned measured value, e.g. "3.2 m". */
  value?: ReactNode
  /** 0–100 fill. */
  percent: number
  color?: string
  /** Impact glyph — ▲ good / ● neutral / ▼ drag — so meaning isn't colour-only. */
  impact?: 'positive' | 'neutral' | 'negative'
  note?: ReactNode
}

const IMPACT_GLYPH: Record<NonNullable<MeterProps['impact']>, string> = {
  positive: '▲',
  neutral: '●',
  negative: '▼',
}

/**
 * A horizontal factor meter used across the environmental breakdown. The glyph
 * + label + value make each row scannable in under two seconds and readable
 * without relying on the fill colour.
 */
export function Meter({ label, value, percent, color = 'var(--ds-accent)', impact, note }: MeterProps) {
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className={styles.meter}>
      <div className={styles.head}>
        <span className={styles.label}>
          {impact && (
            <span className={`${styles.glyph} ${styles[impact]}`} aria-hidden="true">
              {IMPACT_GLYPH[impact]}
            </span>
          )}
          {label}
        </span>
        {value != null && <span className={styles.value}>{value}</span>}
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        <span className={styles.fill} style={{ width: `${pct}%`, background: color }} />
      </div>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  )
}
