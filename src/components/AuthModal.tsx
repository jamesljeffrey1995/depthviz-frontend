import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../hooks/useDialog'
import { Button, FormField, Modal, TextInput } from './ui'
import { IconMail } from './icons'
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
  // ESC-to-close, focus trap, scroll lock and focus restoration.
  const modalRef = useDialog<HTMLDivElement>(onClose)

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
    <Modal
      onClose={onClose}
      labelledBy="auth-modal-title"
      ref={modalRef}
      className={styles.modal}
      overlayClassName={styles.overlay}
      closeLabel="Close sign in dialog"
    >
        <div className={styles.title} id="auth-modal-title">Sign in</div>
        <div className={styles.sub}>No password needed — we&rsquo;ll email you a magic link</div>

        {sent ? (
          <div className={styles.sent} aria-live="polite">
            <div className={styles.sentIcon} aria-hidden="true"><IconMail /></div>
            <div className={styles.sentText}>Link sent to <strong>{email}</strong></div>
            <div className={styles.sentHint}>Check your inbox and tap the link to sign in. You can close this.</div>
          </div>
        ) : (
          <>
            <FormField label="Email address" htmlFor="auth-email" className={styles.field}>
              <TextInput
                id="auth-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
                autoComplete="email"
              />
            </FormField>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <Button
              variant="primary"
              block
              className={styles.btn}
              onClick={handleSubmit}
              disabled={!email || loading}
              aria-busy={loading}
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </Button>
            <div className={styles.why}>
              Signing in lets you submit dive reports, save private spots, and helps the model learn from your data.
            </div>
          </>
        )}
    </Modal>
  )
}
