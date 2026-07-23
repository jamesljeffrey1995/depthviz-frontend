import styles from './Skeleton.module.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string
  className?: string
}

/** Shimmering placeholder used in place of spinners for perceived speed. */
export function Skeleton({ width = '100%', height = 16, radius = 'var(--ds-radius-sm)', className = '' }: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

/** A pre-composed skeleton for the location page's decision card. */
export function DiveScoreSkeleton() {
  return (
    <div className={styles.card} role="status" aria-label="Loading dive forecast">
      <div className={styles.heroRow}>
        <Skeleton width={132} height={132} radius="50%" />
        <div className={styles.heroText}>
          <Skeleton width="70%" height={22} />
          <Skeleton width="45%" height={14} />
          <Skeleton width="90%" height={14} />
        </div>
      </div>
      <div className={styles.rows}>
        <Skeleton height={12} />
        <Skeleton width="82%" height={12} />
        <Skeleton width="64%" height={12} />
      </div>
    </div>
  )
}
