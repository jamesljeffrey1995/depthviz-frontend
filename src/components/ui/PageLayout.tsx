import type { HTMLAttributes, ReactNode } from 'react'
import styles from './PageLayout.module.css'

interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  contentClassName?: string
  width?: 'default' | 'wide'
}

export function PageLayout({
  eyebrow,
  title,
  subtitle,
  actions,
  contentClassName = '',
  width = 'default',
  className = '',
  children,
  ...rest
}: PageLayoutProps) {
  const hasHeader = eyebrow || title || subtitle || actions

  return (
    <div className={[styles.page, styles[width], className].filter(Boolean).join(' ')} {...rest}>
      {hasHeader && (
        <header className={styles.header}>
          <div className={styles.headerText}>
            {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
            {title && <h1 className={styles.title}>{title}</h1>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={[styles.content, contentClassName].filter(Boolean).join(' ')}>{children}</div>
    </div>
  )
}
