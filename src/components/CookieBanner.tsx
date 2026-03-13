import { useState } from 'react'
import styles from './CookieBanner.module.css'

const COOKIE_KEY = 'depthviz_cookie_consent'

export function CookieBanner({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [visible, setVisible] = useState(() => !localStorage.getItem(COOKIE_KEY))

  if (!visible) return null

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined')
    setVisible(false)
  }

  return (
    <div className={styles.banner}>
      <div className={styles.inner}>
        <div className={styles.text}>
          We use essential cookies to keep you signed in and remember your preferences.
          No tracking or advertising cookies. See our{' '}
          <a href="#" onClick={e => { e.preventDefault(); onNavigate('cookies') }}>cookie policy</a>{' '}
          and{' '}
          <a href="#" onClick={e => { e.preventDefault(); onNavigate('privacy') }}>privacy policy</a>.
        </div>
        <div className={styles.buttons}>
          <button className={styles.accept} onClick={accept}>Accept</button>
          <button className={styles.decline} onClick={decline}>Decline</button>
        </div>
      </div>
    </div>
  )
}
