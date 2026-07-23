import { useState } from 'react'
import styles from './CookieBanner.module.css'

const COOKIE_KEY = 'depthviz_cookie_consent'

export function CookieBanner({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [visible, setVisible] = useState(() => !localStorage.getItem(COOKIE_KEY))

  if (!visible) return null

  // DepthViz stores only strictly-necessary / functional data (Supabase auth
  // token, this acknowledgement, and locally-held custom spots) — see the
  // Cookie Policy. There are no tracking, analytics, or advertising cookies to
  // opt out of, so a real Accept/Decline choice would be a dark pattern: a
  // "Decline" that couldn't suppress anything (it previously just hid the
  // banner). This is an honest acknowledgement of essential-only storage.
  const acknowledge = () => {
    localStorage.setItem(COOKIE_KEY, 'acknowledged')
    setVisible(false)
  }

  return (
    <div className={styles.banner}>
      <div className={styles.inner}>
        <div className={styles.text}>
          DepthViz uses only essential storage to keep you signed in and remember your
          preferences — no tracking, analytics, or advertising cookies. See our{' '}
          <a href="#" onClick={e => { e.preventDefault(); onNavigate('cookies') }}>cookie policy</a>{' '}
          and{' '}
          <a href="#" onClick={e => { e.preventDefault(); onNavigate('privacy') }}>privacy policy</a>.
        </div>
        <div className={styles.buttons}>
          <button className={styles.accept} onClick={acknowledge}>Got it</button>
        </div>
      </div>
    </div>
  )
}
