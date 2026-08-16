export type RouteTheme = 'light' | 'dark'

const LIGHT_PREFIXES = [
  '/feed',
  '/catches',
  '/forum',
  '/news',
  '/profile',
  '/friends',
  '/places',
  '/competition',
  '/legal',
  '/report',
  '/dispute',
]

const DARK_PREFIXES = [
  '/forecast',
  '/map',
  '/tides',
  '/best',
  '/training',
  '/history',
  '/admin',
]

export function getRouteTheme(pathname: string): RouteTheme {
  if (pathname === '/') return 'light'
  if (DARK_PREFIXES.some(prefix => pathname.startsWith(prefix))) return 'dark'
  if (LIGHT_PREFIXES.some(prefix => pathname.startsWith(prefix))) return 'light'
  return 'light'
}
