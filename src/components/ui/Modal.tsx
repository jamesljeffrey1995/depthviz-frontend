import { forwardRef, type ReactNode } from 'react'
import { IconClose } from '../icons'
import styles from './Modal.module.css'

interface ModalProps {
  onClose: () => void
  labelledBy: string
  className?: string
  overlayClassName?: string
  showClose?: boolean
  closeLabel?: string
  children: ReactNode
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    onClose,
    labelledBy,
    className = '',
    overlayClassName = '',
    showClose = true,
    closeLabel = 'Close dialog',
    children,
  },
  ref,
) {
  return (
    <div
      className={[styles.overlay, overlayClassName].filter(Boolean).join(' ')}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className={[styles.modal, className].filter(Boolean).join(' ')}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {showClose && (
          <button className={styles.close} onClick={onClose} aria-label={closeLabel}>
            <IconClose />
          </button>
        )}
        {children}
      </div>
    </div>
  )
})
