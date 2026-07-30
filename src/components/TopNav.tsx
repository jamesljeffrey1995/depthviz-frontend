import { useNavigate, useLocation } from 'react-router-dom'
import styles from './TopNav.module.css'

interface NavItem {
  label: string
  path: string
  /** Match when the current path starts with this prefix (for nested routes). */
  match?: (path: string) => boolean
}

const ITEMS: NavItem[] = [
  { label: 'Home', path: '/', match: p => p === '/' },
  { label: 'Explore', path: '/map', match: p => p === '/map' || p === '/forecast' || p === '/tides' },
  { label: 'Best spots', path: '/best', match: p => p === '/best' },
  { label: 'Community', path: '/feed', match: p => ['/feed', '/catches', '/forum', '/news'].some(prefix => p.startsWith(prefix)) },
  { label: 'Training', path: '/training', match: p => p.startsWith('/training') },
  { label: 'Competitions', path: '/competition', match: p => p === '/competition' || p === '/admin/competition' },
]

/**
 * Website-style horizontal navigation. Visible on wider screens; on narrow
 * mobile the existing bottom tab bar takes over (this is hidden via CSS), so
 * the desktop experience reads like a website while mobile keeps its app feel.
 */
export function TopNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className={styles.topNav} aria-label="Primary">
      <ul className={styles.list}>
        {ITEMS.map(item => {
          const active = item.match ? item.match(pathname) : pathname === item.path
          return (
            <li key={item.path}>
              <button
                type="button"
                className={`${styles.link} ${active ? styles.active : ''}`}
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
