import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  dismissSecurityAlert,
  downloadTrafficExport,
  getRateLimitConfig,
  getSecurityAlerts,
  getTrafficEndpoints,
  getTrafficLive,
  getTrafficLocations,
  getTrafficOverview,
  getTrafficTopIps,
  getTrafficTopUsers,
  runSecuritySweep,
  updateRateLimitConfig,
} from '../../lib/api'
import type {
  RateLimitConfig,
  SecurityAlertRow,
  TrafficEndpointRow,
  TrafficLiveEvent,
  TrafficLocationRow,
  TrafficOverview,
  TrafficTopIp,
  TrafficTopUser,
} from '../../types'
import {
  BarList,
  COLORS,
  fmtCompact,
  fmtRelative,
  fmtTime,
  LineChart,
  StatTile,
  SuspicionChip,
} from './trafficPrimitives'
import styles from './TrafficAnalytics.module.css'

type Tab = 'overview' | 'users' | 'ips' | 'endpoints' | 'locations' | 'live' | 'alerts' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Top Users' },
  { id: 'ips', label: 'Top IPs' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'locations', label: 'Locations' },
  { id: 'live', label: 'Live' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'settings', label: 'Rate Limiting' },
]

const RANGES: { hours: number; label: string }[] = [
  { hours: 1, label: '1h' },
  { hours: 6, label: '6h' },
  { hours: 24, label: '24h' },
  { hours: 168, label: '7d' },
]

function describe(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? `${fallback}: ${e.message}` : fallback
}

/**
 * Security · Traffic Analytics — an admin-only observability console for
 * DepthViz: near-real-time traffic, scraping/abuse detection with suspicion
 * scores, an alert centre, and the (disabled-by-default) rate-limit surface.
 */
