import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { useConditions } from './hooks/useConditions'
import { useGeolocation } from './hooks/useGeolocation'
import { SearchBar } from './components/SearchBar'
import { ForecastStrip } from './components/ForecastStrip'
import { DayDetail } from './components/DayDetail'
import { ReportForm } from './components/ReportForm'
import { AuthModal } from './components/AuthModal'
import { ProfilePanel } from './components/ProfilePanel'
import { LocationHistory } from './components/LocationHistory'
import { TidesPage } from './components/TidesPage'
import { SpotsMap, UK_DIVE_SPOTS } from './components/SpotsMap'
import { BestVisibility } from './components/BestVisibility'
import { CookieBanner } from './components/CookieBanner'
import { LegalPage } from './components/LegalPage'
import type { LegalPageType } from './components/LegalPage'
import { getLocations, createLocation } from './lib/api'
import { formatLocationName } from './types'
import type { GeocodingResult, Location, AppView } from './types'
import styles from './App.module.css'

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

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL as string | undefined
  const isAdmin = !!user?.email && !!adminEmail && user.email === adminEmail

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
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

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
        <ProfilePanel onClose={() => setView('forecast')} />
      )}

      {/* Legal pages */}
      {view === 'legal' && (
        <LegalPage page={legalPage} onBack={() => setView('forecast')} />
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
            <SpotsMap onSelectSpot={handleSpotSelect} center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined} user={user} onShowAuth={() => setShowAuth(true)} />
          )}

          {/* Best Visibility when no forecast loaded */}
          {view === 'best' && status !== 'success' && (
            <BestVisibility onSelectSpot={handleSpotSelect} locations={locations} />
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
                    isAdmin={isAdmin}
                    biasOffset={forecast.bias_offset}
                  />
                </>
              )}

              {view === 'tides' && currentLat !== null && currentLon !== null && (
                <TidesPage lat={currentLat} lon={currentLon} locationName={currentName} />
              )}

              {view === 'report' && user && (
                <ReportForm
                  day={forecast.days[todayIndex] ?? forecast.days[selectedDay]}
                  allDays={forecast.days}
                  locations={locations}
                  onSubmitted={() => setView('forecast')}
                />
              )}

              {view === 'history' && selectedLocationId && (
                <LocationHistory locationId={selectedLocationId} locationName={currentName} />
              )}

              {/* Map when forecast is loaded — renders after nav bar */}
              {view === 'map' && (
                <SpotsMap onSelectSpot={handleSpotSelect} center={currentLat !== null && currentLon !== null ? [currentLat, currentLon] : undefined} user={user} onShowAuth={() => setShowAuth(true)} />
              )}

              {/* Best Visibility when forecast is loaded */}
              {view === 'best' && (
                <BestVisibility onSelectSpot={handleSpotSelect} locations={locations} />
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
