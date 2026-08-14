import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './FilterChip.module.css'

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger'

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
}

export function FilterChip({
  active = false,
  tone = 'accent',
  icon,
  className = '',
  type = 'button',
  children,
  ...rest
}: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={[styles.chip, styles[tone], active ? styles.active : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}
