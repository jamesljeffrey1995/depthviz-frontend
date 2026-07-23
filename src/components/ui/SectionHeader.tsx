import type { ReactNode } from 'react'
import styles from './SectionHeader.module.css'

interface SectionHeaderProps {
  /** Small eyebrow label above the title, e.g. "Step 3". */
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  /** Trailing content — a toggle, a "See all" link, a unit control. */
  action?: ReactNode
  as?: 'h2' | 'h3'
}

/** Consistent section heading used to structure every page identically. */
export function SectionHeader({ eyebrow, title, subtitle, action, as: Tag = 'h2' }: SectionHeaderProps) {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <Tag className={styles.title}>{title}</Tag>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