export function TrafficAnalytics() {
  const [tab, setTab] = useState<Tab>('overview')
  const [hours, setHours] = useState(24)
  const [alertCount, setAlertCount] = useState(0)

  // Keep the active-alert badge fresh regardless of which tab is open.
  useEffect(() => {
    let cancelled = false
    getSecurityAlerts(false)
      .then(r => { if (!cancelled) setAlertCount(r.active) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tab])

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>Security · Traffic Analytics</h2>
        <span className={styles.spacer} />
        {tab !== 'live' && tab !== 'settings' && (
          <div className={styles.rangeGroup} role="group" aria-label="Time range">
            {RANGES.map(r => (
              <button
                key={r.hours}
                className={`${styles.rangeBtn} ${hours === r.hours ? styles.rangeActive : ''}`}
                onClick={() => setHours(r.hours)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.subnav} role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.navBtn} ${tab === t.id ? styles.navActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'alerts' && alertCount > 0 && <span className={styles.badge}>{alertCount}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab hours={hours} />}
      {tab === 'users' && <UsersTab hours={hours} />}
      {tab === 'ips' && <IpsTab hours={hours} />}
      {tab === 'endpoints' && <EndpointsTab hours={hours} />}
      {tab === 'locations' && <LocationsTab hours={hours} />}
      {tab === 'live' && <LiveTab />}
      {tab === 'alerts' && <AlertsTab onCountChange={setAlertCount} />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ hours }: { hours: number }) {
  const [data, setData] = useState<TrafficOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getTrafficOverview(hours)
      .then(d => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError(describe(e, 'Failed to load overview')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hours])

  if (loading && !data) return <div className={styles.loading}>Loading traffic…</div>
  if (error) return <div className={styles.error}>{error}</div>
  if (!data) return null

  const s = data.summary
  const cachePct = s.cache_hit_pct == null ? '—' : `${s.cache_hit_pct}%`
  return (
    <>
      <div className={styles.tiles}>
        <StatTile label="Requests · 24h" value={fmtCompact(s.requests_today)} sub={`${fmtCompact(s.requests_hour)} this hour`} />
        <StatTile label="Active users" value={s.active_users} sub="last hour" />
        <StatTile label="Active IPs" value={s.active_ips} sub="last hour" />
        <StatTile label="Forecasts" value={fmtCompact(s.forecasts_generated)} sub="generated · 24h" />
        <StatTile label="Cache hit" value={cachePct} tone={s.cache_hit_pct != null && s.cache_hit_pct < 40 ? 'warn' : 'good'} />
        <StatTile label="Avg response" value={s.avg_response_ms == null ? '—' : `${s.avg_response_ms}ms`} />
        <StatTile label="Failed · 24h" value={fmtCompact(s.failed_requests)} tone={s.failed_requests > 0 ? 'warn' : undefined} />
        <StatTile label="401 / 403 / 429" value={`${s.count_401}/${s.count_403}/${s.count_429}`} tone={s.count_429 > 0 ? 'bad' : undefined} />
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartHead}><span className={styles.chartTitle}>Requests & forecasts over time</span></div>
          <LineChart
            data={data.series}
            series={[
              { key: 'requests', label: 'Requests', color: COLORS.accent, fill: true },
              { key: 'forecasts', label: 'Forecasts', color: COLORS.ok },
            ]}
          />
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHead}><span className={styles.chartTitle}>Error rate (%)</span></div>
          <LineChart
            data={data.series}
            series={[{ key: 'error_rate', label: 'Error rate', color: COLORS.danger, fill: true }]}
            valueSuffix="%"
          />
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHead}><span className={styles.chartTitle}>Avg response time (ms)</span></div>
          <LineChart
            data={data.series}
            series={[{ key: 'avg_response_ms', label: 'ms', color: COLORS.warning, fill: true }]}
          />
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHead}><span className={styles.chartTitle}>Geographic distribution</span></div>
          {data.geo.length === 0
            ? <div className={styles.empty}>No country data (needs a CDN geo header)</div>
            : <BarList rows={data.geo.slice(0, 8).map(g => ({ label: g.country, value: g.requests }))} />}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitle}>
          <span>Ingest pipeline</span>
          <span className={styles.panelSub}>asynchronous batched logging</span>
        </div>
        <div className={styles.tiles}>
          <StatTile label="Logging" value={data.ingest.enabled ? 'ON' : 'OFF'} tone={data.ingest.enabled ? 'good' : 'warn'} />
          <StatTile label="Queue depth" value={data.ingest.queue_depth} sub="pending writes" />
          <StatTile label="Dropped" value={data.ingest.dropped} tone={data.ingest.dropped > 0 ? 'warn' : undefined} sub="queue-full drops" />
        </div>
      </div>
    </>
  )
}

// ── Sortable table helper ────────────────────────────────────────────────────

function useSort<T>(rows: T[], initialKey: keyof T) {
  const [key, setKey] = useState<keyof T>(initialKey)
  const [desc, setDesc] = useState(true)
  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return desc ? bv - av : av - bv
      return desc
        ? String(bv).localeCompare(String(av))
        : String(av).localeCompare(String(bv))
    })
    return copy
  }, [rows, key, desc])
  const toggle = (k: keyof T) => {
    if (k === key) setDesc(d => !d)
    else { setKey(k); setDesc(true) }
  }
  return { sorted, key, desc, toggle }
}

function Th<T>({ label, k, sort, noSort }: { label: string; k?: keyof T; sort?: ReturnType<typeof useSort<T>>; noSort?: boolean }) {
  if (noSort || !k || !sort) return <th className={styles.noSort}>{label}</th>
  return (
    <th onClick={() => sort.toggle(k)}>
      {label}{sort.key === k && <span className={styles.sortArrow}>{sort.desc ? '↓' : '↑'}</span>}
    </th>
  )
}

// ── Top Users ────────────────────────────────────────────────────────────────

