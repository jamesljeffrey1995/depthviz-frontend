import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useConditions } from './hooks/useConditions'
import { useGeolocation } from './hooks/useGeolocation'
import { useServiceStatus } from './hooks/useServiceStatus'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SearchBar } from './components/SearchBar'
import { ForecastStrip } from './components/ForecastStrip'
import { DayDetail } from './components/DayDetail'
import { DiveScoreCard } from './components/DiveScoreCard'
import { SeabedEditor } from './components/SeabedEditor'
import { CookieBanner } from './components/CookieBanner'
import { TopNav } from './components/TopNav'
import { Button, SegmentedControl } from './components/ui'
import PwaStatus from './components/PwaStatus'
import {
  IconHome, IconCompass, IconActivity, IconTimer, IconUser,
  IconLock, IconGauge, IconCheck, IconPlus,
} from './components/icons'
import { getLocations, createLocation, getMyProfile } from './lib/api'
import { encryptCoords } from './lib/spotCrypto'
import { startDayTransition } from './lib/viewTransition'
import { formatLocationName } from './types'
import type { GeocodingResult, Location, ForecastResponse } from './types'
import type { LegalPageType } from './components/LegalPage'
import { toUserFacingError } from './lib/frontendErrors'
import { trackClientEvent } from './lib/telemetry'
import styles from './App.module.css'

/** Find a DB location matching given coordinates within ~1km tolerance. */
function findLocationByCoords(lat: number, lon: number, locations: Location[]): Location | undefined {
  return locations.find(l => Math.abs(l.lat - lat) < 0.01 && Math.abs(l.lon - lon) < 0.01)
}

const ReportForm = lazy(() => import('./components/ReportForm').then(m => ({ default: m.ReportForm })))
const AuthModal = lazy(() => import('./components/AuthModal').then(m => ({ default: m.AuthModal })))
const ProfilePanel = lazy(() => import('./components/ProfilePanel').then(m => ({ default: m.ProfilePanel })))
const LocationHistory = lazy(() => import('./components/LocationHistory').then(m => ({ default: m.LocationHistory })))
const TidesPage = lazy(() => import('./components/TidesPage').then(m => ({ default: m.TidesPage })))
const SpotsMap = lazy(() => import('./components/SpotsMap').then(m => ({ default: m.SpotsMap })))
const BestVisibility = lazy(() => import('./components/BestVisibility').then(m => ({ default: m.BestVisibility })))
const LegalPage = lazy(() => import('./components/LegalPage').then(m => ({ default: m.LegalPage })))
const SavedPlaces = lazy(() => import('./components/SavedPlaces').then(m => ({ default: m.SavedPlaces })))
const CatchesPage = lazy(() => import('./components/CatchesPage').then(m => ({ default: m.CatchesPage })))
const FeedPage = lazy(() => import('./components/FeedPage').then(m => ({ default: m.FeedPage })))
const FriendsPanel = lazy(() => import('./components/FriendsPanel').then(m => ({ default: m.FriendsPanel })))
const ApneaTablesPage = lazy(() => import('./components/ApneaTablesPage').then(m => ({ default: m.ApneaTablesPage })))
const ApneaTableEditor = lazy(() => import('./components/ApneaTableEditor').then(m => ({ default: m.ApneaTableEditor })))
const ApneaTableRunner = lazy(() => import('./components/ApneaTableRunner').then(m => ({ default: m.ApneaTableRunner })))
const ApneaSharedTable = lazy(() => import('./components/ApneaSharedTable').then(m => ({ default: m.ApneaSharedTable })))
const PlacesDashboard = lazy(() => import('./components/PlacesDashboard').then(m => ({ default: m.PlacesDashboard })))
const WeeklyOverview = lazy(() => import('./components/WeeklyOverview').then(m => ({ default: m.WeeklyOverview })))
const DisputeForm = lazy(() => import('./components/DisputeForm').then(m => ({ default: m.DisputeForm })))
const WeightCalculator = lazy(() => import('./components/WeightCalculator').then(m => ({ default: m.WeightCalculator })))
const HomePage = lazy(() => import('./components/HomePage').then(m => ({ default: m.HomePage })))
const NewsPage = lazy(() => import('./components/NewsPage').then(m => ({ default: m.NewsPage })))
const ForumIndex = lazy(() => import('./components/ForumPage').then(m => ({ default: m.ForumIndex })))
const ForumCategoryPage = lazy(() => import('./components/ForumPage').then(m => ({ default: m.ForumCategoryPage })))
const ForumThreadPage = lazy(() => import('./components/ForumPage').then(m => ({ default: m.ForumThreadPage })))
const CompetitionRegister = lazy(() => import('./components/CompetitionRegister').then(m => ({ default: m.CompetitionRegister })))
const CompetitionAdmin = lazy(() => import('./components/CompetitionAdmin').then(m => ({ default: m.CompetitionAdmin })))

/** Routes that depend on a loaded location's conditions context (the forecast
 *  itself plus its forecast-adjacent pages — tides, report, history, dispute).
 *  On startup we restore the last location's stale forecast and revalidate it
 *  for these routes. The home page ("/") shows only the map and has no such
 *  dependency, so it must not trigger a conditions fetch on load. */
const FORECAST_ROUTES = ['/forecast', '/tides', '/report', '/history', '/dispute']

/** Routes the bottom-nav "Map" tab represents — the map plus the forecast-area
 *  pages the website-style top nav groups under "Forecast". Keeps the bottom
 *  tab highlighted while a user is anywhere in that area. */
const MAP_GROUP_ROUTES = ['/map', '/forecast', '/tides', '/best']

