import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import styles from './AuthModal.module.css'

interface Props {
  onClose: () => void
}

export function AuthModal({ onClose }: Props) {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  // ESC key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Trap focus inside modal
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handler)
    first?.focus()
    return () => document.removeEventListener('keydown', handler)
  }, [sent])

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await signInWithEmail(email.trim())
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={e => e.target === e.currentTarget && onClose()}
      aria-hidden="false"
    >
      <div
        className={styles.modal}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button className={styles.close} onClick={onClose} aria-label="Close sign in dialog">✕</button>

        <div className={styles.title} id="auth-modal-title">SIGN IN</div>
        <div className={styles.sub}>No password needed — we'll email you a magic link</div>

        {sent ? (
          <div className={styles.sent} aria-live="polite">
            <div className={styles.sentIcon} aria-hidden="true">✉</div>
            <div className={styles.sentText}>Link sent to <strong>{email}</strong></div>
            <div className={styles.sentHint}>Check your inbox and tap the link to sign in. You can close this.</div>
          </div>
        ) : (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                className={styles.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
                autoComplete="email"
              />
            </div>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <button
              className={styles.btn}
              onClick={handleSubmit}
              disabled={!email || loading}
              aria-busy={loading}
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
            <div className={styles.why}>
              Signing in lets you submit dive reports, save private spots, and helps the AI learn from your data.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
