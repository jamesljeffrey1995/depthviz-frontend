import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  iconStart?: ReactNode
  iconEnd?: ReactNode
  children: ReactNode
}

/**
 * Pill-shaped button with a minimum 44px touch target at every size, so it
 * stays thumb-friendly on mobile. Colour never carries meaning alone — the
 * label always states the action.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  iconStart,
  iconEnd,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        styles.btn,
        styles[variant],
        styles[`size_${size}`],
        block ? styles.block : '',
        'dv-pressable',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {iconStart && <span className={styles.icon} aria-hidden="true">{iconStart}</span>}
      <span>{children}</span>
      {iconEnd && <span className={styles.icon} aria-hidden="true">{iconEnd}</span>}
    </button>
  )
}
