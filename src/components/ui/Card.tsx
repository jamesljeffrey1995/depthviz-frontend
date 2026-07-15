import type { ReactNode, HTMLAttributes } from 'react'
import styles from './Card.module.css'

type Elevation = 'flat' | 'raised' | 'floating'
type Padding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article' | 'li'
  elevation?: Elevation
  padding?: Padding
  /** Adds a hover/press affordance for tappable cards. */
  interactive?: boolean
  /** Accent hairline down the leading edge — used to flag status. */
  accent?: string
  children: ReactNode
}

/**
 * The base surface for the whole design system. Whitespace and a single
 * hairline do the work that borders and shadows used to; elevation is reserved
 * for genuine hierarchy (floating sheets, the primary decision card).
 */
export function Card({
  as: Tag = 'section',
  elevation = 'raised',
  padding = 'md',
  interactive = false,
  accent,
  className = '',
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={[
        styles.card,
        styles[`elev_${elevation}`],
        styles[`pad_${padding}`],
        interactive ? styles.interactive : '',
        interactive ? 'dv-pressable' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={accent ? { ...style, ['--card-accent' as string]: accent } : style}
      {...rest}
    >
      {accent && <span className={styles.accentEdge} aria-hidden="true" />}
      {children}
    </Tag>
  )
}
