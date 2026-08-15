import { type ReactNode } from 'react'
import styles from './FormField.module.css'

interface FormFieldProps {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}

export function FormField({ label, htmlFor, hint, error, className = '', children }: FormFieldProps) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <div className={styles.error} role="alert">{error}</div> : hint ? <div className={styles.hint}>{hint}</div> : null}
    </div>
  )
}
