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
import { CookieBanner } from './components/CookieBanner'
import { LegalPage } from './components/LegalPage'
import type { LegalPageType } from './components/LegalPage'
import { getLocations, createLocation, geocode } from './lib/api'
import { formatLocationName } from './types'
import type { Location, AppView } from './types'
import styles from './App.module.css'

type ExtView = AppView | 'profile' | 'history' | 'legal'

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const { status, forecast, error, search, searchByCoords } = useConditions()
  const { getLocation } = useGeolocation()
  const [selectedDay, setSelectedDay] = useState(0)
  const [view, setView] = useState<ExtView>('forecast')
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
    const results = await geocode(query)
    if (results.length) {
      const loc = results[0]
      setCurrentLat(loc.latitude)
      setCurrentLon(loc.longitude)
      const name = formatLocationName(loc)
      setCurrentName(name)
      const matched = locations.find(l => Math.abs(l.lat - loc.latitude) < 0.01 && Math.abs(l.lon - loc.longitude) < 0.01)
      setSelectedLocationId(matched?.id ?? null)
      await searchByCoords(loc.latitude, loc.longitude, name, matched?.id)
    } else {
      await search(query)
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
        getSuggestions={async (q) => geocode(q)}
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
          {status === 'loading' && (
            <div className={styles.loading}>
              <div className={styles.sonar} />
              <div className={styles.loadingText}>Reading conditions...</div>
            </div>
          )}

          {status === 'idle' && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🤿</div>
              <div className={styles.emptyText}>Enter a location to check<br />underwater visibility conditions</div>
            </div>
          )}

          {status === 'success' && forecast && (
            <>
              <div className={styles.nav}>
                {(['forecast', 'report'] as ExtView[]).map(v => (
                  <button
                    key={v}
                    className={`${styles.navBtn} ${view === v ? styles.navActive : ''}`}
                    onClick={() => v === 'report' ? handleReportClick() : setView(v)}
                  >
                    {v === 'forecast' ? 'Forecast' : 'Log Dive'}
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