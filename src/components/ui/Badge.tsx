import type { ReactNode } from 'react'
import styles from './Badge.module.css'

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger'

interface BadgeProps {
  tone?: Tone
  /** Explicit colour overrides the tone — used by the dive-quality scale. */
  color?: string
  /** Show a leading status dot. Colour is paired with the label, never alone. */
  dot?: boolean
  icon?: ReactNode
  children: ReactNode
  title?: string
}

/**
 * Compact status pill. A dot or icon plus a text label means the meaning is
 * carried by shape and words, not colour alone (WCAG 1.4.1).
 */
export function Badge({ tone = 'neutral', color, dot = false, icon, children, title }: BadgeProps) {
  return (
    <span
      className={[styles.badge, styles[tone]].join(' ')}
      style={color ? { ['--badge-color' as string]: color } : undefined}
      title={title}
    >
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      {children}
    </span>
  )
}