/** Location search belongs only to the dive-planning journey. Keeping it off
 *  community, training and utility pages gives those screens a clear purpose. */
const LOCATION_SEARCH_ROUTES = ['/', '/map', '/forecast', '/tides', '/best']

/** Footer labels for each legal page, in display order. */
const LEGAL_LABELS: Record<LegalPageType, string> = {
  privacy: 'Privacy',
  terms: 'Terms',
  cookies: 'Cookies',
  security: 'Security',
  contact: 'Contact',
  accessibility: 'Accessibility',
  disclaimer: 'Disclaimer',
}

type AuthIntent =
  | { type: 'route'; path: string }
  | { type: 'save-location'; isPrivate: boolean }
  | { type: 'reselect-spot' }

/** Reads the :page URL param so direct links to /legal/terms work correctly. */
function LegalRouteWrapper({ onBack }: { onBack: () => void }) {
  const { page } = useParams<{ page: string }>()
  const validPages: LegalPageType[] = ['privacy', 'terms', 'cookies', 'security', 'contact', 'accessibility', 'disclaimer']
  const resolved: LegalPageType = validPages.includes(page as LegalPageType) ? (page as LegalPageType) : 'privacy'
  return (
    <Suspense fallback={null}>
      <LegalPage page={resolved} onBack={onBack} />
    </Suspense>
  )
}

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { status, forecast, error, isRevalidating, searchByCoords, init } = useConditions()
  const serviceStatus = useServiceStatus()
  const downServices = ([
    ['open_meteo', 'Open-Meteo'],
    ['copernicus', 'Copernicus Marine'],
    ['erddap', 'NOAA ERDDAP'],
  ] as const).filter(([key]) => serviceStatus[key]?.status === 'down').map(([, label]) => label)
  const { getLocation } = useGeolocation()
  const [selectedDay, setSelectedDay] = useState(0)
  // Flipping between forecast days is the single most-repeated interaction on
  // the core decision screen — morph the score card via the View Transitions
  // API instead of hard-swapping it. See src/lib/viewTransition.ts. Stable
  // references so the memoized day selectors (ForecastStrip/WeeklyOverview)
  // aren't re-rendered on every parent render. The week-view variant also
  // exits week view *inside* the same transition, so both state changes land
  // in one snapshot rather than the swap hard-cutting after the morph.
  const selectDay = useCallback((i: number) => startDayTransition(() => setSelectedDay(i)), [])
  const selectDayFromWeek = useCallback(
    (i: number) => startDayTransition(() => { setSelectedDay(i); setWeekView(false) }),
    [],
  )
  const [locations, setLocations] = useState<Location[]>([])
  const [currentLat, setCurrentLat] = useState<number | null>(null)
  const [currentLon, setCurrentLon] = useState<number | null>(null)
  const [currentName, setCurrentName] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [uiError, setUiError] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [units, setUnits] = useState<'ft' | 'm'>(() => {
    try {
      const v = localStorage.getItem('dv_units')
      return v === 'ft' || v === 'm' ? v : 'ft'
    } catch { return 'ft' }
  })
  const [weekView, setWeekView] = useState(false)
  const [diveDepth, setDiveDepth] = useState<number>(() => {
    const VALID_DEPTHS = [5, 10, 15, 20, 30]
    try {
      const stored = localStorage.getItem('diveDepth')
      const parsed = stored !== null ? Number(stored) : NaN
      return VALID_DEPTHS.includes(parsed) ? parsed : 30
    } catch {
      return 30
    }
  })

  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const autoLoadedRef = useRef(false)
  const lastSelectedRef = useRef<{ lat: number; lon: number; name: string; locationId?: number }>({
    lat: 0, lon: 0, name: '',
  })
  const forecastLayoutRef = useRef<HTMLDivElement>(null)
  const [forecastPaneWide, setForecastPaneWide] = useState(false)
  const [pendingAuthIntent, setPendingAuthIntent] = useState<AuthIntent | null>(null)

  // Admin status is decided by the server (via /profile/me's is_admin), never
  // by a client flag or a value baked into the bundle. The backend also
  // re-checks admin identity on every /admin/* route, so this only gates UI.
  const [isAdmin, setIsAdmin] = useState(false)
  // `isAdmin` starts false and only becomes true once /profile/me answers, so
  // an admin-gated route must wait for the answer rather than render its
  // "access required" state during the round-trip.
  const [adminChecked, setAdminChecked] = useState(false)

  const requestAuth = useCallback((intent?: AuthIntent) => {
    setPendingAuthIntent(intent ?? { type: 'route', path: currentPath })
    setShowAuth(true)
  }, [currentPath])

  const handleActionError = useCallback((rawError: unknown, context: 'forecast' | 'report' | 'profile' | 'map', intent?: AuthIntent) => {
    const failure = toUserFacingError(rawError, context)
    setUiError(failure.message)
    trackClientEvent('ui.action_failed', {
      context,
      status: failure.status,
      code: failure.telemetryCode,
      requiresAuth: failure.requiresAuth,
    })
    if (failure.requiresAuth) requestAuth(intent)
  }, [requestAuth])
  useEffect(() => {
    const el = forecastLayoutRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setForecastPaneWide(entry.contentRect.width >= 1040)
    })
    observer.observe(el)
    setForecastPaneWide(el.getBoundingClientRect().width >= 1040)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!user) { setIsAdmin(false); setAdminChecked(false); return }
    let cancelled = false
    setAdminChecked(false)
    getMyProfile()
      .then(p => { if (!cancelled) setIsAdmin(!!p.is_admin) })
      .catch(() => { if (!cancelled) setIsAdmin(false) })
      .finally(() => { if (!cancelled) setAdminChecked(true) })
    return () => { cancelled = true }
  }, [user])

  // Auto-close auth modal when user signs in
  useEffect(() => {
    if (user) setShowAuth(false)
  }, [user])

  useEffect(() => {
    if (!user || !pendingAuthIntent) return
    const intent = pendingAuthIntent
    setPendingAuthIntent(null)
    if (intent.type === 'route') {
      navigate(intent.path)
      return
    }
    if (intent.type === 'save-location') {
      void handleSaveLocation(intent.isPrivate)
      return
    }
    if (intent.type === 'reselect-spot') {
      const { lat, lon, name, locationId } = lastSelectedRef.current
      if (!name) return
      void handleSpotSelect(lat, lon, name, locationId)
    }
  // navigate/handlers are stable enough for post-auth replay.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingAuthIntent])

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((e) => {
        const failure = toUserFacingError(e, 'map')
        setUiError(failure.message)
        trackClientEvent('ui.action_failed', {
          context: 'map',
          status: failure.status,
          code: failure.telemetryCode,
          requiresAuth: failure.requiresAuth,
        })
        if (failure.requiresAuth) {
          setPendingAuthIntent({ type: 'route', path: window.location.pathname })
          setShowAuth(true)
        }
      })
  }, [user])

  useEffect(() => {
    if (forecast) {
      const today = new Date().toISOString().split('T')[0]
      const todayIdx = forecast.days.findIndex(d => d.date === today)
      setSelectedDay(todayIdx >= 0 ? todayIdx : Math.max(0, forecast.days.length - 1))
    }
  }, [forecast])

  // Reset week view when leaving forecast
  useEffect(() => {
    if (currentPath !== '/forecast') setWeekView(false)
  }, [currentPath])

  useEffect(() => {
    setUiError('')
  }, [currentPath])

  const prevUnitsRef = useRef<'ft' | 'm'>(units)
  useEffect(() => {
    if (prevUnitsRef.current === units) return
    prevUnitsRef.current = units
    if (currentLat !== null && currentLon !== null) {
      searchByCoords(currentLat, currentLon, currentName || undefined, selectedLocationId ?? undefined, units)
    }
  }, [units, currentLat, currentLon, currentName, selectedLocationId, searchByCoords])

  // Persist units preference
  useEffect(() => {
    try { localStorage.setItem('dv_units', units) } catch {}
  }, [units])

  // Persist last known forecast with its units so restore can reject a units mismatch
  useEffect(() => {
    if (!forecast) return
    try { localStorage.setItem('dv_last_forecast', JSON.stringify({ units, forecast, savedAt: Date.now() })) } catch {}
  }, [forecast, units])

  // Persist last searched location
  useEffect(() => {
    if (currentLat === null || currentLon === null) return
    try {
      localStorage.setItem('dv_last_location', JSON.stringify({
        lat: currentLat, lon: currentLon, name: currentName, locationId: selectedLocationId,
      }))
    } catch {}
  }, [currentLat, currentLon, currentName, selectedLocationId])

  // On startup, restore the last location so the map can re-center on it. Only
  // when the initial route actually shows a forecast do we restore the stale
  // forecast and revalidate in the background — that way returning users on a
  // forecast page never see the full "Reading conditions..." spinner, while the
  // home page ("/") loads without firing an unexpected conditions fetch.
  useEffect(() => {
    if (authLoading || autoLoadedRef.current) return
    autoLoadedRef.current = true
    try {
      const locRaw = localStorage.getItem('dv_last_location')
      if (!locRaw) return
      const loc = JSON.parse(locRaw) as { lat: number; lon: number; name: string; locationId: number | null }
      if (typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return
      setCurrentLat(loc.lat)
      setCurrentLon(loc.lon)
      setCurrentName(typeof loc.name === 'string' ? loc.name : '')
      setSelectedLocationId(typeof loc.locationId === 'number' ? loc.locationId : null)
      lastSelectedRef.current = {
        lat: loc.lat,
        lon: loc.lon,
        name: typeof loc.name === 'string' ? loc.name : '',
        locationId: typeof loc.locationId === 'number' ? loc.locationId : undefined,
      }
      // Home page has no forecast — don't restore a snapshot or fetch conditions.
      if (!FORECAST_ROUTES.includes(currentPath)) return
      const forecastRaw = localStorage.getItem('dv_last_forecast')
      if (forecastRaw) {
        const stored = JSON.parse(forecastRaw) as { units?: string; forecast?: ForecastResponse }
        if (stored?.units === units && stored.forecast) {
          init(stored.forecast, units)
        }
      }
      searchByCoords(loc.lat, loc.lon, loc.name, loc.locationId ?? undefined, units)
    } catch {}
    // init and searchByCoords are stable (useCallback []); units & currentPath captured once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  const getLocalSuggestions = (query: string): GeocodingResult[] => {
    const q = query.toLowerCase()
    const results: GeocodingResult[] = []
    const isNearExisting = (lat: number, lon: number) =>
      results.some(r => Math.abs(r.latitude - lat) < 0.01 && Math.abs(r.longitude - lon) < 0.01)
    for (const l of locations) {
      if (l.name.toLowerCase().includes(q) && !isNearExisting(l.lat, l.lon)) {
        results.push({ name: l.name, latitude: l.lat, longitude: l.lon })
      }
    }
    return results.slice(0, 8)
  }

  const handleLocate = async () => {
    setUiError('')
    try {
      const coords = await getLocation()
      setCurrentLat(coords.latitude)
      setCurrentLon(coords.longitude)
      const name = `${coords.latitude.toFixed(2)}N, ${Math.abs(coords.longitude).toFixed(2)}${coords.longitude >= 0 ? 'E' : 'W'}`
      setCurrentName(name)
      const matched = findLocationByCoords(coords.latitude, coords.longitude, locations)
      setSelectedLocationId(matched?.id ?? null)
      await searchByCoords(coords.latitude, coords.longitude, name, matched?.id, units)
      navigate('/forecast')
    } catch (e) {
      handleActionError(e, 'map')
    }
  }

  const handleSearch = async (query: string) => {
    const results = getLocalSuggestions(query)
    if (results.length) {
      const loc = results[0]
      if (!loc) return
      setCurrentLat(loc.latitude)
      setCurrentLon(loc.longitude)
      const name = formatLocationName(loc)
      setCurrentName(name)
      const matched = findLocationByCoords(loc.latitude, loc.longitude, locations)
      setSelectedLocationId(matched?.id ?? null)
      await searchByCoords(loc.latitude, loc.longitude, name, matched?.id, units)
      navigate('/forecast')
    }
  }

  const handleSaveLocation = async (isPrivate = false) => {
    setUiError('')
    if (currentLat === null || currentLon === null || !currentName) return
    if (!user) { requestAuth({ type: 'save-location', isPrivate }); return }
    try {
      let encrypted: { encrypted_lat: string; encrypted_lon: string } | undefined
      if (isPrivate) {
        encrypted = await encryptCoords(currentLat, currentLon, user.id)
      }
      const loc = await createLocation(currentName, currentLat, currentLon, false, encrypted)
      const savedLoc = isPrivate ? { ...loc, lat: currentLat, lon: currentLon } : loc
      setLocations(prev => [...prev.filter(l => l.id !== savedLoc.id), savedLoc])
      setSelectedLocationId(savedLoc.id)
    } catch (e) {
      handleActionError(e, 'map', { type: 'save-location', isPrivate })
    }
  }

  const handleReportClick = () => {
    setUiError('')
    if (!user) { requestAuth({ type: 'route', path: '/report' }); return }
    navigate('/report')
  }

  const handleSpotSelect = async (lat: number, lon: number, name: string, locationId?: number) => {
    setUiError('')
    lastSelectedRef.current = { lat, lon, name, locationId }
    setCurrentLat(lat)
    setCurrentLon(lon)
    setCurrentName(name)
    const resolvedId = locationId ?? findLocationByCoords(lat, lon, locations)?.id ?? null
    setSelectedLocationId(resolvedId)
    await searchByCoords(lat, lon, name, resolvedId ?? undefined, units)
    navigate('/forecast')
  }

  const todayIndex = forecast?.days.findIndex(d => d.date === new Date().toISOString().split('T')[0]) ?? -1
  const depthOptionsM = [5, 10, 15, 20, 30]
  const formatDepthOption = (metres: number) => {
    if (units === 'ft') return `${Math.round(metres * 3.28084)}ft${metres === 30 ? '+' : ''}`
    return `${metres}m${metres === 30 ? '+' : ''}`
  }
  const useWideShell = currentPath === '/' || MAP_GROUP_ROUTES.includes(currentPath)

  if (authLoading) return (
    <div className={styles.bootScreen}>
      <IconGauge className={styles.bootMark} aria-hidden="true" />
    </div>
  )

  const locationSearch = (
    <SearchBar
      onSearch={handleSearch}
      onLocate={handleLocate}
      getSuggestions={async (q) => getLocalSuggestions(q)}
      onSelectSuggestion={async (r) => {
        const name = formatLocationName(r)
        setCurrentLat(r.latitude)
        setCurrentLon(r.longitude)
        setCurrentName(name)
        const matched = findLocationByCoords(r.latitude, r.longitude, locations)
        setSelectedLocationId(matched?.id ?? null)
        await searchByCoords(r.latitude, r.longitude, name, matched?.id, units)
        navigate('/forecast')
      }}
    />
  )

  return (
    <ErrorBoundary
      path={currentPath}
      resetKey={currentPath}
      onRecover={(target) => {
        if (target === 'home') navigate('/')
      }}
    >
    <div className={styles.container}>

      {/* Skip to main content — keyboard navigation */}
      <a href="#main-content" className="skip-link">Skip to content</a>

      <Suspense fallback={null}>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </Suspense>

      <header className={styles.header}>
        <div className={styles.headerRow}>
          <button
            type="button"
            className={styles.logo}
            aria-label="DepthViz — go to home"
            onClick={() => navigate('/')}
          >
            <IconGauge className={styles.logoMark} aria-hidden="true" />
            DEPTH<span>VIZ</span>
          </button>
          <button
            type="button"
            className={user ? styles.authBtnAvatar : styles.authBtn}
            onClick={() => { if (user) navigate('/profile'); else requestAuth({ type: 'route', path: '/profile' }) }}
            aria-label={user ? `View profile for ${user.email?.split('@')[0] ?? 'user'}` : 'Sign in to your account'}
          >
            {user ? (user.email?.[0] ?? 'U').toUpperCase() : (<><IconUser aria-hidden="true" /><span>Sign in</span></>)}
          </button>
        </div>
        <div className={styles.tagline}>Underwater visibility forecast for spearfishers &amp; freedivers</div>
      </header>

      <TopNav />

      <PwaStatus />

      {downServices.length > 0 && (
        <div className={styles.outageBanner} role="alert" aria-live="polite">
          Service disruption: {downServices.join(' · ')} — forecasts may be unavailable
        </div>
      )}

      {currentPath !== '/' && LOCATION_SEARCH_ROUTES.includes(currentPath) && (
        <div className={styles.locationSearch}>{locationSearch}</div>
      )}

      {(uiError || error) && <div className={styles.error} role="alert">{uiError || error}</div>}

      {status === 'success' && forecast && FORECAST_ROUTES.includes(currentPath) && (
        <div className={styles.forecastNav}>
          <div className={styles.forecastTabs} role="navigation" aria-label="Forecast views">
            <button
              className={`${styles.navBtn} ${currentPath === '/forecast' && !weekView ? styles.navActive : ''}`}
              onClick={() => { navigate('/forecast'); setWeekView(false) }}
              aria-current={currentPath === '/forecast' && !weekView ? 'page' : undefined}
            >
              Forecast
            </button>
            <button
              className={`${styles.navBtn} ${currentPath === '/forecast' && weekView ? styles.navActive : ''}`}
              onClick={() => { navigate('/forecast'); setWeekView(true) }}
              aria-label="Weekly conditions overview"
              aria-current={currentPath === '/forecast' && weekView ? 'page' : undefined}
            >
              Week
            </button>
            <button
              className={`${styles.navBtn} ${currentPath === '/tides' ? styles.navActive : ''}`}
              onClick={() => navigate('/tides')}
              aria-current={currentPath === '/tides' ? 'page' : undefined}
            >
              Tides
            </button>
          </div>
          <div className={styles.forecastActions} aria-label="Forecast actions">
          <button
            className={`${styles.navBtn} ${styles.navBtnPrimary} ${currentPath === '/report' ? styles.navActive : ''}`}
            onClick={() => handleReportClick()}
            aria-label={!user ? 'Log Dive (sign in required)' : 'Log Dive'}
            aria-current={currentPath === '/report' ? 'page' : undefined}
          >
            Log Dive
            {!user && <IconLock className={styles.lockIcon} aria-hidden="true" />}
          </button>
          <button
            className={`${styles.navBtn} ${selectedLocationId ? styles.navActive : ''}`}
            onClick={() => handleSaveLocation(false)}
            disabled={!!selectedLocationId}
            aria-label={selectedLocationId ? 'Location already saved' : !user ? 'Save this location (sign in required)' : 'Save this location'}
          >
            {selectedLocationId ? <><IconCheck className={styles.lockIcon} aria-hidden="true" /><span>Saved</span></> : <><IconPlus className={styles.lockIcon} aria-hidden="true" /><span>Save</span>{!user && <IconLock className={styles.lockIcon} aria-hidden="true" />}</>}
          </button>
          {!selectedLocationId && (
            <button
              className={styles.navBtn}
              onClick={() => handleSaveLocation(true)}
              aria-label={!user ? 'Save as private spot (sign in required)' : 'Save as private spot — coordinates encrypted'}
            >
              <IconLock className={styles.lockIcon} aria-hidden="true" /><span>Private</span>
            </button>
          )}
          {selectedLocationId && (
            <button
              className={`${styles.navBtn} ${currentPath === '/history' ? styles.navActive : ''}`}
              onClick={() => navigate('/history')}
              aria-current={currentPath === '/history' ? 'page' : undefined}
            >
              Dive Logs
            </button>
          )}
          {user && (
            <button
              className={`${styles.navBtn} ${currentPath === '/dispute' ? styles.navActive : ''}`}
              onClick={() => navigate('/dispute')}
              aria-label="Report incorrect forecast data"
              aria-current={currentPath === '/dispute' ? 'page' : undefined}
            >
              Report Issue
            </button>
          )}
          </div>
        </div>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={useWideShell ? styles.mainWide : styles.main}
      >
        <Routes>
          {/* Profile */}
          <Route path="/profile" element={
            user ? (
              <Suspense fallback={null}>
                <ProfilePanel
                  onClose={() => navigate(-1)}
                  onNavigateFriends={() => navigate('/friends')}
                  onAuthRequired={() => requestAuth({ type: 'route', path: '/profile' })}
                />
              </Suspense>
            ) : null
          } />

          {/* Friends */}
          <Route path="/friends" element={
            user ? (
              <Suspense fallback={null}>
                <FriendsPanel onClose={() => navigate(-1)} />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Sign in to manage friends</div>
                <button className={styles.navBtn} onClick={() => requestAuth({ type: 'route', path: '/friends' })} style={{ marginTop: 16 }}>Sign in</button>
              </div>
            )
          } />

          {/* Legal pages — reads :page param directly so direct URLs work */}
          <Route path="/legal/:page" element={<LegalRouteWrapper onBack={() => navigate(-1)} />} />

          {/* Weight belt calculator — freediving neutral-buoyancy estimate */}
          <Route path="/weight" element={
            <Suspense fallback={null}>
              <WeightCalculator onNavigateLegal={(p) => navigate(`/legal/${p}`)} />
            </Suspense>
          } />

          {/* Feed */}
          <Route path="/feed" element={
            <Suspense fallback={null}>
              <FeedPage user={user} />
            </Suspense>
          } />

          {/* Catches */}
          <Route path="/catches" element={
            <Suspense fallback={null}>
              <CatchesPage user={user} locations={locations} onShowAuth={() => requestAuth({ type: 'route', path: '/catches' })} />
            </Suspense>
          } />

          {/* Home — website landing page (news + quick links) */}
          <Route path="/" element={
            <Suspense fallback={null}>
              <HomePage locationSearch={locationSearch} />
            </Suspense>
          } />

          {/* News / announcements */}
          <Route path="/news" element={
            <Suspense fallback={null}>
              <NewsPage isAdmin={isAdmin} />
            </Suspense>
          } />

          {/* Discussion forum. The static /forum/thread/:id segment is declared
              before /forum/:slug so React Router ranks it ahead of the category
              route and a thread link never resolves as a category slug. */}
          <Route path="/forum" element={
            <Suspense fallback={null}>
              <ForumIndex />
            </Suspense>
          } />
          <Route path="/forum/thread/:id" element={
            <Suspense fallback={null}>
              <ForumThreadPage user={user} onShowAuth={() => requestAuth({ type: 'route', path: currentPath })} />
            </Suspense>
          } />
          <Route path="/forum/:slug" element={
            <Suspense fallback={null}>
              <ForumCategoryPage user={user} onShowAuth={() => requestAuth({ type: 'route', path: currentPath })} />
            </Suspense>
          } />

          {/* Competitions */}
          <Route path="/competition" element={
            <Suspense fallback={<div className={styles.loadingText}>Loading competitions…</div>}>
              <CompetitionRegister />
            </Suspense>
          } />

          {/* Competition organiser console. Admin-only, but the gate here is UI
              only — the backend re-checks admin identity on every /admin/*
              request, so this never stands in for a real security boundary. */}
          <Route path="/admin/competition" element={
            !user ? (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Sign in to open competition ops</div>
                <button className={styles.navBtn} onClick={() => requestAuth({ type: 'route', path: '/admin/competition' })} style={{ marginTop: 16 }}>Sign in</button>
              </div>
            ) : !adminChecked ? (
              <div className={styles.loadingText}>Checking access…</div>
            ) : (
              <Suspense fallback={<div className={styles.loadingText}>Loading competition ops…</div>}>
                <CompetitionAdmin isAdmin={isAdmin} />
              </Suspense>
            )
          } />

          {/* Map / Dashboard */}
          <Route path="/map" element={
            <>
              {(status === 'loading' || isRevalidating) && (
                <div className={styles.loadingBar} role="status" aria-live="polite">{isRevalidating ? 'Fetching conditions...' : 'Reading conditions...'}</div>
              )}
              {/* Logged-in users see their saved places dashboard; the map is below */}
              {user && status === 'idle' && locations.filter(l => !l.is_predefined).length > 0 && (
                <Suspense fallback={null}>
                  <>
                    <PlacesDashboard
                      locations={locations.filter(l => !l.is_predefined).slice(0, 4)}
                      userUid={user.id}
                      units={units}
                      onSelectLocation={handleSpotSelect}
                    />
                    {locations.filter(l => !l.is_predefined).length > 4 && (
                      <div className={styles.mapPlacesActions}>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/places')}>
                          View all places
                        </Button>
                      </div>
                    )}
                  </>
                </Suspense>
              )}
              <Suspense fallback={null}>
                <SpotsMap
                  onSelectSpot={handleSpotSelect}
                  center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined}
                  user={user}
                  onShowAuth={() => requestAuth({ type: 'route', path: '/map' })}
                  locations={locations}
                  onLocationCreated={(created) => setLocations(prev => [...prev.filter(l => l.id !== created.id), created])}
                />
              </Suspense>
            </>
          } />

          {/* Best Visibility */}
          <Route path="/best" element={
            <Suspense fallback={null}>
              <BestVisibility onSelectSpot={handleSpotSelect} />
            </Suspense>
          } />

          {/* My Places */}
          <Route path="/places" element={
            user ? (
              <Suspense fallback={null}>
                <SavedPlaces
                  locations={locations}
                  onSelectLocation={handleSpotSelect}
                  onDelete={id => setLocations(prev => prev.filter(l => l.id !== id))}
                  userUid={user.id}
                  onAuthRequired={() => requestAuth({ type: 'route', path: '/places' })}
                />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Sign in to save places</div>
                <button className={styles.navBtn} onClick={() => requestAuth({ type: 'route', path: '/places' })} style={{ marginTop: 16 }}>Sign in</button>
              </div>
            )
          } />

          {/* Forecast view */}
          <Route path="/forecast" element={
            <div className={styles.forecastRouteLayout} ref={forecastLayoutRef}>
              <div className={styles.forecastPrimary}>
                {status === 'loading' && (
                  <div className={styles.loading} role="status" aria-live="polite" aria-label="Loading conditions">
                    <div className={styles.sonar} aria-hidden="true" />
                    <div className={styles.loadingText}>Reading conditions...</div>
                  </div>
                )}
                {status === 'idle' && (
                  <div className={styles.empty}>
                    <IconGauge className={styles.emptyIcon} aria-hidden="true" />
                    <div className={styles.emptyText}>Enter a location to check<br />underwater visibility conditions</div>
                  </div>
                )}
                {isRevalidating && (
                  <div className={styles.loadingBar} role="status" aria-live="polite">Fetching conditions...</div>
                )}
                {status === 'success' && forecast && (
                  <>
                    {(forecast.bias_offset !== null || forecast.global_bias_offset !== null || forecast.calibration_active) && (
                      <div className={styles.biasNote} role="status">
                        AI correction active
                        {forecast.model_confidence !== 'none' && (
                          <> &middot; confidence: {forecast.model_confidence}</>
                        )}
                        {' '}&middot; {forecast.report_count} community report{forecast.report_count !== 1 ? 's' : ''}
                        {forecast.global_bias_offset !== null && (
                          <> &middot; global {forecast.global_bias_offset > 0 ? '+' : ''}{forecast.global_bias_offset.toFixed(1)}m</>
                        )}
                        {forecast.bias_offset !== null && (
                          <> &middot; local {forecast.bias_offset > 0 ? '+' : ''}{forecast.bias_offset?.toFixed(1)}m</>
                        )}
                      </div>
                    )}
                    <div className={styles.forecastControls}>
                      <SegmentedControl
                        ariaLabel="Forecast units"
                        size="sm"
                        value={units}
                        onChange={setUnits}
                        options={[
                          { value: 'ft', label: 'FT' },
                          { value: 'm', label: 'M' },
                        ]}
                      />
                      <div className={styles.depthSelect}>
                        <label className={styles.depthSelectLabel} htmlFor="dive-depth">Max depth</label>
                        <select
                          id="dive-depth"
                          className={styles.depthSelectInput}
                          value={diveDepth}
                          onChange={e => {
                            const v = Number(e.target.value)
                            setDiveDepth(v)
                            try { localStorage.setItem('diveDepth', String(v)) } catch {}
                          }}
                          aria-label={`Your maximum dive depth in ${units === 'ft' ? 'feet' : 'metres'}`}
                        >
                          {depthOptionsM.map(depth => (
                            <option key={depth} value={depth}>{formatDepthOption(depth)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {weekView ? (
                      <Suspense fallback={null}>
                        <WeeklyOverview
                          days={forecast.days}
                          locationName={forecast.location_name}
                          units={units}
                          selectedIndex={selectedDay}
                          onSelectDay={selectDayFromWeek}
                        />
                      </Suspense>
                    ) : (
                      <>
                        <ForecastStrip days={forecast.days} selectedIndex={selectedDay} onSelect={selectDay} units={units} />
                        {forecast.days[selectedDay] && (
                          <>
                            <DiveScoreCard
                              day={forecast.days[selectedDay]}
                              locationName={forecast.location_name}
                              forecast={{ report_count: forecast.report_count, model_confidence: forecast.model_confidence }}
                              units={units}
                              days={forecast.days}
                              todayIndex={todayIndex >= 0 ? todayIndex : selectedDay}
                              onJumpToBestWindow={selectDay}
                            />
                            <DayDetail
                              day={forecast.days[selectedDay]}
                              locationName={forecast.location_name}
                              lat={forecast.lat}
                              lon={forecast.lon}
                              reportCount={forecast.report_count}
                              units={units}
                              isAdmin={isAdmin}
                              biasOffset={forecast.bias_offset}
                              globalBiasOffset={forecast.global_bias_offset}
                              maxDiveDepth={diveDepth}
                              days={forecast.days}
                              selectedIndex={selectedDay}
                              onSelectDay={selectDay}
                            />
                          </>
                        )}
                        {/* Per-site bathymetry/substrate editor for saved spots (#155) —
                            lets the owner sharpen the seabed-resuspension forecast. */}
                        {(() => {
                          const savedLoc = locations.find(l => l.id === selectedLocationId)
                          if (!user || !savedLoc || savedLoc.is_predefined) return null
                          return (
                            <SeabedEditor
                              location={savedLoc}
                              onUpdated={(updated) => {
                                setLocations(prev => prev.map(l => l.id === updated.id ? updated : l))
                                if (currentLat !== null && currentLon !== null) {
                                  searchByCoords(currentLat, currentLon, currentName || undefined, updated.id, units)
                                }
                              }}
                            />
                          )
                        })()}
                      </>
                    )}
                  </>
                )}
              </div>
              {status === 'success' && forecast && currentLat !== null && currentLon !== null && forecastPaneWide && (
                <aside className={styles.forecastSupporting} aria-label="Supporting tide view">
                  <div className={styles.supportingPaneLabel}>Tides</div>
                  <Suspense fallback={<div className={styles.loadingText}>Loading tides…</div>}>
                    <TidesPage
                      lat={currentLat}
                      lon={currentLon}
                      locationName={forecast.location_name}
                      embedded
                    />
                  </Suspense>
                </aside>
              )}
            </div>
          } />

          {/* Tides */}
          <Route path="/tides" element={
            currentLat !== null && currentLon !== null ? (
              <Suspense fallback={null}>
                <TidesPage lat={currentLat} lon={currentLon} locationName={currentName} />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Search for a location first to view tides</div>
              </div>
            )
          } />

          {/* Report */}
          <Route path="/report" element={
            user && forecast ? (
              <Suspense fallback={null}>
                <ReportForm
                  day={forecast.days[todayIndex] ?? forecast.days[selectedDay] ?? null}
                  allDays={forecast.days}
                  locations={locations}
                  onSubmitted={() => navigate('/forecast')}
                  initialLocationId={selectedLocationId}
                  units={units}
                  onAuthRequired={() => requestAuth({ type: 'route', path: '/report' })}
                />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>
                  {!user ? 'Sign in to log a dive report' : 'Search for a location first'}
                </div>
              </div>
            )
          } />

          {/* Apnea training tables */}
          <Route path="/training" element={
            <Suspense fallback={null}>
              <ApneaTablesPage user={user} onShowAuth={() => requestAuth({ type: 'route', path: '/training' })} />
            </Suspense>
          } />
          <Route path="/training/new" element={
            user ? (
              <Suspense fallback={null}>
                <ApneaTableEditor mode="create" />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Sign in to build a training table</div>
                <button className={styles.navBtn} onClick={() => requestAuth({ type: 'route', path: '/training/new' })} style={{ marginTop: 16 }}>Sign in</button>
              </div>
            )
          } />
          <Route path="/training/:id/edit" element={
            user ? (
              <Suspense fallback={null}>
                <ApneaTableEditor mode="edit" />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Sign in to edit your tables</div>
                <button className={styles.navBtn} onClick={() => requestAuth({ type: 'route', path: currentPath })} style={{ marginTop: 16 }}>Sign in</button>
              </div>
            )
          } />
          {/* Shared-table links (QR codes) — table data travels in the URL
              fragment, so this static segment must win over /training/:id,
              which React Router's ranking guarantees. */}
          <Route path="/training/shared" element={
            <Suspense fallback={null}>
              <ApneaSharedTable user={user} onShowAuth={() => requestAuth({ type: 'route', path: currentPath })} />
            </Suspense>
          } />
          <Route path="/training/:id" element={
            <Suspense fallback={null}>
              <ApneaTableRunner user={user} onShowAuth={() => requestAuth({ type: 'route', path: currentPath })} />
            </Suspense>
          } />

          {/* Location History */}
          <Route path="/history" element={
            selectedLocationId ? (
              <Suspense fallback={null}>
                <LocationHistory locationId={selectedLocationId} locationName={currentName} />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Select a saved location to view dive logs</div>
              </div>
            )
          } />

          {/* Data Dispute */}
          <Route path="/dispute" element={
            user ? (
              <Suspense fallback={null}>
                <DisputeForm
                  locations={locations}
                  defaultLocationId={selectedLocationId}
                  defaultDate={forecast?.days[selectedDay]?.date}
                  onClose={() => navigate(forecast ? '/forecast' : '/')}
                />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Sign in to report incorrect data</div>
                <button className={styles.navBtn} onClick={() => requestAuth({ type: 'route', path: '/dispute' })} style={{ marginTop: 16 }}>Sign in</button>
              </div>
            )
          } />
        </Routes>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className={styles.bottomNav} aria-label="Main navigation">
        <button
          className={`${styles.bottomNavBtn} ${currentPath === '/' ? styles.bottomNavActive : ''}`}
          onClick={() => navigate('/')}
          aria-label="Home"
          aria-current={currentPath === '/' ? 'page' : undefined}
        >
          <span className={styles.bottomNavIconWrap}><IconHome className={styles.bottomNavIcon} /></span>
          <span>Home</span>
        </button>
        <button
          className={`${styles.bottomNavBtn} ${MAP_GROUP_ROUTES.includes(currentPath) ? styles.bottomNavActive : ''}`}
          onClick={() => navigate('/map')}
          aria-label="Map"
          aria-current={MAP_GROUP_ROUTES.includes(currentPath) ? 'page' : undefined}
        >
          <span className={styles.bottomNavIconWrap}><IconCompass className={styles.bottomNavIcon} /></span>
          <span>Map</span>
        </button>
        <button
          className={`${styles.bottomNavBtn} ${['/feed', '/catches', '/forum', '/news'].some(path => currentPath.startsWith(path)) ? styles.bottomNavActive : ''}`}
          onClick={() => navigate('/feed')}
          aria-label="Community"
          aria-current={['/feed', '/catches', '/forum', '/news'].some(path => currentPath.startsWith(path)) ? 'page' : undefined}
        >
          <span className={styles.bottomNavIconWrap}><IconActivity className={styles.bottomNavIcon} /></span>
          <span>Community</span>
        </button>
        <button
          className={`${styles.bottomNavBtn} ${currentPath.startsWith('/training') ? styles.bottomNavActive : ''}`}
          onClick={() => navigate('/training')}
          aria-label="Apnea training tables"
          aria-current={currentPath.startsWith('/training') ? 'page' : undefined}
        >
          <span className={styles.bottomNavIconWrap}><IconTimer className={styles.bottomNavIcon} /></span>
          <span>Train</span>
        </button>
        <button
          className={`${styles.bottomNavBtn} ${currentPath === '/profile' ? styles.bottomNavActive : ''}`}
          onClick={() => { if (user) navigate('/profile'); else requestAuth({ type: 'route', path: '/profile' }) }}
          aria-label={user ? 'Profile' : 'Profile (sign in required)'}
          aria-current={currentPath === '/profile' ? 'page' : undefined}
        >
          <span className={styles.bottomNavIconWrap}><IconUser className={styles.bottomNavIcon} /></span>
          <span>Profile</span>
        </button>
      </nav>

      <footer className={styles.footer} role="contentinfo">
        <div className={styles.footerAttribution}>
          <span>Data: Open-Meteo Weather</span>
          <span aria-hidden="true"> · </span>
          <span>Copernicus Marine</span>
          <span aria-hidden="true"> · </span>
          <span>North Sea baseline</span>
        </div>
        <div className={styles.footerDisclaimer}>
          Not a substitute for local knowledge · Always dive with a buddy
        </div>
        <nav className={styles.footerLinks} aria-label="Legal">
          {(Object.keys(LEGAL_LABELS) as LegalPageType[]).map(p => (
            <button
              key={p}
              className={styles.footerLink}
              onClick={() => navigate(`/legal/${p}`)}
            >
              {LEGAL_LABELS[p]}
            </button>
          ))}
        </nav>
        <a
          href="https://buymeacoffee.com/depthviz"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.bmcLink}
          aria-label="Support DepthViz — Buy me a coffee (opens in new tab)"
        >
          Buy me a coffee
        </a>
        <div className={styles.copyright}>
          &copy; {new Date().getFullYear()} DepthViz. All rights reserved.
        </div>
      </footer>

      <CookieBanner onNavigate={(p) => navigate(`/legal/${p}`)} />
    </div>
    </ErrorBoundary>
  )
}
