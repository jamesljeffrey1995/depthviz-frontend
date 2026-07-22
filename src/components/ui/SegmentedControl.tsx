import styles from './SegmentedControl.module.css'

interface Segment<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: Segment<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
}

/**
 * Pill segmented control — the system's replacement for scattered toggles and
 * radio rows (units, week/day view, chart ranges). Fully keyboard operable.
 */
export function SegmentedControl<T extends string>({
  options, value, onChange, ariaLabel, size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div className={`${styles.group} ${styles[`size_${size}`]}`} role="group" aria-label={ariaLabel}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            className={`${styles.seg} ${active ? styles.active : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
