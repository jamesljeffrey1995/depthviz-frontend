import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from './hooks/useAuth'
import { useConditions } from './hooks/useConditions'
import { useGeolocation } from './hooks/useGeolocation'
import { SearchBar } from './components/SearchBar'
import { ForecastStrip } from './components/ForecastStrip'
import { DayDetail } from './components/DayDetail'
import { CookieBanner } from './components/CookieBanner'
import { UK_DIVE_SPOTS } from './data/diveSpots'
import { getLocations, createLocation } from './lib/api'
import { formatLocationName } from './types'
import type { GeocodingResult, Location, AppView } from './types'
import type { LegalPageType } from './components/LegalPage'
import styles from './App.module.css'

const ReportForm = lazy(() => import('./components/ReportForm').then(m => ({ default: m.ReportForm })))
const AuthModal = lazy(() => import('./components/AuthModal').then(m => ({ default: m.AuthModal })))
const ProfilePanel = lazy(() => import('./components/ProfilePanel').then(m => ({ default: m.ProfilePanel })))
const LocationHistory = lazy(() => import('./components/LocationHistory').then(m => ({ default: m.LocationHistory })))
const TidesPage = lazy(() => import('./components/TidesPage').then(m => ({ default: m.TidesPage })))
const SpotsMap = lazy(() => import('./components/SpotsMap').then(m => ({ default: m.SpotsMap })))
const BestVisibility = lazy(() => import('./components/BestVisibility').then(m => ({ default: m.BestVisibility })))
const LegalPage = lazy(() => import('./components/LegalPage').then(m => ({ default: m.LegalPage })))
const SavedPlaces = lazy(() => import('./components/SavedPlaces').then(m => ({ default: m.SavedPlaces })))

