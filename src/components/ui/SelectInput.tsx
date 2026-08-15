import { forwardRef, type SelectHTMLAttributes } from 'react'
import styles from './FormControl.module.css'

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement>

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { className = '', ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={[styles.control, styles.selectInput, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
})
