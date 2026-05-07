import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useConditions } from './hooks/useConditions'
import { useGeolocation } from './hooks/useGeolocation'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SearchBar } from './components/SearchBar'
import { ForecastStrip } from './components/ForecastStrip'
import { DayDetail } from './components/DayDetail'
import { CookieBanner } from './components/CookieBanner'
import { getLocations, createLocation } from './lib/api'
import { encryptCoords } from './lib/spotCrypto'
import { formatLocationName } from './types'
import type { GeocodingResult, Location } from './types'
import type { LegalPageType } from './components/LegalPage'
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

/** Reads the :page URL param so direct links to /legal/terms work correctly. */
function LegalRouteWrapper({ onBack }: { onBack: () => void }) {
  const { page } = useParams<{ page: string }>()
  const validPages: LegalPageType[] = ['privacy', 'terms', 'cookies', 'security', 'contact', 'accessibility']
  const resolved: LegalPageType = validPages.includes(page as LegalPageType) ? (page as LegalPageType) : 'privacy'
  return (
    <Suspense fallback={null}>
      <LegalPage page={resolved} onBack={onBack} />
    </Suspense>
  )
}

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { status, forecast, error, isRevalidating, searchByCoords } = useConditions()
  const { getLocation } = useGeolocation()
  const [selectedDay, setSelectedDay] = useState(0)
  const [locations, setLocations] = useState<Location[]>([])
  const [currentLat, setCurrentLat] = useState<number | null>(null)
  const [currentLon, setCurrentLon] = useState<number | null>(null)
  const [currentName, setCurrentName] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [units, setUnits] = useState<'ft' | 'm'>('ft')

  const navigate = useNavigate()
  const location = useLocation()

  // Auto-close auth modal when user signs in
  useEffect(() => {
    if (user) setShowAuth(false)
  }, [user])

  useEffect(() => {
    getLocations().then(setLocations).catch(() => {})
  }, [user])

  useEffect(() => {
    if (forecast) {
      const today = new Date().toISOString().split('T')[0]
      const todayIdx = forecast.days.findIndex(d => d.date === today)
      setSelectedDay(todayIdx >= 0 ? todayIdx : Math.max(0, forecast.days.length - 1))
    }
  }, [forecast])

  const prevUnitsRef = useRef<'ft' | 'm'>(units)
  useEffect(() => {
    if (prevUnitsRef.current === units) return
    prevUnitsRef.current = units
    if (currentLat !== null && currentLon !== null) {
      searchByCoords(currentLat, currentLon, currentName || undefined, selectedLocationId ?? undefined, units)
    }
  }, [units, currentLat, currentLon, currentName, selectedLocationId, searchByCoords])

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
    } catch (e) { console.error(e) }
  }

  const handleSearch = async (query: string) => {
    const results = getLocalSuggestions(query)
    if (results.length) {
      const loc = results[0]
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
    if (currentLat === null || currentLon === null || !currentName) return
    if (!user) { setShowAuth(true); return }
    try {
      let encrypted: { encrypted_lat: string; encrypted_lon: string } | undefined
      if (isPrivate) {
        encrypted = await encryptCoords(currentLat, currentLon, user.id)
      }
      const loc = await createLocation(currentName, currentLat, currentLon, false, encrypted)
      const savedLoc = isPrivate ? { ...loc, lat: currentLat, lon: currentLon } : loc
      setLocations(prev => [...prev.filter(l => l.id !== savedLoc.id), savedLoc])
      setSelectedLocationId(savedLoc.id)
    } catch (e) { console.error(e) }
  }

  const handleReportClick = () => {
    if (!user) { setShowAuth(true); return }
    navigate('/report')
  }

  const handleSpotSelect = async (lat: number, lon: number, name: string, locationId?: number) => {
    setCurrentLat(lat)
    setCurrentLon(lon)
    setCurrentName(name)
    const resolvedId = locationId ?? findLocationByCoords(lat, lon, locations)?.id ?? null
    setSelectedLocationId(resolvedId)
    await searchByCoords(lat, lon, name, resolvedId ?? undefined, units)
    navigate('/forecast')
  }

  const todayIndex = forecast?.days.findIndex(d => d.date === new Date().toISOString().split('T')[0]) ?? -1

  // Current path for bottom nav highlighting
  const currentPath = location.pathname

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '36px', letterSpacing: '0.2em' }}>DEPTHVIZ</div>
    </div>
  )

  return (
    <ErrorBoundary>
    <div className={styles.container}>

      {/* Skip to main content — keyboard navigation */}
      <a href="#main-content" className="skip-link">Skip to content</a>

      <Suspense fallback={null}>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </Suspense>

      <header className={styles.header}>
        <div
          className={styles.logo}
          aria-label="DepthViz — go to home"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(status === 'success' ? '/forecast' : '/')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(status === 'success' ? '/forecast' : '/') }}
        >DEPTH<span>VIZ</span></div>
        <div className={styles.tagline}>Underwater visibility forecast</div>
        <p className={styles.valueProp}>
          AI-calibrated 7-day forecasts · swell, current &amp; ocean data · community-verified
        </p>
        <div className={styles.unitToggle} role="group" aria-label="Display units">
          <span
            className={`${styles.unitLabel} ${units === 'ft' ? styles.unitLabelActive : ''}`}
            onClick={() => setUnits('ft')}
          >FT</span>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={units === 'm'}
              onChange={(e) => setUnits(e.target.checked ? 'm' : 'ft')}
            />
            <span className={styles.toggleSlider} />
          </label>
          <span
            className={`${styles.unitLabel} ${units === 'm' ? styles.unitLabelActive : ''}`}
            onClick={() => setUnits('m')}
          >M</span>
        </div>
        <button
          type="button"
          className={user ? styles.authBtnAvatar : styles.authBtn}
          onClick={() => { if (user) navigate('/profile'); else setShowAuth(true) }}
          aria-label={user ? `View profile for ${user.email?.split('@')[0] ?? 'user'}` : 'Sign in to your account'}
        >
          {user ? (user.email ?? 'U')[0].toUpperCase() : 'Sign in'}
        </button>
      </header>

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

      {error && <div className={styles.error} role="alert">{error}</div>}

      {status === 'success' && forecast && ['/forecast', '/tides', '/report', '/history'].includes(currentPath) && (
        <div className={styles.nav} role="navigation" aria-label="Forecast sections">
          {(['forecast', 'tides', 'report'] as const).map(v => {
            const label = v === 'forecast' ? 'Forecast' : v === 'tides' ? 'Tides' : 'Log Dive'
            const path = v === 'forecast' ? '/forecast' : v === 'tides' ? '/tides' : '/report'
            return (
              <button
                key={v}
                className={`${styles.navBtn} ${currentPath === path ? styles.navActive : ''}`}
                onClick={() => v === 'report' ? handleReportClick() : navigate(path)}
                aria-label={v === 'report' && !user ? `${label} (sign in required)` : label}
                aria-current={currentPath === path ? 'page' : undefined}
              >
                {label}
                {v === 'report' && !user && <span className={styles.lockIcon} aria-hidden="true"> &#128274;</span>}
              </button>
            )
          })}
          <button
            className={`${styles.navBtn} ${selectedLocationId ? styles.navActive : ''}`}
            onClick={() => handleSaveLocation(false)}
            disabled={!!selectedLocationId}
            aria-label={selectedLocationId ? 'Location already saved' : !user ? 'Save this location (sign in required)' : 'Save this location'}
          >
            {selectedLocationId ? 'Saved ✓' : <>+ Save{!user && <span className={styles.lockIcon} aria-hidden="true"> &#128274;</span>}</>}
          </button>
          {!selectedLocationId && (
            <button
              className={styles.navBtn}
              onClick={() => handleSaveLocation(true)}
              aria-label={!user ? 'Save as private spot (sign in required)' : 'Save as private spot — coordinates encrypted'}
            >
              + Private{!user && <span className={styles.lockIcon} aria-hidden="true"> &#128274;</span>}
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
        </div>
      )}

      <main id="main-content" tabIndex={-1}>
        <Routes>
          {/* Profile */}
          <Route path="/profile" element={
            user ? (
              <Suspense fallback={null}>
                <ProfilePanel onClose={() => navigate(-1)} />
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
                <button className={styles.navBtn} onClick={() => setShowAuth(true)} style={{ marginTop: 16 }}>Sign in</button>
              </div>
            )
          } />

          {/* Legal pages — reads :page param directly so direct URLs work */}
          <Route path="/legal/:page" element={<LegalRouteWrapper onBack={() => navigate(-1)} />} />

          {/* Feed */}
          <Route path="/feed" element={
            <Suspense fallback={null}>
              <FeedPage user={user} />
            </Suspense>
          } />

          {/* Catches */}
          <Route path="/catches" element={
            <Suspense fallback={null}>
              <CatchesPage user={user} locations={locations} onShowAuth={() => setShowAuth(true)} />
            </Suspense>
          } />

          {/* Map (home) */}
          <Route path="/" element={
            <>
              {(status === 'loading' || isRevalidating) && (
                <div className={styles.loadingBar} role="status" aria-live="polite">{isRevalidating ? 'Fetching conditions...' : 'Reading conditions...'}</div>
              )}
              {status === 'idle' && (
                <Suspense fallback={null}>
                  <SpotsMap onSelectSpot={handleSpotSelect} center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined} user={user} onShowAuth={() => setShowAuth(true)} locations={locations} />
                </Suspense>
              )}
              {status === 'success' && (
                <Suspense fallback={null}>
                  <SpotsMap onSelectSpot={handleSpotSelect} center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined} user={user} onShowAuth={() => setShowAuth(true)} locations={locations} />
                </Suspense>
              )}
            </>
          } />

          {/* Best Visibility */}
          <Route path="/best" element={
            <Suspense fallback={null}>
              <BestVisibility onSelectSpot={handleSpotSelect} units={units} />
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
                />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                <div className={styles.emptyText}>Sign in to save places</div>
                <button className={styles.navBtn} onClick={() => setShowAuth(true)} style={{ marginTop: 16 }}>Sign in</button>
              </div>
            )
          } />

          {/* Forecast view */}
          <Route path="/forecast" element={
            <>
              {status === 'loading' && (
                <div className={styles.loading} role="status" aria-live="polite" aria-label="Loading conditions">
                  <div className={styles.sonar} aria-hidden="true" />
                  <div className={styles.loadingText}>Reading conditions...</div>
                </div>
              )}
              {status === 'idle' && (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon} aria-hidden="true">&#129343;</div>
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
                  <ForecastStrip days={forecast.days} selectedIndex={selectedDay} onSelect={setSelectedDay} units={units} />
                  {forecast.days[selectedDay] && (
                    <DayDetail
                      day={forecast.days[selectedDay]}
                      locationName={forecast.location_name}
                      reportCount={forecast.report_count}
                      units={units}
                    />
                  )}
                </>
              )}
            </>
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
                  day={forecast.days[todayIndex] ?? forecast.days[selectedDay]}
                  allDays={forecast.days}
                  locations={locations}
                  onSubmitted={() => navigate('/forecast')}
                  initialLocationId={selectedLocationId}
                  units={units}
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
        </Routes>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className={styles.bottomNav} aria-label="Main navigation">
        <button
          className={`${styles.bottomNavBtn} ${currentPath === '/' ? styles.bottomNavActive : ''}`}
          onClick={() => navigate('/')}
          aria-label="Map"
          aria-current={currentPath === '/' ? 'page' : undefined}
        >
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Map</span>
        </button>
        <button
          className={`${styles.bottomNavBtn} ${currentPath === '/feed' ? styles.bottomNavActive : ''}`}
          onClick={() => navigate('/feed')}
          aria-label="Feed"
          aria-current={currentPath === '/feed' ? 'page' : undefined}
        >
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 11a9 9 0 019 9" />
            <path d="M4 4a16 16 0 0116 16" />
            <circle cx="5" cy="19" r="1" />
          </svg>
          <span>Feed</span>
        </button>
        <button
          className={`${styles.bottomNavBtn} ${currentPath === '/catches' ? styles.bottomNavActive : ''}`}
          onClick={() => navigate('/catches')}
          aria-label="Catches"
          aria-current={currentPath === '/catches' ? 'page' : undefined}
        >
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M20 12c0 4.418-3.582 8-8 8s-8-3.582-8-8c0-2 1-4 2-5l6 3 6-3c1 1 2 3 2 5z" />
            <path d="M12 3v12" />
          </svg>
          <span>Catches</span>
        </button>
        <button
          className={`${styles.bottomNavBtn} ${currentPath === '/friends' ? styles.bottomNavActive : ''}`}
          onClick={() => { if (user) navigate('/friends'); else setShowAuth(true) }}
          aria-label={user ? 'Friends' : 'Friends (sign in required)'}
          aria-current={currentPath === '/friends' ? 'page' : undefined}
        >
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span>Friends</span>
        </button>
        <button
          className={`${styles.bottomNavBtn} ${currentPath === '/profile' ? styles.bottomNavActive : ''}`}
          onClick={() => { if (user) navigate('/profile'); else setShowAuth(true) }}
          aria-label={user ? 'Profile' : 'Profile (sign in required)'}
          aria-current={currentPath === '/profile' ? 'page' : undefined}
        >
          <svg className={styles.bottomNavIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4-4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
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
          {(['privacy', 'terms', 'cookies', 'security', 'contact', 'accessibility'] as LegalPageType[]).map(p => (
            <button
              key={p}
              className={styles.footerLink}
              onClick={() => navigate(`/legal/${p}`)}
            >
              {p === 'privacy' ? 'Privacy' : p === 'terms' ? 'Terms' : p === 'cookies' ? 'Cookies' : p === 'security' ? 'Security' : p === 'contact' ? 'Contact' : 'Accessibility'}
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
