import styles from './Bathymetry.module.css'

interface BathymetryProps {
  className?: string
}

export function Bathymetry({ className = '' }: BathymetryProps) {
  return (
    <svg
      className={`${styles.contours} ${className}`.trim()}
      viewBox="0 0 420 760"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M390 0c-2 59-56 68-63 118-9 62 46 83 31 146-14 58-73 62-82 121-9 60 43 91 17 151-19 43-63 53-70 103-7 49 25 76 5 121" />
        <path d="M420 30c-20 49-62 63-68 110-8 56 43 79 25 137-17 54-69 61-80 114-12 57 35 88 8 143-22 44-68 55-73 106-4 42 22 73 7 120" />
        <path d="M420 105c-20 28-42 44-43 80-1 50 35 70 15 120-18 44-61 55-70 99-12 53 28 79 1 132-20 38-59 52-63 94-3 34 13 63 8 100" />
        <path d="M420 204c-9 16-17 33-15 55 4 43 30 58 10 101-19 39-55 51-63 90-10 49 23 72-3 119-18 33-48 50-49 85-1 28 9 50 7 78" />
        <path d="M420 325c-12 29-36 41-40 72-5 39 20 58-2 96-18 30-46 44-49 77-4 30 13 51 6 81" />
      </g>
    </svg>
  )
}
