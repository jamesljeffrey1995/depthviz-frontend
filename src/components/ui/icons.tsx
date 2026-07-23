import type { SVGProps } from 'react'

/* A tiny, dependency-free icon set used by the DS components. All icons inherit
   `currentColor` and a 1.6 stroke so they sit consistently beside Inter text. */

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }
}

export const EyeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const WaveIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M2 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" /><path d="M2 15c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" /></svg>
)
export const WindIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 12h15a3 3 0 1 1-3 3" /><path d="M3 16h8" /></svg>
)
export const RainIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M7 16a5 5 0 0 1 .5-9.97A6 6 0 0 1 19 8a4 4 0 0 1 .5 8" /><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" /></svg>
)
export const AlgaeIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21c-3-4-6-6-6-11a6 6 0 0 1 12 0c0 5-3 7-6 11Z" /><path d="M12 3v10" /></svg>
)
export const ThermometerIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z" /></svg>
)
export const CompassIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></svg>
)
export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
)
export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
)
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m5 12 5 5L20 6" /></svg>
)
export const AlertIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
)
export const MapPinIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
)
