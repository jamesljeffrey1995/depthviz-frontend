/**
 * Hand-authored line-icon set — 24×24, 2px stroke, round caps/joins, in the
 * same geometric-line idiom as third-party icon sets like Lucide, but drawn
 * directly so the app has no icon-package dependency (registry installs
 * can't complete in this environment — see DESIGN.md).
 */
import type { SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  }
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function IconLocate(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}

export function IconGauge(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.9 19a9 9 0 1 1 14.2 0" />
      <path d="M12 13 15 9" />
      <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function IconChevronUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function IconMail(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </svg>
  )
}

export function IconCompass(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14.8 9.2-1.6 4.4-4.4 1.6 1.6-4.4z" />
    </svg>
  )
}

export function IconActivity(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12h4l2 8 4-16 2 8h6" />
    </svg>
  )
}

export function IconFish(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 12c-2.5 3.5-5.8 5.5-9 5.5-3.6 0-7-2.3-9-5.5 2-3.2 5.4-5.5 9-5.5 3.2 0 6.5 2 9 5.5Z" />
      <path d="M17 9.5V7l2.5 2M17 14.5V17l2.5-2" />
      <circle cx="8" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconTimer(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V9M9 2h6" />
    </svg>
  )
}

export function IconScale(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v18M7 21h10" />
      <path d="M3 7h18" />
      <path d="m5 7-2.5 6a2.5 2.5 0 0 0 5 0Z" />
      <path d="m19 7 2.5 6a2.5 2.5 0 0 1-5 0Z" />
    </svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  )
}

export function IconWind(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 8h11.5a2.5 2.5 0 1 0-2.3-3.5M3 16h13.5a2.5 2.5 0 1 1-2.3 3.5M3 12h16.5a2.5 2.5 0 1 0-2.3-3.5" />
    </svg>
  )
}

export function IconDroplet(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.7s6 6.6 6 11a6 6 0 1 1-12 0c0-4.4 6-11 6-11Z" />
    </svg>
  )
}

export function IconWaves(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 8c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
      <path d="M2 14c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
      <path d="M2 20c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    </svg>
  )
}

export function IconThermometer(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3a2 2 0 0 0-2 2v9.3a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2Z" />
      <path d="M12 15V8" />
    </svg>
  )
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 13 5 5L20 7" />
    </svg>
  )
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  )
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  )
}

export function IconAnchor(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v14M5 12H2a10 10 0 0 0 20 0h-3" />
      <path d="M8 15c-2-1-3-2.5-3-4.3" />
      <path d="M16 15c2-1 3-2.5 3-4.3" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconNews(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="15" height="16" rx="1.5" />
      <path d="M18 8h3v10a2 2 0 0 1-2 2h-1" />
      <path d="M7 8h7M7 12h7M7 16h4" />
    </svg>
  )
}
