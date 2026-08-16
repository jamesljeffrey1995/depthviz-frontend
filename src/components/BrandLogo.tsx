import styles from './BrandLogo.module.css'

interface BrandLogoProps {
  variant?: 'full' | 'mark'
  className?: string
}

export function BrandLogo({ variant = 'full', className = '' }: BrandLogoProps) {
  const src = variant === 'full'
    ? '/brand/depthviz-logo.png'
    : '/brand/depthviz-mark.png'

  return (
    <img
      className={`${styles.logo} ${styles[variant]} ${className}`.trim()}
      src={src}
      alt={variant === 'full' ? 'DepthViz — See further, dive deeper' : 'DepthViz'}
      draggable={false}
    />
  )
}
