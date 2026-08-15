import { forwardRef, type TextareaHTMLAttributes } from 'react'
import styles from './FormControl.module.css'

type TextareaInputProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const TextareaInput = forwardRef<HTMLTextAreaElement, TextareaInputProps>(function TextareaInput(
  { className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={[styles.control, styles.textareaInput, className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
})
