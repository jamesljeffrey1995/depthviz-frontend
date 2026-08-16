import styles from './OfficialLogo.module.css'

interface Props {
  compact?: boolean
  className?: string
}

export function OfficialLogo({ compact = false, className = '' }: Props) {
  return (
    <span className={`${styles.logo} ${compact ? styles.compact : ''} ${className}`} aria-label="DepthViz — See further, dive deeper">
      <svg className={styles.mark} viewBox="0 0 132 64" role="img" aria-hidden="true">
        <text x="5" y="45" className={styles.d}>D</text>
        <text x="48" y="45" className={styles.v}>V</text>
        <path className={styles.pulse} d="M6 52h34l5-7 7 14 8-22 8 15h58" />
      </svg>
      {!compact && (
        <span className={styles.words}>
          <strong>DEPTHVIZ</strong>
          <small>SEE FURTHER - DIVE DEEPER</small>
        </span>
      )}
    </span>
  )
}
