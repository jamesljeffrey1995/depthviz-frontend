import type { ReactNode } from 'react'
import styles from './StatTile.module.css'

interface StatTileProps {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  /** Accent colour for the value + icon (e.g. severity). */
  color?: string
}

/** Compact metric tile for the environmental grid. Understandable in <2s. */
export function StatTile({ label, value, unit, sub, icon, color }: StatTileProps) {
  return (
    <div className={styles.tile} style={color ? { ['--tile-color' as string]: color } : undefined}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      </div>
      <div className={styles.value}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  )
}