function UsersTab({ hours }: { hours: number }) {
  const [rows, setRows] = useState<TrafficTopUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getTrafficTopUsers(hours)
      .then(r => { if (!cancelled) { setRows(r.users); setError(null) } })
      .catch(e => { if (!cancelled) setError(describe(e, 'Failed to load users')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hours])

  const filtered = useMemo(
    () => rows.filter(r => !q || r.user_id.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  )
  const sort = useSort(filtered, 'requests')

  return (
    <div className={styles.panel}>
      <div className={styles.filters}>
        <input className={styles.input} placeholder="Search user id…" value={q} onChange={e => setQ(e.target.value)} />
        <span className={styles.spacer} />
        <button className={styles.refreshBtn} onClick={() => downloadTrafficExport('suspicious-users', 'csv', hours)}>Export CSV</button>
        <button className={styles.refreshBtn} onClick={() => downloadTrafficExport('suspicious-users', 'json', hours)}>Export JSON</button>
      </div>
      {loading && rows.length === 0 ? <div className={styles.loading}>Loading…</div>
        : error ? <div className={styles.error}>{error}</div>
        : filtered.length === 0 ? <div className={styles.empty}>No user traffic in range.</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <Th<TrafficTopUser> label="User" k="user_id" sort={sort} />
                  <Th<TrafficTopUser> label="Requests" k="requests" sort={sort} />
                  <Th<TrafficTopUser> label="Forecasts" k="forecast_requests" sort={sort} />
                  <Th<TrafficTopUser> label="Locations" k="unique_locations" sort={sort} />
                  <Th<TrafficTopUser> label="IPs" k="unique_ips" sort={sort} />
                  <Th<TrafficTopUser> label="Avg interval" k="avg_interval_s" sort={sort} />
                  <Th<TrafficTopUser> label="Failed" k="failed_requests" sort={sort} />
                  <Th<TrafficTopUser> label="Last active" k="last_active" sort={sort} />
                  <Th<TrafficTopUser> label="Suspicion" k="suspicion_score" sort={sort} />
                </tr>
              </thead>
              <tbody>
                {sort.sorted.map(u => (
                  <tr key={u.user_id}>
                    <td className={styles.mono} title={u.signals.join(', ')}>{u.user_id.slice(0, 12)}…</td>
                    <td>{u.requests}</td>
                    <td>{u.forecast_requests}</td>
                    <td>{u.unique_locations}</td>
                    <td>{u.unique_ips}</td>
                    <td className={styles.dim}>{u.avg_interval_s == null ? '—' : `${u.avg_interval_s}s`}</td>
                    <td className={u.failed_requests > 0 ? styles.statusWarn : ''}>{u.failed_requests}</td>
                    <td className={styles.dim}>{fmtRelative(u.last_active)}</td>
                    <td><SuspicionChip score={u.suspicion_score} band={u.suspicion_band} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

// ── Top IPs ──────────────────────────────────────────────────────────────────

function IpsTab({ hours }: { hours: number }) {
  const [rows, setRows] = useState<TrafficTopIp[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getTrafficTopIps(hours)
      .then(r => { if (!cancelled) { setRows(r.ips); setError(null) } })
      .catch(e => { if (!cancelled) setError(describe(e, 'Failed to load IPs')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hours])

  const filtered = useMemo(
    () => rows.filter(r => !q
      || (r.ip || '').includes(q)
      || (r.country || '').toLowerCase().includes(q.toLowerCase())
      || (r.bot_kind || '').toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  )
  const sort = useSort(filtered, 'requests')

  return (
    <div className={styles.panel}>
      <div className={styles.filters}>
        <input className={styles.input} placeholder="Search IP / country / bot…" value={q} onChange={e => setQ(e.target.value)} />
        <span className={styles.spacer} />
        <button className={styles.refreshBtn} onClick={() => downloadTrafficExport('top-ips', 'csv', hours)}>Export CSV</button>
        <button className={styles.refreshBtn} onClick={() => downloadTrafficExport('top-ips', 'json', hours)}>Export JSON</button>
      </div>
      {loading && rows.length === 0 ? <div className={styles.loading}>Loading…</div>
        : error ? <div className={styles.error}>{error}</div>
        : filtered.length === 0 ? <div className={styles.empty}>No IP traffic in range.</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <Th<TrafficTopIp> label="IP" k="ip" sort={sort} />
                  <Th<TrafficTopIp> label="Requests" k="requests" sort={sort} />
                  <Th<TrafficTopIp> label="Users" k="unique_users" sort={sort} />
                  <Th<TrafficTopIp> label="Locations" k="unique_locations" sort={sort} />
                  <Th<TrafficTopIp> label="Endpoints" k="unique_endpoints" sort={sort} />
                  <Th<TrafficTopIp> label="Country" k="country" sort={sort} />
                  <Th<TrafficTopIp> label="Agent" noSort />
                  <Th<TrafficTopIp> label="Suspicion" k="suspicion_score" sort={sort} />
                </tr>
              </thead>
              <tbody>
                {sort.sorted.map(ip => (
                  <tr key={ip.ip_hash}>
                    <td className={styles.mono}>{ip.ip || `${ip.ip_hash.slice(0, 10)}…`}</td>
                    <td>{ip.requests}</td>
                    <td className={ip.unique_users >= 5 ? styles.statusWarn : ''}>{ip.unique_users}</td>
                    <td>{ip.unique_locations}</td>
                    <td>{ip.unique_endpoints}</td>
                    <td className={styles.dim}>{ip.country || '—'}</td>
                    <td className={styles.dim} title={ip.user_agent || ''}>
                      {ip.bot_kind ? <span className={styles.statusBad}>{ip.bot_kind}</span> : (ip.user_agent || '—').slice(0, 22)}
                    </td>
                    <td><SuspicionChip score={ip.suspicion_score} band={ip.suspicion_band} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

// ── Endpoints ────────────────────────────────────────────────────────────────

function EndpointsTab({ hours }: { hours: number }) {
  const [rows, setRows] = useState<TrafficEndpointRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getTrafficEndpoints(hours)
      .then(r => { if (!cancelled) { setRows(r.endpoints); setError(null) } })
      .catch(e => { if (!cancelled) setError(describe(e, 'Failed to load endpoints')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hours])

  const sort = useSort(rows, 'requests')

  return (
    <div className={styles.panel}>
      <div className={styles.filters}>
        <span className={styles.spacer} />
        <button className={styles.refreshBtn} onClick={() => downloadTrafficExport('endpoints', 'csv', hours)}>Export CSV</button>
      </div>
      {loading && rows.length === 0 ? <div className={styles.loading}>Loading…</div>
        : error ? <div className={styles.error}>{error}</div>
        : rows.length === 0 ? <div className={styles.empty}>No endpoint traffic in range.</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <Th<TrafficEndpointRow> label="Endpoint" k="endpoint" sort={sort} />
                  <Th<TrafficEndpointRow> label="Requests" k="requests" sort={sort} />
                  <Th<TrafficEndpointRow> label="Avg latency" k="avg_latency_ms" sort={sort} />
                  <Th<TrafficEndpointRow> label="Error rate" k="error_rate" sort={sort} />
                  <Th<TrafficEndpointRow> label="Cache hit" k="cache_hit_rate" sort={sort} />
                  <Th<TrafficEndpointRow> label="Users" k="unique_users" sort={sort} />
                  <Th<TrafficEndpointRow> label="IPs" k="unique_ips" sort={sort} />
                </tr>
              </thead>
              <tbody>
                {sort.sorted.map(e => (
                  <tr key={e.endpoint}>
                    <td className={styles.mono}>{e.endpoint}</td>
                    <td>{e.requests}</td>
                    <td className={styles.dim}>{e.avg_latency_ms == null ? '—' : `${e.avg_latency_ms}ms`}</td>
                    <td className={e.error_rate > 5 ? styles.statusBad : e.error_rate > 0 ? styles.statusWarn : ''}>{e.error_rate}%</td>
                    <td className={styles.dim}>{e.cache_hit_rate == null ? '—' : `${e.cache_hit_rate}%`}</td>
                    <td>{e.unique_users}</td>
                    <td>{e.unique_ips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

// ── Locations (heatmap-style ranking) ────────────────────────────────────────

function LocationsTab({ hours }: { hours: number }) {
  const [rows, setRows] = useState<TrafficLocationRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getTrafficLocations(hours)
      .then(r => { if (!cancelled) { setRows(r.locations); setError(null) } })
      .catch(e => { if (!cancelled) setError(describe(e, 'Failed to load locations')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hours])

  const sort = useSort(rows, 'views')
  const maxViews = useMemo(() => Math.max(1, ...rows.map(r => r.views)), [rows])

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <span>Dive site heatmap</span>
        <span className={styles.panelSub}>{rows.length} sites · shade = view intensity</span>
      </div>
      {loading && rows.length === 0 ? <div className={styles.loading}>Loading…</div>
        : error ? <div className={styles.error}>{error}</div>
        : rows.length === 0 ? <div className={styles.empty}>No location traffic in range.</div>
        : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <Th<TrafficLocationRow> label="Location" k="location" sort={sort} />
                  <Th<TrafficLocationRow> label="Views" k="views" sort={sort} />
                  <Th<TrafficLocationRow> label="Forecasts" k="forecast_requests" sort={sort} />
                  <Th<TrafficLocationRow> label="Conditions" k="conditions_requests" sort={sort} />
                  <Th<TrafficLocationRow> label="Users" k="unique_users" sort={sort} />
                  <Th<TrafficLocationRow> label="IPs" k="unique_ips" sort={sort} />
                </tr>
              </thead>
              <tbody>
                {sort.sorted.map(l => {
                  const intensity = l.views / maxViews
                  return (
                    <tr key={l.location} style={{ background: `rgba(0,201,255,${(intensity * 0.16).toFixed(3)})` }}>
                      <td className={styles.mono}>{l.location}</td>
                      <td>{l.views}</td>
                      <td>{l.forecast_requests}</td>
                      <td>{l.conditions_requests}</td>
                      <td>{l.unique_users}</td>
                      <td>{l.unique_ips}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

// ── Live feed ────────────────────────────────────────────────────────────────

function LiveTab() {
  const [events, setEvents] = useState<TrafficLiveEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [auto, setAuto] = useState(true)
  const [botsOnly, setBotsOnly] = useState(false)
  const [q, setQ] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await getTrafficLive(botsOnly ? { bots_only: 'true' } : {}, 120)
      setEvents(r.events)
      setError(null)
    } catch (e) {
      setError(describe(e, 'Failed to load live feed'))
    }
  }, [botsOnly])

  useEffect(() => {
    load()
    if (auto) {
      timer.current = setInterval(load, 3000)
      return () => { if (timer.current) clearInterval(timer.current) }
    }
  }, [auto, load])

  const filtered = useMemo(
    () => events.filter(e => !q
      || e.endpoint.toLowerCase().includes(q.toLowerCase())
      || (e.ip || '').includes(q)
      || (e.location || '').toLowerCase().includes(q.toLowerCase())
      || (e.user_id || '').includes(q)),
    [events, q],
  )

  return (
    <div className={styles.panel}>
      <div className={styles.filters}>
        <input className={styles.input} placeholder="Filter feed…" value={q} onChange={e => setQ(e.target.value)} />
        <label className={styles.autoTag}>
          <input type="checkbox" checked={botsOnly} onChange={e => setBotsOnly(e.target.checked)} /> Bots only
        </label>
        <span className={styles.spacer} />
        {auto && <span className={styles.autoTag}><span className={styles.pulse} /> LIVE · 3s</span>}
        <button className={styles.refreshBtn} onClick={() => setAuto(a => !a)}>{auto ? 'Pause' : 'Resume'}</button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.noSort}>Time</th>
              <th className={styles.noSort}>User</th>
              <th className={styles.noSort}>IP</th>
              <th className={styles.noSort}>Method</th>
              <th className={styles.noSort}>Endpoint</th>
              <th className={styles.noSort}>Location</th>
              <th className={styles.noSort}>Status</th>
              <th className={styles.noSort}>Duration</th>
              <th className={styles.noSort}>Cache</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={9} className={styles.empty}>No requests yet.</td></tr>
              : filtered.map(e => (
                <tr key={e.id}>
                  <td className={styles.dim}>{fmtTime(e.time)}</td>
                  <td className={styles.mono}>{e.user_id ? `${e.user_id.slice(0, 8)}…` : <span className={styles.dim}>anon</span>}</td>
                  <td className={styles.mono}>
                    {e.ip || '—'}{e.bot_kind && <span className={styles.badge}>{e.bot_kind}</span>}
                  </td>
                  <td>{e.method}</td>
                  <td className={styles.mono} title={e.path}>{e.endpoint}</td>
                  <td className={styles.dim}>{e.location || '—'}</td>
                  <td className={e.status >= 500 ? styles.statusBad : e.status >= 400 ? styles.statusWarn : styles.statusOk}>{e.status}</td>
                  <td className={styles.dim}>{e.duration_ms}ms</td>
                  <td className={styles.dim}>{e.cache_hit == null ? '—' : e.cache_hit ? 'HIT' : 'MISS'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Alerts ───────────────────────────────────────────────────────────────────

function AlertsTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [alerts, setAlerts] = useState<SecurityAlertRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [includeDismissed, setIncludeDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getSecurityAlerts(includeDismissed)
      setAlerts(r.alerts)
      onCountChange(r.active)
      setError(null)
    } catch (e) {
      setError(describe(e, 'Failed to load alerts'))
    } finally {
      setLoading(false)
    }
  }, [includeDismissed, onCountChange])

  useEffect(() => { load() }, [load])

  const dismiss = async (id: number) => {
    try {
      await dismissSecurityAlert(id)
      setAlerts(prev => prev.filter(a => a.id !== id || includeDismissed))
      await load()
    } catch (e) {
      setError(describe(e, 'Failed to dismiss'))
    }
  }

  const sweep = async () => {
    setBusy(true)
    try { await runSecuritySweep(); await load() }
    catch (e) { setError(describe(e, 'Sweep failed')) }
    finally { setBusy(false) }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.filters}>
        <label className={styles.autoTag}>
          <input type="checkbox" checked={includeDismissed} onChange={e => setIncludeDismissed(e.target.checked)} /> Show dismissed
        </label>
        <span className={styles.spacer} />
        <button className={styles.refreshBtn} disabled={busy} onClick={sweep}>{busy ? 'Scanning…' : 'Run scan now'}</button>
      </div>
      {loading && alerts.length === 0 ? <div className={styles.loading}>Loading…</div>
        : error ? <div className={styles.error}>{error}</div>
        : alerts.length === 0 ? <div className={styles.empty}>No alerts — all clear.</div>
        : (
          <div className={styles.alertList}>
            {alerts.map(a => (
              <div
                key={a.id}
                className={`${styles.alert} ${a.severity === 'critical' ? styles.alertCritical : a.severity === 'warning' ? styles.alertWarning : styles.alertInfo}`}
              >
                <div className={styles.alertBody}>
                  <div className={styles.alertMsg}>{a.message}</div>
                  <div className={styles.alertMeta}>
                    {a.alert_type} · {a.subject_type}:{a.subject.slice(0, 18)}
                    {a.score != null && ` · score ${a.score}`}
                    {a.hit_count > 1 && ` · ×${a.hit_count}`}
                    {' · '}{fmtRelative(a.updated_at)}
                    {a.dismissed && ' · dismissed'}
                  </div>
                </div>
                {!a.dismissed && (
                  <button className={styles.dismissBtn} onClick={() => dismiss(a.id)}>Dismiss</button>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

// ── Rate-limit settings ──────────────────────────────────────────────────────

const NUM_FIELDS: { key: keyof RateLimitConfig; label: string }[] = [
  { key: 'per_user_per_hour', label: 'Per user / hour' },
  { key: 'per_ip_per_hour', label: 'Per IP / hour' },
  { key: 'per_endpoint_per_hour', label: 'Per endpoint / hour' },
  { key: 'burst_limit', label: 'Burst limit' },
  { key: 'burst_window_seconds', label: 'Burst window (s)' },
  { key: 'daily_quota_per_user', label: 'Daily quota / user' },
  { key: 'daily_quota_per_ip', label: 'Daily quota / IP' },
]

function SettingsTab() {
  const [cfg, setCfg] = useState<RateLimitConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRateLimitConfig()
      .then(c => { if (!cancelled) setCfg(c) })
      .catch(e => { if (!cancelled) setError(describe(e, 'Failed to load config')) })
    return () => { cancelled = true }
  }, [])

  const setField = (key: keyof RateLimitConfig, value: number | boolean | null) => {
    setCfg(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    setMsg(null)
    try {
      const saved = await updateRateLimitConfig(cfg)
      setCfg(saved)
      setMsg('Saved.')
    } catch (e) {
      setError(describe(e, 'Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  if (error && !cfg) return <div className={styles.error}>{error}</div>
  if (!cfg) return <div className={styles.loading}>Loading…</div>

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <span>Rate limiting</span>
        <span className={styles.panelSub}>infrastructure ready · disabled by default</span>
      </div>
      <p className={styles.tileSub} style={{ marginBottom: 14 }}>
        Configure limits now so enforcement can be switched on later without a deploy. Leave a field
        blank to disable that dimension. Nothing here throttles traffic while “Enabled” is off.
      </p>
      <div className={styles.toggleRow}>
        <input
          id="rl-enabled"
          type="checkbox"
          checked={cfg.enabled}
          onChange={e => setField('enabled', e.target.checked)}
        />
        <label htmlFor="rl-enabled" className={styles.fieldLabel} style={{ fontSize: 12 }}>
          Enforcement {cfg.enabled ? 'ENABLED' : 'disabled'}
        </label>
      </div>
      <div className={styles.formGrid}>
        {NUM_FIELDS.map(f => (
          <div key={String(f.key)} className={styles.field}>
            <label className={styles.fieldLabel}>{f.label}</label>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={(cfg[f.key] as number | null) ?? ''}
              onChange={e => setField(f.key, e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className={styles.saveBtn} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save config'}</button>
        {msg && <span className={styles.statusOk} style={{ fontFamily: 'monospace', fontSize: 12 }}>{msg}</span>}
        {error && <span className={styles.error}>{error}</span>}
        {cfg.updated_at && <span className={styles.tileSub}>Updated {fmtRelative(cfg.updated_at)}</span>}
      </div>
    </div>
  )
}
