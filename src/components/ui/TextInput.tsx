import { forwardRef, type InputHTMLAttributes } from 'react'
import styles from './FormControl.module.css'

type TextInputProps = InputHTMLAttributes<HTMLInputElement>

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={[styles.control, styles.textInput, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
})
