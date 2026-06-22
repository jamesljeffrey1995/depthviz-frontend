import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  listCompetitions, createCompetition, updateCompetition, deleteCompetition,
  listCompetitors, createCompetitor, updateCompetitor, deleteCompetitor,
  listTeams, createTeam, updateTeam, deleteTeam,
  getBoard, setWaterStatus,
  listFish, createFish, updateFish, deleteFish, getSpeciesList,
  listIncidents, createIncident, updateIncident,
  getScoringRule, updateScoringRule, getResults,
  downloadCompetitionCsv, autoPairBuddies,
} from '../lib/api'
import type {
  Competition, CompetitionInput, CompetitionStatus,
  Competitor, CompetitorInput, CompetitorStatus,
  CompetitionTeam, WaterStatusBoard,
  FishEntry, FishEntryInput, CompetitionIncident, IncidentType,
  ScoringRule, CompetitionResults,
} from '../types'
import styles from './CompetitionAdmin.module.css'

interface Props {
  isAdmin: boolean
}

type Tab = 'overview' | 'competitors' | 'teams' | 'board' | 'weighin' | 'results' | 'incidents'

const STATUS_LABELS: Record<CompetitorStatus, string> = {
  not_arrived: 'Not arrived',
  registered: 'Registered',
  in_water: 'In water',
  returned: 'Returned',
  late: 'Late',
  withdrawn: 'Withdrawn',
}

const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  draft: 'Draft',
  open: 'Open for registration',
  active: 'Active',
  weigh_in: 'Weigh-in',
  finished: 'Finished',
  cancelled: 'Cancelled',
}

