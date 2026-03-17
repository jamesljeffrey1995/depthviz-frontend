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

  useEffect(() => {
    getLocations().then(setLocations).catch(() => {})
  }, [user])

  useEffect(() => {
    if (forecast) {
      const today = new Date().toISOString().split('T')[0]
      const todayIdx = forecast.days.findIndex(d => d.date === today)
      setSelectedDay(todayIdx >= 0 ? todayIdx : 14)
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
        <div className={styles.logo}>DEPTH<span>VIZ</span></div>
        <div className={styles.tagline}>Underwater visibility forecast</div>
        <button
          className={styles.authBtn}
          onClick={() => user ? setView('profile') : setShowAuth(true)}
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

      {error && <div className={styles.error}>{error}</div>}

      {/* Profile page — always accessible, independent of forecast state */}
      {view === 'profile' && user && (
        <Suspense fallback={null}>
          <ProfilePanel onClose={() => setView('forecast')} />
        </Suspense>
      )}

      {/* Legal pages */}
      {view === 'legal' && (
        <Suspense fallback={null}>
          <LegalPage page={legalPage} onBack={() => setView('forecast')} />
        </Suspense>
      )}

      {/* All forecast/search content hidden while profile or legal page is open */}
      {view !== 'profile' && view !== 'legal' && (
        <>
          {/* Nav buttons — always visible when no forecast loaded */}
          {view !== 'map' && view !== 'best' && status !== 'loading' && status !== 'success' && (
            <div className={styles.nav}>
              <button
                className={styles.navBtn}
                onClick={() => setView('map')}
              >
                Map
              </button>
              <button
                className={styles.navBtn}
                onClick={() => setView('best')}
              >
                Best Vis
              </button>
            </div>
          )}

          {(view === 'map' || view === 'best') && status !== 'success' && (
            <div className={styles.nav}>
              <button
                className={`${styles.navBtn} ${view === 'map' ? styles.navActive : ''}`}
                onClick={() => setView('map')}
              >
                Map
              </button>
              <button
                className={`${styles.navBtn} ${view === 'best' ? styles.navActive : ''}`}
                onClick={() => setView('best')}
              >
                Best Vis
              </button>
            </div>
          )}

          {status === 'loading' && view !== 'map' && view !== 'best' && (
            <div className={styles.loading}>
              <div className={styles.sonar} />
              <div className={styles.loadingText}>Reading conditions...</div>
            </div>
          )}

          {status === 'idle' && view !== 'map' && view !== 'best' && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🤿</div>
              <div className={styles.emptyText}>Enter a location to check<br />underwater visibility conditions</div>
            </div>
          )}

          {/* Map when no forecast loaded */}
          {view === 'map' && status !== 'success' && (
            <Suspense fallback={null}>
              <SpotsMap onSelectSpot={handleSpotSelect} center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined} />
            </Suspense>
          )}

          {/* Best Visibility when no forecast loaded */}
          {view === 'best' && status !== 'success' && (
            <Suspense fallback={null}>
              <BestVisibility onSelectSpot={handleSpotSelect} />
            </Suspense>
          )}

          {status === 'success' && forecast && (
            <>
              <div className={styles.nav}>
                {(['forecast', 'tides', 'report', 'map', 'best'] as ExtView[]).map(v => (
                  <button
                    key={v}
                    className={`${styles.navBtn} ${view === v ? styles.navActive : ''}`}
                    onClick={() => v === 'report' ? handleReportClick() : setView(v)}
                  >
                    {v === 'forecast' ? 'Forecast' : v === 'tides' ? 'Tides' : v === 'map' ? 'Map' : v === 'best' ? 'Best Vis' : 'Log Dive'}
                    {v === 'report' && !user && <span className={styles.lockIcon}> 🔒</span>}
                  </button>
                ))}
                <button
                  className={`${styles.navBtn} ${selectedLocationId ? styles.navActive : ''}`}
                  onClick={handleSaveLocation}
                  disabled={!!selectedLocationId}
                >
                  {selectedLocationId ? 'Saved ✓' : <>+ Save{!user && <span className={styles.lockIcon}> 🔒</span>}</>}
                </button>
                {selectedLocationId && (
                  <button
                    className={`${styles.navBtn} ${view === 'history' ? styles.navActive : ''}`}
                    onClick={() => setView('history')}
                  >
                    Dive Logs
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
                  <DayDetail
                    day={forecast.days[selectedDay]}
                    locationName={forecast.location_name}
                    reportCount={forecast.report_count}
                  />
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
                  <SpotsMap onSelectSpot={handleSpotSelect} center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined} />
                </Suspense>
              )}

              {/* Best Visibility when forecast is loaded */}
              {view === 'best' && (
                <Suspense fallback={null}>
                  <BestVisibility onSelectSpot={handleSpotSelect} />
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
            <button key={p} className={styles.footerLink} onClick={() => { setLegalPage(p); setView('legal') }}>
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

      <CookieBanner onNavigate={(p) => { setLegalPage(p as LegalPageType); setView('legal') }} />
    </div>
  )
}