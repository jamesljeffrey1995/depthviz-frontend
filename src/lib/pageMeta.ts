export interface PageMeta {
  title: string
  description: string
}

const DEFAULT_DESCRIPTION = 'Underwater visibility forecasts, sea conditions and community reports for spearfishers and freedivers.'

const EXACT: Record<string, PageMeta> = {
  '/': { title: 'DepthViz — Underwater Visibility Forecasts', description: DEFAULT_DESCRIPTION },
  '/forecast': { title: 'Dive Forecast — DepthViz', description: 'Check predicted underwater visibility, swell, wind and water conditions for your selected coast.' },
  '/map': { title: 'UK Dive Spot Map — DepthViz', description: 'Browse charted and community dive spots around the UK and open a local visibility forecast.' },
  '/best': { title: 'Best Visibility Today — DepthViz', description: 'Compare today’s predicted underwater visibility across UK dive spots.' },
  '/places': { title: 'My Places — DepthViz', description: 'Review saved dive spots and their latest visibility conditions.' },
  '/tides': { title: 'Tides and Currents — DepthViz', description: 'Review tide heights, high and low water, tidal range and current state for your selected coast.' },
  '/report': { title: 'Log a Dive Report — DepthViz', description: 'Share observed underwater visibility and local sea conditions with the DepthViz community.' },
  '/feed': { title: 'Community Reports — DepthViz', description: 'Read recent visibility reports and catches shared by divers.' },
  '/catches': { title: 'Catches — DepthViz', description: 'Log and review catches shared by the diving community.' },
  '/news': { title: 'News & Guides — DepthViz', description: 'Read practical underwater visibility guides, DepthViz model updates and community diving knowledge.' },
  '/forum': { title: 'Discussions — DepthViz', description: 'Discuss local dive spots, conditions, safety and equipment with other divers.' },
  '/competition': { title: 'Competitions — DepthViz', description: 'View available spearfishing competitions and registration information.' },
  '/training': { title: 'Apnea Training — DepthViz', description: 'Build and run dry apnea training tables.' },
  '/weight': { title: 'Weight Calculator — DepthViz', description: 'Estimate a starting weight-belt setup for freediving and spearfishing.' },
  '/profile': { title: 'Profile — DepthViz', description: 'Manage your DepthViz account and diving profile.' },
  '/friends': { title: 'Friends — DepthViz', description: 'Manage your DepthViz diving connections.' },
  '/history': { title: 'Dive Logs — DepthViz', description: 'Review previous visibility reports for a saved location.' },
  '/dispute': { title: 'Report Forecast Data — DepthViz', description: 'Flag incorrect forecast information for review.' },
  '/admin/competition': { title: 'Competition Operations — DepthViz', description: 'Private competition event-day operations.' },
}

const LEGAL_TITLES: Record<string, string> = {
  privacy: 'Privacy',
  terms: 'Terms',
  cookies: 'Cookie Settings',
  security: 'Security',
  contact: 'Contact',
  accessibility: 'Accessibility',
  disclaimer: 'Disclaimer',
}

export function getPageMeta(pathname: string): PageMeta {
  const exact = EXACT[pathname]
  if (exact) return exact

  if (pathname.startsWith('/forum/')) {
    return { title: 'Discussion — DepthViz', description: EXACT['/forum']?.description ?? DEFAULT_DESCRIPTION }
  }
  if (pathname.startsWith('/training/')) {
    return { title: 'Apnea Training Table — DepthViz', description: EXACT['/training']?.description ?? DEFAULT_DESCRIPTION }
  }
  if (pathname.startsWith('/legal/')) {
    const page = pathname.split('/')[2] ?? ''
    const label = LEGAL_TITLES[page] ?? 'Legal'
    return { title: `${label} — DepthViz`, description: `${label} information for DepthViz.` }
  }

  return { title: 'Page Not Found — DepthViz', description: DEFAULT_DESCRIPTION }
}