const INCIDENT_LABELS: Record<IncidentType, string> = {
  late_return: 'Late return',
  injury: 'Injury',
  lost_contact: 'Lost contact',
  equipment: 'Equipment issue',
  weather: 'Weather issue',
  other: 'Other',
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Reusable status badge with a colour driven by the competitor's status. */
function StatusBadge({ status, overdue }: { status: CompetitorStatus; overdue?: boolean }) {
  const cls = overdue && status === 'in_water'
    ? styles.badgeOverdue
    : styles[`badge_${status}`] ?? styles.badge
  return <span className={`${styles.badge} ${cls}`}>{overdue && status === 'in_water' ? 'Overdue' : STATUS_LABELS[status]}</span>
}

// ── Root component ───────────────────────────────────────────────────────────

export function CompetitionAdmin({ isAdmin }: Props) {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('board')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    listCompetitions()
      .then(items => {
        setCompetitions(items)
        // Auto-select a single competition so the operator lands on the board.
        if (items.length > 0 && selectedId === null) setSelectedId(items[0].id)
      })
      .catch(e => setError(errMsg(e)))
      .finally(() => setLoading(false))
  // selectedId intentionally excluded: we only auto-select on first load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const selected = competitions.find(c => c.id === selectedId) ?? null

  // Defence in depth: the route is already admin-gated, but never render the
  // operational UI for a non-admin even if this component were mounted directly.
  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <p className={styles.error} role="alert">Admin access required.</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.head}>
        <h1 className={styles.title}>Competition Ops</h1>
        <div className={styles.headActions}>
          {competitions.length > 0 && (
            <select
              className={styles.select}
              value={selectedId ?? ''}
              onChange={e => { setSelectedId(Number(e.target.value)); setTab('board') }}
              aria-label="Select competition"
            >
              {competitions.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.competition_date}</option>
              ))}
            </select>
          )}
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ New</button>
        </div>
      </header>

      <p className={styles.privateNote}>
        Private admin area — not visible to the public. Default visibility is admin-only.
      </p>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {showCreate && (
        <CompetitionForm
          onCancel={() => setShowCreate(false)}
          onSaved={c => { setShowCreate(false); setSelectedId(c.id); load() }}
        />
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : competitions.length === 0 ? (
        <p className={styles.muted}>No competitions yet. Create one to get started.</p>
      ) : selected ? (
        <>
          <nav className={styles.tabs} aria-label="Competition sections">
            {([
              ['board', 'Water board'],
              ['competitors', 'Competitors'],
              ['teams', 'Teams'],
              ['weighin', 'Weigh-in'],
              ['results', 'Results'],
              ['incidents', 'Incidents'],
              ['overview', 'Setup'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                className={tab === t ? styles.tabActive : styles.tab}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === 'overview' && <OverviewTab comp={selected} onChanged={load} />}
          {tab === 'competitors' && <CompetitorsTab cid={selected.id} />}
          {tab === 'teams' && <TeamsTab cid={selected.id} />}
          {tab === 'board' && <BoardTab cid={selected.id} />}
          {tab === 'weighin' && <WeighInTab cid={selected.id} />}
          {tab === 'results' && <ResultsTab cid={selected.id} />}
          {tab === 'incidents' && <IncidentsTab cid={selected.id} />}
        </>
      ) : null}
    </div>
  )
}

// ── Competition create/edit form ─────────────────────────────────────────────

const EMPTY_COMP: CompetitionInput = {
  name: '', competition_date: '', backup_date: '', location_site: '',
  boundaries_notes: '', start_time: '', finish_time: '', sign_in_deadline: '',
  weigh_in_start: '', status: 'draft', visibility: 'admin',
}

function CompetitionForm({
  initial, onCancel, onSaved,
}: {
  initial?: Competition
  onCancel: () => void
  onSaved: (c: Competition) => void
}) {
  const [draft, setDraft] = useState<CompetitionInput>(
    initial
      ? {
          name: initial.name,
          competition_date: initial.competition_date,
          backup_date: initial.backup_date ?? '',
          location_site: initial.location_site ?? '',
          boundaries_notes: initial.boundaries_notes ?? '',
          start_time: initial.start_time ?? '',
          finish_time: initial.finish_time ?? '',
          sign_in_deadline: initial.sign_in_deadline ?? '',
          weigh_in_start: initial.weigh_in_start ?? '',
          status: initial.status,
          visibility: initial.visibility,
        }
      : EMPTY_COMP,
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof CompetitionInput>(key: K, value: CompetitionInput[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  async function save() {
    if (!draft.name.trim() || !draft.competition_date) {
      setErr('Name and date are required.')
      return
    }
    setSaving(true)
    setErr('')
    // Blank optional strings → null so we don't store empty strings for times/dates.
    const payload: CompetitionInput = {
      ...draft,
      name: draft.name.trim(),
      backup_date: draft.backup_date || null,
      location_site: draft.location_site || null,
      boundaries_notes: draft.boundaries_notes || null,
      start_time: draft.start_time || null,
      finish_time: draft.finish_time || null,
      sign_in_deadline: draft.sign_in_deadline || null,
      weigh_in_start: draft.weigh_in_start || null,
    }
    try {
      const saved = initial
        ? await updateCompetition(initial.id, payload)
        : await createCompetition(payload)
      onSaved(saved)
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{initial ? 'Edit competition' : 'New competition'}</h2>
      {err && <p className={styles.error} role="alert">{err}</p>}
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Name</span>
          <input className={styles.input} value={draft.name} maxLength={200}
                 onChange={e => set('name', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Location / site</span>
          <input className={styles.input} value={draft.location_site ?? ''} maxLength={200}
                 placeholder="e.g. Seaton Sluice"
                 onChange={e => set('location_site', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Date</span>
          <input className={styles.input} type="date" value={draft.competition_date}
                 onChange={e => set('competition_date', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Backup date</span>
          <input className={styles.input} type="date" value={draft.backup_date ?? ''}
                 onChange={e => set('backup_date', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Start time</span>
          <input className={styles.input} type="time" value={draft.start_time ?? ''}
                 onChange={e => set('start_time', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Finish time</span>
          <input className={styles.input} type="time" value={draft.finish_time ?? ''}
                 onChange={e => set('finish_time', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Sign-in deadline</span>
          <input className={styles.input} type="time" value={draft.sign_in_deadline ?? ''}
                 onChange={e => set('sign_in_deadline', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Weigh-in start</span>
          <input className={styles.input} type="time" value={draft.weigh_in_start ?? ''}
                 onChange={e => set('weigh_in_start', e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select className={styles.input} value={draft.status}
                  onChange={e => set('status', e.target.value as CompetitionStatus)}>
            {Object.entries(COMPETITION_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Visibility</span>
          <select className={styles.input} value={draft.visibility}
                  onChange={e => set('visibility', e.target.value as 'admin' | 'released')}>
            <option value="admin">Admin only (default)</option>
            <option value="released">Released / public</option>
          </select>
        </label>
      </div>
      <label className={styles.field}>
        <span>Boundaries / area notes</span>
        <textarea className={styles.textarea} rows={3} value={draft.boundaries_notes ?? ''}
                  onChange={e => set('boundaries_notes', e.target.value)} />
      </label>
      <div className={styles.formActions}>
        <button className={styles.btnGhost} onClick={onCancel} disabled={saving}>Cancel</button>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  )
}

// ── Setup / overview tab ─────────────────────────────────────────────────────

function OverviewTab({ comp, onChanged }: { comp: Competition; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)

  async function remove() {
    if (!confirm(`Delete “${comp.name}” and all its data? This cannot be undone.`)) return
    await deleteCompetition(comp.id)
    onChanged()
  }

  if (editing) {
    return <CompetitionForm initial={comp} onCancel={() => setEditing(false)}
                            onSaved={() => { setEditing(false); onChanged() }} />
  }

  return (
    <div className={styles.card}>
      <div className={styles.detailRow}><span>Status</span><strong>{COMPETITION_STATUS_LABELS[comp.status]}</strong></div>
      <div className={styles.detailRow}><span>Visibility</span><strong>{comp.visibility === 'admin' ? 'Admin only' : 'Released'}</strong></div>
      <div className={styles.detailRow}><span>Site</span><strong>{comp.location_site ?? '—'}</strong></div>
      <div className={styles.detailRow}><span>Date</span><strong>{comp.competition_date}</strong></div>
      <div className={styles.detailRow}><span>Backup date</span><strong>{comp.backup_date ?? '—'}</strong></div>
      <div className={styles.detailRow}><span>Start → Finish</span><strong>{comp.start_time ?? '—'} → {comp.finish_time ?? '—'}</strong></div>
      <div className={styles.detailRow}><span>Sign-in deadline</span><strong>{comp.sign_in_deadline ?? '—'}</strong></div>
      <div className={styles.detailRow}><span>Weigh-in start</span><strong>{comp.weigh_in_start ?? '—'}</strong></div>
      {comp.boundaries_notes && <p className={styles.notes}>{comp.boundaries_notes}</p>}
      <div className={styles.formActions}>
        <button className={styles.btnDanger} onClick={remove}>Delete</button>
        <button className={styles.btnPrimary} onClick={() => setEditing(true)}>Edit setup</button>
      </div>
    </div>
  )
}

// ── Water status board tab (priority screen) ─────────────────────────────────

const BOARD_FILTERS: { key: CompetitorStatus | 'all' | 'overdue'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_water', label: 'In water' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'returned', label: 'Returned' },
  { key: 'not_arrived', label: 'Not arrived' },
  { key: 'registered', label: 'Registered' },
]

function BoardTab({ cid }: { cid: number }) {
  const [board, setBoard] = useState<WaterStatusBoard | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<CompetitorStatus | 'all' | 'overdue'>('all')
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    getBoard(cid).then(setBoard).catch(e => setError(errMsg(e)))
  }, [cid])

  // Auto-refresh every 20s so overdue/in-water counts stay live during the event.
  useEffect(() => {
    load()
    const id = setInterval(load, 20000)
    return () => clearInterval(id)
  }, [load])

  async function act(c: Competitor, status: CompetitorStatus) {
    setBusy(c.id)
    setError('')
    try {
      await setWaterStatus(cid, c.id, status)
      load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const items = useMemo(() => {
    if (!board) return []
    if (filter === 'all') return board.items
    if (filter === 'overdue') return board.items.filter(i => i.is_overdue)
    return board.items.filter(i => i.status === filter)
  }, [board, filter])

  if (error && !board) return <p className={styles.error} role="alert">{error}</p>
  if (!board) return <p className={styles.muted}>Loading board…</p>

  const c = board.counts
  return (
    <div>
      <div className={styles.countBar}>
        <div className={`${styles.count} ${styles.countWater}`}><strong>{c.in_water}</strong><span>In water</span></div>
        <div className={`${styles.count} ${styles.countReturned}`}><strong>{c.returned}</strong><span>Returned</span></div>
        <div className={`${styles.count} ${c.overdue > 0 ? styles.countOverdue : ''}`}><strong>{c.overdue}</strong><span>Overdue</span></div>
        <div className={styles.count}><strong>{c.not_arrived}</strong><span>Not arrived</span></div>
        {c.no_team > 0 && (
          <div className={`${styles.count} ${styles.countWarn}`}><strong>{c.no_team}</strong><span>No buddy</span></div>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.filterRow} role="group" aria-label="Filter board">
        {BOARD_FILTERS.map(f => (
          <button key={f.key} aria-pressed={filter === f.key}
                  className={filter === f.key ? styles.chipActive : styles.chip}
                  onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        <button className={styles.refreshBtn} onClick={load} aria-label="Refresh board">↻</button>
      </div>

      {items.length === 0 ? (
        <p className={styles.muted}>No competitors match this filter.</p>
      ) : (
        <ul className={styles.boardList}>
          {items.map(c2 => (
            <li key={c2.id} className={c2.is_overdue ? `${styles.boardCard} ${styles.boardCardOverdue}` : styles.boardCard}>
              <div className={styles.boardCardHead}>
                <div>
                  <div className={styles.boardName}>{c2.full_name}</div>
                  <div className={styles.boardMeta}>
                    {c2.team_name ? `${c2.team_name}` : <span className={styles.warnText}>No buddy/team</span>}
                    {c2.float_colour ? ` · float: ${c2.float_colour}` : ''}
                    {c2.intended_dive_area ? ` · ${c2.intended_dive_area}` : ''}
                  </div>
                </div>
                <StatusBadge status={c2.status} overdue={c2.is_overdue} />
              </div>

              <div className={styles.boardTimes}>
                <span>Out: {fmtTime(c2.signed_out_at)}</span>
                <span>Back: {fmtTime(c2.returned_at)}</span>
                {c2.is_overdue && <span className={styles.warnText}>+{c2.minutes_overdue} min overdue</span>}
                {c2.phone && <a className={styles.callLink} href={`tel:${c2.phone}`}>Call {c2.phone}</a>}
              </div>

              {(c2.emergency_contact_name || c2.emergency_contact_phone) && (
                <div className={styles.boardEmergency}>
                  ICE: {c2.emergency_contact_name ?? '—'}
                  {c2.emergency_contact_phone && (
                    <a className={styles.callLink} href={`tel:${c2.emergency_contact_phone}`}> {c2.emergency_contact_phone}</a>
                  )}
                </div>
              )}

              <div className={styles.actionRow}>
                {c2.status === 'not_arrived' && (
                  <button className={styles.actBtn} disabled={busy === c2.id} onClick={() => act(c2, 'registered')}>Mark arrived</button>
                )}
                {c2.status !== 'in_water' && c2.status !== 'withdrawn' && (
                  <button className={`${styles.actBtn} ${styles.actWater}`} disabled={busy === c2.id} onClick={() => act(c2, 'in_water')}>Sign out → water</button>
                )}
                {c2.status === 'in_water' && (
                  <button className={`${styles.actBtn} ${styles.actReturn}`} disabled={busy === c2.id} onClick={() => act(c2, 'returned')}>Mark returned</button>
                )}
                {c2.status !== 'withdrawn' && (
                  <button className={styles.actBtnGhost} disabled={busy === c2.id} onClick={() => act(c2, 'withdrawn')}>Withdraw</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Competitors tab ──────────────────────────────────────────────────────────

const EMPTY_COMPETITOR: CompetitorInput = {
  full_name: '', phone: '', email: '', emergency_contact_name: '',
  emergency_contact_phone: '', vehicle_reg: '', experience_level: null,
  float_colour: '', medical_notes: '', paid: false, waiver_accepted: false,
  notes: '', team_id: null, status: 'registered',
}

function CompetitorsTab({ cid }: { cid: number }) {
  const [items, setItems] = useState<Competitor[]>([])
  const [teams, setTeams] = useState<CompetitionTeam[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [editing, setEditing] = useState<Competitor | 'new' | null>(null)

  const load = useCallback(() => {
    Promise.all([
      listCompetitors(cid, { q: search || undefined, unpaid: unpaidOnly || undefined }),
      listTeams(cid),
    ])
      .then(([c, t]) => { setItems(c); setTeams(t) })
      .catch(e => setError(errMsg(e)))
  }, [cid, search, unpaidOnly])

  useEffect(() => { load() }, [load])

  async function remove(c: Competitor) {
    if (!confirm(`Remove ${c.full_name}?`)) return
    await deleteCompetitor(cid, c.id)
    load()
  }

  async function togglePaid(c: Competitor) {
    await updateCompetitor(cid, c.id, { paid: !c.paid })
    load()
  }

  async function toggleWaiver(c: Competitor) {
    await updateCompetitor(cid, c.id, { waiver_accepted: !c.waiver_accepted })
    load()
  }

  if (editing) {
    return (
      <CompetitorForm
        cid={cid}
        teams={teams}
        initial={editing === 'new' ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
      />
    )
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <input className={styles.input} placeholder="Search name / phone / float / reg"
               value={search} onChange={e => setSearch(e.target.value)} />
        <label className={styles.checkInline}>
          <input type="checkbox" checked={unpaidOnly} onChange={e => setUnpaidOnly(e.target.checked)} /> Unpaid only
        </label>
        <button className={styles.btnPrimary} onClick={() => setEditing('new')}>+ Add</button>
        <button className={styles.btnGhost} onClick={() => downloadCompetitionCsv(cid, 'competitors')}>Export CSV</button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {items.length === 0 ? (
        <p className={styles.muted}>No competitors yet.</p>
      ) : (
        <ul className={styles.cardList}>
          {items.map(c => (
            <li key={c.id} className={styles.compCard}>
              <div className={styles.compCardHead}>
                <span className={styles.compName}>{c.full_name}</span>
                <StatusBadge status={c.status} overdue={c.is_overdue} />
              </div>
              <div className={styles.boardMeta}>
                {c.team_name ?? <span className={styles.warnText}>No buddy/team</span>}
                {c.experience_level ? ` · ${c.experience_level}` : ''}
                {c.float_colour ? ` · float: ${c.float_colour}` : ''}
              </div>
              <div className={styles.tagRow}>
                <button className={c.paid ? styles.tagOn : styles.tagOff} onClick={() => togglePaid(c)}>
                  {c.paid ? 'Paid' : 'Unpaid'}
                </button>
                <button className={c.waiver_accepted ? styles.tagOn : styles.tagOff} onClick={() => toggleWaiver(c)}>
                  {c.waiver_accepted ? 'Waiver ✓' : 'No waiver'}
                </button>
              </div>
              <div className={styles.actionRow}>
                <button className={styles.linkBtn} onClick={() => setEditing(c)}>Edit</button>
                <button className={styles.linkBtnDanger} onClick={() => remove(c)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CompetitorForm({
  cid, teams, initial, onCancel, onSaved,
}: {
  cid: number
  teams: CompetitionTeam[]
  initial?: Competitor
  onCancel: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<CompetitorInput>(
    initial
      ? {
          full_name: initial.full_name,
          phone: initial.phone ?? '',
          email: initial.email ?? '',
          emergency_contact_name: initial.emergency_contact_name ?? '',
          emergency_contact_phone: initial.emergency_contact_phone ?? '',
          vehicle_reg: initial.vehicle_reg ?? '',
          experience_level: initial.experience_level,
          float_colour: initial.float_colour ?? '',
          medical_notes: initial.medical_notes ?? '',
          paid: initial.paid,
          waiver_accepted: initial.waiver_accepted,
          notes: initial.notes ?? '',
          team_id: initial.team_id,
        }
      : EMPTY_COMPETITOR,
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof CompetitorInput>(key: K, value: CompetitorInput[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  async function save() {
    if (!draft.full_name.trim()) { setErr('Name is required.'); return }
    setSaving(true)
    setErr('')
    const payload: CompetitorInput = {
      ...draft,
      full_name: draft.full_name.trim(),
      phone: draft.phone || null,
      email: draft.email || null,
      emergency_contact_name: draft.emergency_contact_name || null,
      emergency_contact_phone: draft.emergency_contact_phone || null,
      vehicle_reg: draft.vehicle_reg || null,
      float_colour: draft.float_colour || null,
      medical_notes: draft.medical_notes || null,
      notes: draft.notes || null,
    }
    try {
      if (initial) await updateCompetitor(cid, initial.id, payload)
      else await createCompetitor(cid, payload)
      onSaved()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{initial ? 'Edit competitor' : 'Add competitor'}</h2>
      {err && <p className={styles.error} role="alert">{err}</p>}
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Full name</span>
          <input className={styles.input} value={draft.full_name} onChange={e => set('full_name', e.target.value)} /></label>
        <label className={styles.field}><span>Phone</span>
          <input className={styles.input} type="tel" value={draft.phone ?? ''} onChange={e => set('phone', e.target.value)} /></label>
        <label className={styles.field}><span>Email</span>
          <input className={styles.input} type="email" value={draft.email ?? ''} onChange={e => set('email', e.target.value)} /></label>
        <label className={styles.field}><span>Emergency contact</span>
          <input className={styles.input} value={draft.emergency_contact_name ?? ''} onChange={e => set('emergency_contact_name', e.target.value)} /></label>
        <label className={styles.field}><span>Emergency phone</span>
          <input className={styles.input} type="tel" value={draft.emergency_contact_phone ?? ''} onChange={e => set('emergency_contact_phone', e.target.value)} /></label>
        <label className={styles.field}><span>Vehicle reg</span>
          <input className={styles.input} value={draft.vehicle_reg ?? ''} onChange={e => set('vehicle_reg', e.target.value)} /></label>
        <label className={styles.field}><span>Experience</span>
          <select className={styles.input} value={draft.experience_level ?? ''}
                  onChange={e => set('experience_level', (e.target.value || null) as CompetitorInput['experience_level'])}>
            <option value="">—</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="experienced">Experienced</option>
          </select></label>
        <label className={styles.field}><span>Float colour / description</span>
          <input className={styles.input} value={draft.float_colour ?? ''} onChange={e => set('float_colour', e.target.value)} /></label>
        <label className={styles.field}><span>Team / buddy</span>
          <select className={styles.input} value={draft.team_id ?? ''}
                  onChange={e => set('team_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">— No team —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
      </div>
      <label className={styles.field}><span>Medical notes</span>
        <textarea className={styles.textarea} rows={2} value={draft.medical_notes ?? ''} onChange={e => set('medical_notes', e.target.value)} /></label>
      <label className={styles.field}><span>Notes</span>
        <textarea className={styles.textarea} rows={2} value={draft.notes ?? ''} onChange={e => set('notes', e.target.value)} /></label>
      <div className={styles.checkRow}>
        <label className={styles.checkInline}>
          <input type="checkbox" checked={draft.paid ?? false} onChange={e => set('paid', e.target.checked)} /> Paid
        </label>
        <label className={styles.checkInline}>
          <input type="checkbox" checked={draft.waiver_accepted ?? false} onChange={e => set('waiver_accepted', e.target.checked)} /> Waiver accepted
        </label>
      </div>
      <div className={styles.formActions}>
        <button className={styles.btnGhost} onClick={onCancel} disabled={saving}>Cancel</button>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}

// ── Teams tab ────────────────────────────────────────────────────────────────

function TeamsTab({ cid }: { cid: number }) {
  const [teams, setTeams] = useState<CompetitionTeam[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editArea, setEditArea] = useState('')

  const load = useCallback(() => {
    listTeams(cid).then(setTeams).catch(e => setError(errMsg(e)))
  }, [cid])
  useEffect(() => { load() }, [load])

  async function add() {
    if (!name.trim()) return
    try {
      await createTeam(cid, { name: name.trim(), intended_dive_area: area.trim() || null })
      setName(''); setArea(''); load()
    } catch (e) { setError(errMsg(e)) }
  }

  async function saveEdit(id: number) {
    await updateTeam(cid, id, { name: editName.trim(), intended_dive_area: editArea.trim() || null })
    setEditingId(null); load()
  }

  async function remove(t: CompetitionTeam) {
    if (!confirm(`Delete team “${t.name}”? Members will be unassigned.`)) return
    await deleteTeam(cid, t.id); load()
  }

  async function autoPair() {
    if (!confirm('Randomly pair every competitor who still has no buddy? An odd one out joins a pair to make a trio.')) return
    try {
      const r = await autoPairBuddies(cid)
      setError('')
      alert(`Paired ${r.competitors_paired} competitor(s) into ${r.teams_created} buddy team(s).`)
      load()
    } catch (e) { setError(errMsg(e)) }
  }

  return (
    <div>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>New team / buddy pair</h2>
        <div className={styles.toolbar}>
          <input className={styles.input} placeholder="Team name" value={name} onChange={e => setName(e.target.value)} />
          <input className={styles.input} placeholder="Intended dive area" value={area} onChange={e => setArea(e.target.value)} />
          <button className={styles.btnPrimary} onClick={add}>Add</button>
          <button className={styles.btnGhost} onClick={() => downloadCompetitionCsv(cid, 'teams')}>Export CSV</button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Dive-day buddy assignment</h2>
        <p className={styles.muted}>
          Randomly pairs everyone still without a buddy (solo divers and those whose
          invited buddy never registered) into buddy teams of two. An odd one out joins
          a pair to make a trio.
        </p>
        <button className={styles.btnPrimary} onClick={autoPair}>Randomly assign buddies</button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {teams.length === 0 ? (
        <p className={styles.muted}>No teams yet.</p>
      ) : (
        <ul className={styles.cardList}>
          {teams.map(t => (
            <li key={t.id} className={styles.compCard}>
              {editingId === t.id ? (
                <div className={styles.toolbar}>
                  <input className={styles.input} value={editName} onChange={e => setEditName(e.target.value)} />
                  <input className={styles.input} value={editArea} onChange={e => setEditArea(e.target.value)} />
                  <button className={styles.btnPrimary} onClick={() => saveEdit(t.id)}>Save</button>
                  <button className={styles.btnGhost} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div className={styles.compCardHead}>
                    <span className={styles.compName}>{t.name}</span>
                    <span className={`${styles.badge} ${t.member_count < 2 ? styles.badgeWarn : styles.badge_returned}`}>
                      {t.member_count} {t.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <div className={styles.boardMeta}>{t.intended_dive_area ?? 'No dive area set'}</div>
                  {t.member_count < 2 && <div className={styles.warnText}>Needs a buddy — fewer than 2 members</div>}
                  <div className={styles.actionRow}>
                    <button className={styles.linkBtn}
                            onClick={() => { setEditingId(t.id); setEditName(t.name); setEditArea(t.intended_dive_area ?? '') }}>Edit</button>
                    <button className={styles.linkBtnDanger} onClick={() => remove(t)}>Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Weigh-in tab ─────────────────────────────────────────────────────────────
//
// Two-step, table-driven flow built for the day:
//   1. A table of every competitor — tap one to open their card.
//   2. On the card, a +/- stepper per species tallies fish as they're caught
//      (each "+" records a fish with no weight yet). Weights, lengths and DQs
//      are filled in afterwards on the per-fish list.

function WeighInTab({ cid }: { cid: number }) {
  const [entries, setEntries] = useState<FishEntry[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [species, setSpecies] = useState<string[]>([])
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    return Promise.all([listFish(cid), listCompetitors(cid), getSpeciesList(cid)])
      .then(([f, c, s]) => { setEntries(f); setCompetitors(c); setSpecies(s) })
      .catch(e => setError(errMsg(e)))
  }, [cid])
  useEffect(() => { load() }, [load])

  const byCompetitor = useMemo(() => {
    const m = new Map<number, FishEntry[]>()
    for (const f of entries) {
      const arr = m.get(f.competitor_id) ?? []
      arr.push(f)
      m.set(f.competitor_id, arr)
    }
    return m
  }, [entries])

  const selected = selectedId !== null ? competitors.find(c => c.id === selectedId) ?? null : null

  if (selected) {
    return (
      <CompetitorWeighIn
        cid={cid}
        competitor={selected}
        species={species}
        entries={byCompetitor.get(selected.id) ?? []}
        onBack={() => setSelectedId(null)}
        onChanged={load}
        onError={setError}
        error={error}
      />
    )
  }

  const filtered = competitors.filter(
    c => !search || c.full_name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div>
      <div className={styles.toolbar}>
        <input className={styles.input} placeholder="Search competitor"
               value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.btnGhost} onClick={() => downloadCompetitionCsv(cid, 'fish')}>Export CSV</button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {filtered.length === 0 ? (
        <p className={styles.muted}>No competitors yet — add them on the Competitors tab.</p>
      ) : (
        <ul className={styles.weighTable}>
          {filtered.map(c => {
            const fish = byCompetitor.get(c.id) ?? []
            const live = fish.filter(f => !f.disqualified)
            const pending = live.filter(f => f.pending).length
            const kg = live.reduce((sum, f) => sum + (f.weight_kg ?? 0), 0)
            return (
              <li key={c.id}>
                <button className={styles.weighRow} onClick={() => setSelectedId(c.id)}>
                  <span className={styles.weighRowName}>{c.full_name}</span>
                  <span className={styles.weighRowStats}>
                    <span className={styles.weighStat}>{live.length} fish</span>
                    <span className={styles.weighStat}>{kg.toFixed(2)} kg</span>
                    {pending > 0 && <span className={styles.weighPending}>{pending} to weigh</span>}
                  </span>
                  <span className={styles.weighChevron} aria-hidden="true">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CompetitorWeighIn({
  cid, competitor, species, entries, onBack, onChanged, onError, error,
}: {
  cid: number
  competitor: Competitor
  species: string[]
  entries: FishEntry[]
  onBack: () => void
  onChanged: () => Promise<unknown>
  onError: (msg: string) => void
  error: string
}) {
  const [busy, setBusy] = useState(false)

  // Count per species (excludes disqualified so the tally reflects live catches).
  const countFor = (sp: string) => entries.filter(f => f.species === sp && !f.disqualified).length

  async function addOne(sp: string) {
    setBusy(true); onError('')
    try {
      await createFish(cid, { competitor_id: competitor.id, species: sp })
      await onChanged()
    } catch (e) { onError(errMsg(e)) } finally { setBusy(false) }
  }

  async function removeOne(sp: string) {
    // Remove the most recently added of this species, preferring an unweighed
    // (pending) one so a recorded weight isn't lost to an accidental tap.
    const candidates = entries
      .filter(f => f.species === sp && !f.disqualified)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (candidates.length === 0) return
    const target = candidates.filter(f => f.pending).pop() ?? candidates[candidates.length - 1]
    setBusy(true); onError('')
    try {
      await deleteFish(cid, target.id)
      await onChanged()
    } catch (e) { onError(errMsg(e)) } finally { setBusy(false) }
  }

  async function setField(f: FishEntry, patch: Partial<FishEntryInput>) {
    onError('')
    try { await updateFish(cid, f.id, patch); await onChanged() }
    catch (e) { onError(errMsg(e)) }
  }

  async function toggleDq(f: FishEntry) {
    const reason = f.disqualified ? null : (prompt('Disqualification reason?') ?? 'Disqualified')
    await setField(f, { disqualified: !f.disqualified, disqualification_reason: reason })
  }

  async function remove(f: FishEntry) {
    if (!confirm('Delete this entry?')) return
    onError('')
    try { await deleteFish(cid, f.id); await onChanged() }
    catch (e) { onError(errMsg(e)) }
  }

  const sortedEntries = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.btnGhost} onClick={onBack}>‹ All competitors</button>
        <span className={styles.compName}>{competitor.full_name}</span>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Tally catches</h2>
        <ul className={styles.tallyList}>
          {species.map(sp => {
            const n = countFor(sp)
            return (
              <li key={sp} className={styles.tallyRow}>
                <span className={styles.tallySpecies}>{sp}</span>
                <div className={styles.stepper}>
                  <button className={styles.stepBtn} disabled={busy || n === 0}
                          aria-label={`Remove one ${sp}`} onClick={() => removeOne(sp)}>−</button>
                  <span className={n > 0 ? styles.stepCountOn : styles.stepCount}>{n}</span>
                  <button className={styles.stepBtnAdd} disabled={busy}
                          aria-label={`Add one ${sp}`} onClick={() => addOne(sp)}>+</button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Weights &amp; details</h2>
        {sortedEntries.length === 0 ? (
          <p className={styles.muted}>No fish tallied yet. Use the steppers above.</p>
        ) : (
          <ul className={styles.cardList}>
            {sortedEntries.map(f => (
              <li key={f.id} className={f.disqualified ? `${styles.compCard} ${styles.dqCard}` : styles.compCard}>
                <div className={styles.compCardHead}>
                  <span className={styles.compName}>{f.species}</span>
                  {f.disqualified
                    ? <span className={`${styles.badge} ${styles.badgeOverdue}`}>DQ</span>
                    : f.pending && <span className={`${styles.badge} ${styles.badgeWarn}`}>To weigh</span>}
                </div>
                <div className={styles.weighFields}>
                  <label className={styles.field}><span>Weight (g)</span>
                    <input className={styles.input} type="number" inputMode="decimal"
                           defaultValue={f.weight_grams ?? ''}
                           key={`w-${f.id}-${f.weight_grams ?? ''}`}
                           onBlur={e => {
                             const v = e.target.value.trim()
                             const num = v === '' ? null : parseFloat(v)
                             if (num !== null && !(num > 0)) return
                             if (num !== (f.weight_grams ?? null)) setField(f, { weight_grams: num })
                           }} /></label>
                  <label className={styles.field}><span>Length (cm)</span>
                    <input className={styles.input} type="number" inputMode="decimal"
                           defaultValue={f.length_cm ?? ''}
                           key={`l-${f.id}-${f.length_cm ?? ''}`}
                           onBlur={e => {
                             const v = e.target.value.trim()
                             const num = v === '' ? null : parseFloat(v)
                             if (num !== (f.length_cm ?? null)) setField(f, { length_cm: num })
                           }} /></label>
                </div>
                {f.disqualified && f.disqualification_reason && (
                  <div className={styles.warnText}>DQ: {f.disqualification_reason}</div>
                )}
                <div className={styles.actionRow}>
                  <button className={styles.linkBtn} onClick={() => toggleDq(f)}>{f.disqualified ? 'Reinstate' : 'Disqualify'}</button>
                  <button className={styles.linkBtnDanger} onClick={() => remove(f)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Results tab ──────────────────────────────────────────────────────────────

function ResultsTab({ cid }: { cid: number }) {
  const [results, setResults] = useState<CompetitionResults | null>(null)
  const [rule, setRule] = useState<ScoringRule | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    Promise.all([getResults(cid), getScoringRule(cid)])
      .then(([r, sr]) => { setResults(r); setRule(sr) })
      .catch(e => setError(errMsg(e)))
  }, [cid])
  useEffect(() => { load() }, [load])

  async function saveRule(pointsPerGram: number, useTeam: boolean) {
    await updateScoringRule(cid, { points_per_gram: pointsPerGram, use_team_scoring: useTeam })
    load()
  }

  if (error && !results) return <p className={styles.error} role="alert">{error}</p>
  if (!results || !rule) return <p className={styles.muted}>Loading results…</p>

  const t = results.totals
  return (
    <div>
      <div className={styles.countBar}>
        <div className={styles.count}><strong>{t.total_fish}</strong><span>Fish</span></div>
        <div className={styles.count}><strong>{t.total_weight_kg}</strong><span>Total kg</span></div>
        {t.pending_fish > 0 && (
          <div className={`${styles.count} ${styles.countWarn}`}><strong>{t.pending_fish}</strong><span>To weigh</span></div>
        )}
        <div className={styles.count}><strong>{t.disqualified}</strong><span>DQ</span></div>
        <div className={styles.count}><strong>{t.competitors}</strong><span>Competitors</span></div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Scoring</h2>
        <div className={styles.toolbar}>
          <label className={styles.field}><span>Points per gram</span>
            <input className={styles.input} type="number" inputMode="decimal" defaultValue={rule.points_per_gram}
                   onBlur={e => saveRule(parseFloat(e.target.value) || 0, rule.use_team_scoring)} /></label>
          <label className={styles.checkInline}>
            <input type="checkbox" checked={rule.use_team_scoring}
                   onChange={e => saveRule(rule.points_per_gram, e.target.checked)} /> Team scoring
          </label>
          <button className={styles.btnGhost} onClick={() => downloadCompetitionCsv(cid, 'results')}>Export CSV</button>
        </div>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {results.biggest_fish && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Biggest fish</h2>
          <div className={styles.boardName}>
            {results.biggest_fish.species} · {results.biggest_fish.weight_kg} kg — {results.biggest_fish.competitor_name}
          </div>
        </div>
      )}

      {results.species_hunter && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Species hunter</h2>
          <div className={styles.boardName}>
            {results.species_hunter.competitor_name} — {results.species_hunter.species_count} species
          </div>
        </div>
      )}

      <h2 className={styles.sectionTitle}>Overall leaderboard</h2>
      {results.individual.length === 0 ? (
        <p className={styles.muted}>No scores yet.</p>
      ) : (
        <ul className={styles.cardList}>
          {results.individual.map(r => (
            <li key={r.competitor_id} className={styles.leaderRow}>
              <span className={styles.rank}>{r.rank}</span>
              <span className={styles.leaderName}>{r.competitor_name}{r.team_name ? ` · ${r.team_name}` : ''}</span>
              <span className={styles.leaderPts}>{r.points} pts · {r.fish_count} fish · {r.total_weight_kg} kg</span>
            </li>
          ))}
        </ul>
      )}

      {rule.use_team_scoring && results.teams.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Team leaderboard</h2>
          <ul className={styles.cardList}>
            {results.teams.map(r => (
              <li key={r.team_id} className={styles.leaderRow}>
                <span className={styles.rank}>{r.rank}</span>
                <span className={styles.leaderName}>{r.team_name}</span>
                <span className={styles.leaderPts}>{r.points} pts · {r.total_weight_kg} kg</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {results.biggest_by_species.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Biggest by species</h2>
          <ul className={styles.cardList}>
            {results.biggest_by_species.map(b => (
              <li key={b.species} className={styles.leaderRow}>
                <span className={styles.leaderName}>{b.species}</span>
                <span className={styles.leaderPts}>{b.weight_kg} kg — {b.competitor_name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// ── Incidents tab ────────────────────────────────────────────────────────────

function IncidentsTab({ cid }: { cid: number }) {
  const [items, setItems] = useState<CompetitionIncident[]>([])
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [error, setError] = useState('')
  const [type, setType] = useState<IncidentType>('late_return')
  const [competitorId, setCompetitorId] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  const load = useCallback(() => {
    Promise.all([listIncidents(cid), listCompetitors(cid)])
      .then(([i, c]) => { setItems(i); setCompetitors(c) })
      .catch(e => setError(errMsg(e)))
  }, [cid])
  useEffect(() => { load() }, [load])

  async function add() {
    if (!notes.trim()) { setError('Add a note describing the incident.'); return }
    setError('')
    try {
      await createIncident(cid, {
        incident_type: type,
        competitor_id: competitorId ? Number(competitorId) : null,
        notes: notes.trim(),
      })
      setNotes(''); setCompetitorId(''); load()
    } catch (e) { setError(errMsg(e)) }
  }

  async function resolve(i: CompetitionIncident) {
    const note = prompt('Resolution notes?') ?? ''
    await updateIncident(cid, i.id, { resolved: true, resolution_notes: note })
    load()
  }

  return (
    <div>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Log incident</h2>
        <div className={styles.weighGrid}>
          <select className={styles.input} value={type} onChange={e => setType(e.target.value as IncidentType)}>
            {Object.entries(INCIDENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className={styles.input} value={competitorId}
                  onChange={e => setCompetitorId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">No specific competitor</option>
            {competitors.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <input className={styles.input} placeholder="What happened?" value={notes} onChange={e => setNotes(e.target.value)} />
          <button className={styles.btnPrimary} onClick={add}>Log</button>
        </div>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {items.length === 0 ? (
        <p className={styles.muted}>No incidents logged.</p>
      ) : (
        <ul className={styles.cardList}>
          {items.map(i => (
            <li key={i.id} className={i.resolved ? styles.compCard : `${styles.compCard} ${styles.dqCard}`}>
              <div className={styles.compCardHead}>
                <span className={styles.compName}>{INCIDENT_LABELS[i.incident_type]}</span>
                <span className={`${styles.badge} ${i.resolved ? styles.badge_returned : styles.badgeOverdue}`}>
                  {i.resolved ? 'Resolved' : 'Open'}
                </span>
              </div>
              <div className={styles.boardMeta}>{fmtTime(i.occurred_at)}</div>
              {i.notes && <p className={styles.notes}>{i.notes}</p>}
              {i.resolved && i.resolution_notes && <p className={styles.boardMeta}>Resolution: {i.resolution_notes}</p>}
              {!i.resolved && (
                <div className={styles.actionRow}>
                  <button className={styles.linkBtn} onClick={() => resolve(i)}>Mark resolved</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