type ExtView = AppView | 'profile' | 'history' | 'legal'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { status, forecast, error, searchByCoords } = useConditions()
  const { getLocation } = useGeolocation()
  const [selectedDay, setSelectedDay] = useState(0)
  const [view, setView] = useState<ExtView>('map')
  const [locations, setLocations] = useState<Location[]>([])
  const [currentLat, setCurrentLat] = useState<number | null>(null)
  const [currentLon, setCurrentLon] = useState<number | null>(null)
  const [currentName, setCurrentName] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
  const [legalPage, setLegalPage] = useState<LegalPageType>('privacy')
  const [prevView, setPrevView] = useState<ExtView>('map')

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
    for (const s of UK_DIVE_SPOTS) {
      if (s.name.toLowerCase().includes(q) && !isNearExisting(s.lat, s.lon)) {
        results.push({ name: s.name, latitude: s.lat, longitude: s.lon })
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
      const matched = locations.find(l => Math.abs(l.lat - coords.latitude) < 0.01 && Math.abs(l.lon - coords.longitude) < 0.01)
      setSelectedLocationId(matched?.id ?? null)
      await searchByCoords(coords.latitude, coords.longitude, name, matched?.id)
      setView('forecast')
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
      const matched = locations.find(l => Math.abs(l.lat - loc.latitude) < 0.01 && Math.abs(l.lon - loc.longitude) < 0.01)
      setSelectedLocationId(matched?.id ?? null)
      await searchByCoords(loc.latitude, loc.longitude, name, matched?.id)
      setView('forecast')
    }
  }

  const handleSaveLocation = async () => {
    if (currentLat === null || currentLon === null || !currentName) return
    if (!user) { setShowAuth(true); return }
    try {
      const loc = await createLocation(currentName, currentLat, currentLon)
      setLocations(prev => [...prev.filter(l => l.id !== loc.id), loc])
      setSelectedLocationId(loc.id)
    } catch (e) { console.error(e) }
  }

  const handleReportClick = () => {
    if (!user) { setShowAuth(true); return }
    setView('report')
  }

  const handleSpotSelect = async (lat: number, lon: number, name: string) => {
    setCurrentLat(lat)
    setCurrentLon(lon)
    setCurrentName(name)
    const matched = locations.find(l => Math.abs(l.lat - lat) < 0.01 && Math.abs(l.lon - lon) < 0.01)
    setSelectedLocationId(matched?.id ?? null)
    await searchByCoords(lat, lon, name, matched?.id)
    setView('forecast')
  }

  const todayIndex = forecast?.days.findIndex(d => d.date === new Date().toISOString().split('T')[0]) ?? -1

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '36px', letterSpacing: '0.2em' }}>DEPTHVIZ</div>
    </div>
  )

  return (
    <div className={styles.container}>
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
          onClick={() => setView(status === 'success' ? 'forecast' : 'map')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setView(status === 'success' ? 'forecast' : 'map') }}
        >DEPTH<span>VIZ</span></div>
        <div className={styles.tagline}>Underwater visibility forecast</div>
        <button
          className={styles.authBtn}
          onClick={() => { if (user) { setPrevView(view); setView('profile') } else setShowAuth(true) }}
          aria-label={user ? `View profile for ${user.email?.split('@')[0] ?? 'user'}` : 'Sign in to your account'}
        >
          {user ? (user.email?.split('@')[0] ?? 'Profile') : 'Sign in'}
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
          const matched = locations.find(l => Math.abs(l.lat - r.latitude) < 0.01 && Math.abs(l.lon - r.longitude) < 0.01)
          setSelectedLocationId(matched?.id ?? null)
          await searchByCoords(r.latitude, r.longitude, name, matched?.id)
          setView('forecast')
        }}
      />

      {error && <div className={styles.error} role="alert">{error}</div>}

      {/* Profile page — always accessible, independent of forecast state */}
      {view === 'profile' && user && (
        <Suspense fallback={null}>
          <ProfilePanel onClose={() => setView(prevView !== 'profile' ? prevView : status === 'success' ? 'forecast' : 'map')} />
        </Suspense>
      )}

      {/* Legal pages */}
      {view === 'legal' && (
        <Suspense fallback={null}>
          <LegalPage page={legalPage} onBack={() => setView(prevView !== 'legal' ? prevView : status === 'success' ? 'forecast' : 'map')} />
        </Suspense>
      )}

      {/* All forecast/search content hidden while profile or legal page is open */}
      {view !== 'profile' && view !== 'legal' && (
        <>
          {/* Nav buttons — always visible when no forecast loaded */}
          {status !== 'success' && (
            <div className={styles.nav}>
              <button
                className={`${styles.navBtn} ${view === 'map' ? styles.navActive : ''}`}
                onClick={() => setView('map')}
                aria-current={view === 'map' ? 'page' : undefined}
              >
                Map
              </button>
              <button
                className={`${styles.navBtn} ${view === 'best' ? styles.navActive : ''}`}
                onClick={() => setView('best')}
                aria-current={view === 'best' ? 'page' : undefined}
              >
                Best Vis
              </button>
              {user && (
                <button
                  className={`${styles.navBtn} ${view === 'locations' ? styles.navActive : ''}`}
                  onClick={() => setView('locations')}
                  aria-current={view === 'locations' ? 'page' : undefined}
                >
                  My Places
                </button>
              )}
            </div>
          )}

          {status === 'loading' && (view === 'map' || view === 'best' || view === 'locations') && (
            <div className={styles.loadingBar} role="status" aria-live="polite" aria-label="Loading conditions">
              Reading conditions…
            </div>
          )}

          {status === 'loading' && view !== 'map' && view !== 'best' && view !== 'locations' && (
            <div className={styles.loading} role="status" aria-live="polite" aria-label="Loading conditions">
              <div className={styles.sonar} aria-hidden="true" />
              <div className={styles.loadingText}>Reading conditions...</div>
            </div>
          )}

          {status === 'idle' && view !== 'map' && view !== 'best' && view !== 'locations' && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🤿</div>
              <div className={styles.emptyText}>Enter a location to check<br />underwater visibility conditions</div>
            </div>
          )}

          {/* Map when no forecast loaded */}
          {view === 'map' && status !== 'success' && (
            <Suspense fallback={null}>
              <SpotsMap onSelectSpot={handleSpotSelect} center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined} user={user} onShowAuth={() => setShowAuth(true)} locations={locations} />
            </Suspense>
          )}

          {/* Best Visibility when no forecast loaded */}
          {view === 'best' && status !== 'success' && (
            <Suspense fallback={null}>
              <BestVisibility onSelectSpot={handleSpotSelect} />
            </Suspense>
          )}

          {/* Saved places when no forecast loaded */}
          {view === 'locations' && status !== 'success' && (
            <Suspense fallback={null}>
              <SavedPlaces
                locations={locations}
                onSelectLocation={handleSpotSelect}
                onDelete={id => setLocations(prev => prev.filter(l => l.id !== id))}
              />
            </Suspense>
          )}

          {status === 'success' && forecast && (
            <>
              <div className={styles.nav}>
                {(['forecast', 'tides', 'report', 'map', 'best'] as ExtView[]).map(v => {
                  const label = v === 'forecast' ? 'Forecast' : v === 'tides' ? 'Tides' : v === 'map' ? 'Map' : v === 'best' ? 'Best Vis' : 'Log Dive'
                  return (
                    <button
                      key={v}
                      className={`${styles.navBtn} ${view === v ? styles.navActive : ''}`}
                      onClick={() => v === 'report' ? handleReportClick() : setView(v)}
                      aria-current={view === v ? 'page' : undefined}
                      aria-label={v === 'report' && !user ? `${label} (sign in required)` : label}
                    >
                      {label}
                      {v === 'report' && !user && <span className={styles.lockIcon} aria-hidden="true"> 🔒</span>}
                    </button>
                  )
                })}
                <button
                  className={`${styles.navBtn} ${selectedLocationId ? styles.navActive : ''}`}
                  onClick={handleSaveLocation}
                  disabled={!!selectedLocationId}
                  aria-label={selectedLocationId ? 'Location already saved' : !user ? 'Save this location (sign in required)' : 'Save this location'}
                  aria-pressed={!!selectedLocationId}
                >
                  {selectedLocationId ? 'Saved ✓' : <>+ Save{!user && <span className={styles.lockIcon} aria-hidden="true"> 🔒</span>}</>}
                </button>
                {selectedLocationId && (
                  <button
                    className={`${styles.navBtn} ${view === 'history' ? styles.navActive : ''}`}
                    onClick={() => setView('history')}
                    aria-current={view === 'history' ? 'page' : undefined}
                  >
                    Dive Logs
                  </button>
                )}
                {user && (
                  <button
                    className={`${styles.navBtn} ${view === 'locations' ? styles.navActive : ''}`}
                    onClick={() => setView('locations')}
                    aria-current={view === 'locations' ? 'page' : undefined}
                  >
                    My Places
                  </button>
                )}
              </div>

              {view === 'forecast' && (
                <>
                  {forecast.bias_offset !== null && (
                    <div className={styles.biasNote}>
                      AI correction active · {forecast.report_count} community reports · offset {forecast.bias_offset > 0 ? '+' : ''}{forecast.bias_offset?.toFixed(1)}m
                    </div>
                  )}
                  <ForecastStrip days={forecast.days} selectedIndex={selectedDay} onSelect={setSelectedDay} />
                  {forecast.days[selectedDay] && (
                    <DayDetail
                      day={forecast.days[selectedDay]}
                      locationName={forecast.location_name}
                      reportCount={forecast.report_count}
                    />
                  )}
                </>
              )}

              {view === 'tides' && currentLat !== null && currentLon !== null && (
                <Suspense fallback={null}>
                  <TidesPage lat={currentLat} lon={currentLon} locationName={currentName} />
                </Suspense>
              )}

              {view === 'report' && user && (
                <Suspense fallback={null}>
                  <ReportForm
                    day={forecast.days[todayIndex] ?? forecast.days[selectedDay]}
                    allDays={forecast.days}
                    locations={locations}
                    onSubmitted={() => setView('forecast')}
                    initialLocationId={selectedLocationId}
                  />
                </Suspense>
              )}

              {view === 'history' && selectedLocationId && (
                <Suspense fallback={null}>
                  <LocationHistory locationId={selectedLocationId} locationName={currentName} />
                </Suspense>
              )}

              {/* Map when forecast is loaded — renders after nav bar */}
              {view === 'map' && (
                <Suspense fallback={null}>
                  <SpotsMap onSelectSpot={handleSpotSelect} center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined} user={user} onShowAuth={() => setShowAuth(true)} locations={locations} />
                </Suspense>
              )}

              {/* Best Visibility when forecast is loaded */}
              {view === 'best' && (
                <Suspense fallback={null}>
                  <BestVisibility onSelectSpot={handleSpotSelect} />
                </Suspense>
              )}

              {/* Saved places when forecast is loaded */}
              {view === 'locations' && (
                <Suspense fallback={null}>
                  <SavedPlaces
                    locations={locations}
                    onSelectLocation={handleSpotSelect}
                    onDelete={id => setLocations(prev => prev.filter(l => l.id !== id))}
                  />
                </Suspense>
              )}
            </>
          )}
        </>
      )}

      <footer className={styles.footer}>
        <div>Data: Open-Meteo Weather · Copernicus Marine · North Sea baseline</div>
        <div>Not a substitute for local knowledge · Always dive with a buddy</div>
        <div className={styles.footerLinks}>
          {(['privacy', 'terms', 'cookies', 'security', 'contact', 'accessibility'] as LegalPageType[]).map(p => (
            <button key={p} className={styles.footerLink} onClick={() => { setPrevView(view); setLegalPage(p); setView('legal') }}>
              {p === 'privacy' ? 'Privacy' : p === 'terms' ? 'Terms' : p === 'cookies' ? 'Cookies' : p === 'security' ? 'Security' : p === 'contact' ? 'Contact' : 'Accessibility'}
            </button>
          ))}
        </div>
        <a
          href="https://buymeacoffee.com/depthviz"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.bmcLink}
        >
          Buy me a coffee
        </a>
      </footer>

      <CookieBanner onNavigate={(p) => { setPrevView(view); setLegalPage(p as LegalPageType); setView('legal') }} />
    </div>
  )
}