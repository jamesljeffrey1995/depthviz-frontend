import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  listCompetitions, createCompetition, updateCompetition, deleteCompetition,
  listCompetitors, createCompetitor, updateCompetitor, deleteCompetitor,
  listTeams, createTeam, updateTeam, deleteTeam,
  getBoard, setWaterStatus,
  listFish, createFish, updateFish, deleteFish, getSpeciesList,
  listIncidents, createIncident, updateIncident,
  getScoringRule, updateScoringRule, getResults,
  downloadCompetitionCsv, autoPairBuddies,
  getNotificationStatus, sendTestAlert,
  getOverview, lockResults, unlockResults,
  parseCompetitorsCsv,
} from '../lib/api'
import type {
  Competition, CompetitionInput, CompetitionStatus,
  Competitor, CompetitorInput, CompetitorStatus,
  CompetitionTeam, WaterStatusBoard,
  FishEntry, FishEntryPatch, CompetitionIncident, IncidentType, IncidentSeverity,
  ScoringRule, CompetitionResults,
  NotificationStatus, TestAlertResult,
  TargetSpecies, TargetSpeciesUnit, ScheduleItem,
  CompetitionOverview, RecommendedAction,
} from '../types'
import { CompetitionLocationPicker, type PickedPoint } from './CompetitionLocationPicker'
import styles from './CompetitionAdmin.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

// Sensible day-of defaults drawn from past club competition sheets — organisers
// can load these as a starting point and tweak per event.
const STANDARD_SCHEDULE: ScheduleItem[] = [
  { time: '07:15', title: 'Competitors arrive', detail: 'Arrive at the meeting point for check-in, equipment prep and sign-in.' },
  { time: '07:45', title: 'Health & safety briefing', detail: 'Be kitted up and ready. Mandatory briefing covering safety, rules and local regulations, plus Q&A.' },
  { time: '07:50', title: 'Final gear check & depart to the water', detail: 'Divers heading to other locations can leave at this point. Double-check gear before entering the water.' },
  { time: '08:00', title: 'Competition start', detail: 'Take short breaks as needed but stay within the competition zone.' },
  { time: '12:00', title: 'Competition end', detail: 'All competitors must be back and signed in at the meeting point. Late arrivals may be penalised.' },
  { time: '12:30', title: 'Weigh-in & score tabulation', detail: 'Judges weigh and measure the catch. Scores calculated per the competition rules.' },
  { time: '13:45', title: 'Award ceremony', detail: 'Announcement of winners, group photos and celebration.' },
]

const STANDARD_HEALTH_SAFETY = [
  'Competitors must pair up and stay together at all times for safety, and as a minimum share a float per pair (ideally one each).',
  'Swim only — no motorised water vehicles are to be used by competitors.',
  'All competitors start and finish at the designated meeting point. You may dive anywhere you like so long as you are back and signed in before the deadline.',
  'You must sign in and out. Do not leave without signing back in — this is how we account for every diver.',
  'It is illegal to land sea trout, salmon, berried or v-cut lobsters, bluefin tuna and others outlined in UK regulations. Check the local IFCA website for guidelines and restrictions.',
].join('\n')

interface Props {
  isAdmin: boolean
}

// Tab keys drive the sticky top nav. "setup" is deliberately named so a
// recommended-action shortcut can route to it.
type Tab =
  | 'overview' | 'board' | 'competitors' | 'teams' | 'weighin'
  | 'results' | 'incidents' | 'setup' | 'template'

// Persist the last-viewed competition + tab so navigating away and back
// doesn't dump the organiser onto Overview of the newest event.
const LAST_COMP_KEY = 'dv_admin_comp_id'
const LAST_TAB_KEY = 'dv_admin_comp_tab'
const TAB_VALUES: Tab[] = [
  'overview', 'board', 'competitors', 'teams', 'weighin',
  'results', 'incidents', 'setup', 'template',
]

function readStoredCompId(): number | null {
  try {
    const raw = localStorage.getItem(LAST_COMP_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch { return null }
}

function readStoredTab(): Tab {
  try {
    const raw = localStorage.getItem(LAST_TAB_KEY)
    return TAB_VALUES.find(t => t === raw) ?? 'overview'
  } catch { return 'overview' }
}

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

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  urgent: 'Urgent',
  critical: 'Critical',
}

const UNIT_LABELS: Record<TargetSpeciesUnit, string> = {
  cm: 'cm (total length)',
  mm_carapace: 'mm carapace',
}

// ── Utilities ────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}

/** Split free-text safety notes into bullet lines, one per non-blank line. */
function safetyLines(notes: string | null | undefined): string[] {
  return (notes ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Time everyone must be back on the surface — the water board's "Everyone
 *  back by" chip. Prefers finish_time; sign_in_deadline is the later
 *  paperwork deadline (used by dueBackAndSignedInLabel) and would mislead
 *  the safety board. */
function outOfWaterLabel(comp: Competition): string {
  return comp.finish_time ?? comp.sign_in_deadline ?? '—'
}

/** Time everyone must be back on shore AND signed in — used on the printed
 *  board sheet. Prefers sign_in_deadline, then falls back to finish_time. */
function dueBackAndSignedInLabel(comp: Competition): string {
  return comp.sign_in_deadline ?? comp.finish_time ?? '—'
}

/** OpenStreetMap link for a coordinate pair — printable and tappable. */
function mapsLink(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
}

/** Species minimum size, formatted for tables and warnings. Handles both the
 *  new length-based fields and the legacy weight column so older rows read
 *  cleanly until they've been re-saved. */
function formatSpeciesMin(s: TargetSpecies): string {
  if (s.min_length != null) {
    const unit = s.unit === 'mm_carapace' ? 'mm carapace' : 'cm'
    return `${s.min_length} ${unit}`
  }
  if (s.min_weight_g != null) return `${s.min_weight_g} g (legacy)`
  return 'No minimum'
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
  const [selectedId, setSelectedId] = useState<number | null>(() => readStoredCompId())
  const [tab, setTab] = useState<Tab>(() => readStoredTab())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    listCompetitions()
      .then(items => {
        setCompetitions(items)
        // Restore the last-viewed competition if it still exists; otherwise
        // fall back to the newest so we don't leave the picker blank.
        setSelectedId(prev => {
          if (prev !== null && items.some(c => c.id === prev)) return prev
          return items.length > 0 ? items[0].id : null
        })
      })
      .catch(e => setError(errMsg(e)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  useEffect(() => {
    if (!isAdmin) return
    try {
      if (selectedId === null) localStorage.removeItem(LAST_COMP_KEY)
      else localStorage.setItem(LAST_COMP_KEY, String(selectedId))
    } catch {}
  }, [isAdmin, selectedId])

  useEffect(() => {
    if (!isAdmin) return
    try { localStorage.setItem(LAST_TAB_KEY, tab) } catch {}
  }, [isAdmin, tab])

  const selected = competitions.find(c => c.id === selectedId) ?? null

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <p className={styles.error} role="alert">Admin access required.</p>
      </div>
    )
  }

  // Tabs used on the redesigned admin. Order is deliberate: safety-first
  // (Overview → Board), then people (Competitors, Teams), then the event
  // (Weigh-in, Results, Incidents), then set-up and print at the end.
  const TABS: [Tab, string][] = [
    ['overview', 'Overview'],
    ['board', 'Water board'],
    ['competitors', 'Competitors'],
    ['teams', 'Teams'],
    ['weighin', 'Weigh-in'],
    ['results', 'Results'],
    ['incidents', 'Incidents'],
    ['setup', 'Setup'],
    ['template', 'PDF & sheets'],
  ]

  return (
    <div className={styles.container}>
      <header className={styles.head}>
        <h1 className={styles.title}>Competition Ops</h1>
        <div className={styles.headActions}>
          {competitions.length > 0 && (
            <select
              className={styles.select}
              value={selectedId ?? ''}
              onChange={e => { setSelectedId(Number(e.target.value)); setTab('overview') }}
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
        <CompetitionWizard
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
            {TABS.map(([t, label]) => (
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

          {tab === 'overview' && <OverviewTab comp={selected} onNavigate={setTab} onChanged={load} />}
          {tab === 'board' && <BoardTab cid={selected.id} onOpenIncident={() => setTab('incidents')} />}
          {tab === 'competitors' && <CompetitorsTab cid={selected.id} />}
          {tab === 'teams' && <TeamsTab cid={selected.id} />}
          {tab === 'weighin' && <WeighInTab comp={selected} />}
          {tab === 'results' && <ResultsTab comp={selected} onChanged={load} />}
          {tab === 'incidents' && <IncidentsTab cid={selected.id} />}
          {tab === 'setup' && <SetupTab comp={selected} onChanged={load} />}
          {tab === 'template' && <TemplateTab comp={selected} onChanged={load} />}
        </>
      ) : null}
    </div>
  )
}

// ── Command Centre (Overview) ────────────────────────────────────────────────

function OverviewTab({
  comp, onNavigate,
}: { comp: Competition; onNavigate: (t: Tab) => void; onChanged: () => void }) {
  const [data, setData] = useState<CompetitionOverview | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    getOverview(comp.id).then(setData).catch(e => setError(errMsg(e)))
  }, [comp.id])

  // Refresh every 15s so the safety-critical counters stay live.
  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  if (error && !data) return <p className={styles.error} role="alert">{error}</p>
  if (!data) return <p className={styles.muted}>Loading overview…</p>

  const c = data.counts
  const rec = data.recommended_action

  return (
    <div className={styles.overviewWrap}>
      <RecommendedActionCard action={rec} onGo={onNavigate} />

      <div className={styles.overviewGrid}>
        <OverviewCard
          tone={c.overdue > 0 ? 'critical' : 'neutral'}
          label="Overdue"
          value={c.overdue}
          detail={c.overdue > 0 ? 'Divers past their sign-in deadline' : 'No overdue divers'}
          onOpen={() => onNavigate('board')}
        />
        <OverviewCard
          tone={c.in_water > 0 ? 'water' : 'neutral'}
          label="In water"
          value={c.in_water}
          detail="Signed out and still diving"
          onOpen={() => onNavigate('board')}
        />
        <OverviewCard
          tone="returned"
          label="Returned"
          value={c.returned}
          detail="Signed back in safely"
          onOpen={() => onNavigate('board')}
        />
        <OverviewCard
          tone={c.not_arrived > 0 ? 'warning' : 'neutral'}
          label="Not arrived"
          value={c.not_arrived}
          detail="Registered but not on site"
          onOpen={() => onNavigate('board')}
        />
        <OverviewCard
          tone={data.unpaid > 0 ? 'warning' : 'neutral'}
          label="Unpaid"
          value={data.unpaid}
          detail="Payment still outstanding"
          onOpen={() => onNavigate('competitors')}
        />
        <OverviewCard
          tone={data.missing_waiver > 0 ? 'warning' : 'neutral'}
          label="Missing waivers"
          value={data.missing_waiver}
          detail="Waiver not signed"
          onOpen={() => onNavigate('competitors')}
        />
        <OverviewCard
          tone={data.unassigned_buddy > 0 ? 'warning' : 'neutral'}
          label="No buddy"
          value={data.unassigned_buddy}
          detail="Solo divers waiting to pair"
          onOpen={() => onNavigate('teams')}
        />
        <OverviewCard
          tone={data.open_incidents > 0 ? 'critical' : 'neutral'}
          label="Open incidents"
          value={data.open_incidents}
          detail="Unresolved incidents on the log"
          onOpen={() => onNavigate('incidents')}
        />
      </div>

      <OverviewSampleList title="Overdue divers" items={data.samples.overdue} tone="critical" />
      <OverviewSampleList title="Solo divers without a buddy" items={data.samples.no_buddy} tone="warning" />
      <OverviewSampleList title="Unpaid" items={data.samples.unpaid} tone="warning" />
      <OverviewSampleList title="Missing waivers" items={data.samples.missing_waiver} tone="warning" />

      <div className={styles.overviewFoot}>
        <div className={styles.detailRow}>
          <span>Event status</span>
          <strong>{COMPETITION_STATUS_LABELS[data.competition.status]}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Visibility</span>
          <strong>{data.competition.visibility === 'admin' ? 'Admin only' : 'Released / public'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Results</span>
          <strong>{data.competition.results_locked ? 'Locked / final' : 'Provisional / live'}</strong>
        </div>
      </div>

    </div>
  )
}

function RecommendedActionCard({
  action, onGo,
}: { action: RecommendedAction; onGo: (t: Tab) => void }) {
  const cls = action.severity === 'critical'
    ? styles.recActionCritical
    : action.severity === 'warning' ? styles.recActionWarning : styles.recActionInfo
  const target = action.target_tab as Tab
  return (
    <div className={`${styles.recAction} ${cls}`} role="status">
      <div className={styles.recActionKicker}>Next recommended action</div>
      <div className={styles.recActionMessage}>{action.message}</div>
      {action.action !== 'ready' && (
        <button className={styles.btnPrimary} onClick={() => onGo(target)}>
          Go to {target === 'setup' ? 'Setup' : target}
        </button>
      )}
    </div>
  )
}

function OverviewCard({
  tone, label, value, detail, onOpen,
}: {
  tone: 'critical' | 'warning' | 'water' | 'returned' | 'neutral'
  label: string
  value: number
  detail: string
  onOpen?: () => void
}) {
  return (
    <button className={`${styles.overviewCard} ${styles[`overviewCard_${tone}`]}`}
            onClick={onOpen} type="button">
      <span className={styles.overviewValue}>{value}</span>
      <span className={styles.overviewLabel}>{label}</span>
      <span className={styles.overviewDetail}>{detail}</span>
    </button>
  )
}

function OverviewSampleList({
  title, items, tone,
}: {
  title: string
  items: { id: number; full_name: string }[]
  tone: 'critical' | 'warning'
}) {
  // No card when there is nothing to show — the Overview grid already
  // communicates the zero-count case via the neutral card tone.
  if (items.length === 0) return null
  const cls = tone === 'critical' ? styles.sampleCritical : styles.sampleWarning
  return (
    <div className={`${styles.overviewSample} ${cls}`}>
      <div className={styles.overviewSampleHead}>{title}</div>
      <ul className={styles.overviewSampleList}>
        {items.map(i => (<li key={i.id}>{i.full_name}</li>))}
      </ul>
    </div>
  )
}

// ── Setup (wizard-based edit + delete controls) ──────────────────────────────

function SetupTab({ comp, onChanged }: { comp: Competition; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)

  async function remove() {
    if (!confirm(`Delete “${comp.name}” and all its data? This cannot be undone.`)) return
    await deleteCompetition(comp.id)
    onChanged()
  }

  if (editing) {
    return <CompetitionWizard
      initial={comp}
      onCancel={() => setEditing(false)}
      onSaved={() => { setEditing(false); onChanged() }}
    />
  }

  return (
    <div>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Setup summary</h2>
        <div className={styles.detailRow}><span>Status</span><strong>{COMPETITION_STATUS_LABELS[comp.status]}</strong></div>
        <div className={styles.detailRow}><span>Visibility</span><strong>{comp.visibility === 'admin' ? 'Admin only' : 'Released'}</strong></div>
        <div className={styles.detailRow}><span>Site</span><strong>{comp.location_site ?? '—'}</strong></div>
        <div className={styles.detailRow}><span>Date</span><strong>{comp.competition_date}</strong></div>
        <div className={styles.detailRow}><span>Backup date</span><strong>{comp.backup_date ?? '—'}</strong></div>
        <div className={styles.detailRow}><span>Start → Finish</span><strong>{comp.start_time ?? '—'} → {comp.finish_time ?? '—'}</strong></div>
        <div className={styles.detailRow}><span>Sign-in deadline</span><strong>{comp.sign_in_deadline ?? '—'}</strong></div>
        <div className={styles.detailRow}><span>Weigh-in start</span><strong>{comp.weigh_in_start ?? '—'}</strong></div>
        <div className={styles.detailRow}><span>Overdue grace</span><strong>{comp.overdue_grace_minutes} min</strong></div>
        <div className={styles.detailRow}><span>Target species</span><strong>{(comp.target_species ?? []).length}</strong></div>
        {comp.boundaries_notes && <p className={styles.notes}>{comp.boundaries_notes}</p>}
        <div className={styles.formActions}>
          <button className={styles.btnDanger} onClick={remove}>Delete</button>
          <button className={styles.btnPrimary} onClick={() => setEditing(true)}>Edit in wizard</button>
        </div>
      </div>

      <NotificationPanel comp={comp} />
    </div>
  )
}

// ── Competition wizard ───────────────────────────────────────────────────────
//
// A 7-step guided flow for creating or editing a competition. Each step covers
// one logical group of fields and can be reached directly via the step nav so
// an organiser can jump straight to what they need to change.

const EMPTY_COMP: CompetitionInput = {
  name: '', competition_date: '', backup_date: '', location_site: '',
  location_lat: null, location_lon: null,
  boundaries_notes: '', start_time: '', finish_time: '', sign_in_deadline: '',
  weigh_in_start: '', status: 'draft', visibility: 'admin',
  overdue_grace_minutes: 30, alert_slack_enabled: true, alert_email_enabled: true,
  alert_emails: '',
  organiser_name: '', organiser_phone: '', organiser_email: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  additional_rules: '', entry_fee: '', prize_info: '',
  meeting_point_name: '', meeting_point_lat: null, meeting_point_lon: null,
  meeting_point_notes: '', health_safety_notes: '',
  target_species: [], schedule: [], results_locked: false,
}

type WizardStep =
  | 'basics' | 'timings' | 'rules' | 'species' | 'safety' | 'registration' | 'review'

const WIZARD_STEPS: [WizardStep, string, string][] = [
  ['basics', 'Basics', 'Name, site and location'],
  ['timings', 'Timings', 'Start, finish, sign-in, weigh-in'],
  ['rules', 'Rules', 'Prizes, fees and additional rules'],
  ['species', 'Target species', 'Minimum length rules'],
  ['safety', 'Safety alerts', 'Overdue thresholds & channels'],
  ['registration', 'Registration form', 'Meeting point & briefing'],
  ['review', 'Public info / PDF', 'Preview and save'],
]

function draftFromCompetition(initial?: Competition): CompetitionInput {
  if (!initial) return { ...EMPTY_COMP }
  return {
    name: initial.name,
    competition_date: initial.competition_date,
    backup_date: initial.backup_date ?? '',
    location_site: initial.location_site ?? '',
    location_lat: initial.location_lat,
    location_lon: initial.location_lon,
    boundaries_notes: initial.boundaries_notes ?? '',
    start_time: initial.start_time ?? '',
    finish_time: initial.finish_time ?? '',
    sign_in_deadline: initial.sign_in_deadline ?? '',
    weigh_in_start: initial.weigh_in_start ?? '',
    status: initial.status,
    visibility: initial.visibility,
    overdue_grace_minutes: initial.overdue_grace_minutes,
    alert_slack_enabled: initial.alert_slack_enabled,
    alert_email_enabled: initial.alert_email_enabled,
    alert_emails: initial.alert_emails ?? '',
    organiser_name: initial.organiser_name ?? '',
    organiser_phone: initial.organiser_phone ?? '',
    organiser_email: initial.organiser_email ?? '',
    emergency_contact_name: initial.emergency_contact_name ?? '',
    emergency_contact_phone: initial.emergency_contact_phone ?? '',
    additional_rules: initial.additional_rules ?? '',
    entry_fee: initial.entry_fee ?? '',
    prize_info: initial.prize_info ?? '',
    meeting_point_name: initial.meeting_point_name ?? '',
    meeting_point_lat: initial.meeting_point_lat,
    meeting_point_lon: initial.meeting_point_lon,
    meeting_point_notes: initial.meeting_point_notes ?? '',
    health_safety_notes: initial.health_safety_notes ?? '',
    target_species: initial.target_species ?? [],
    schedule: initial.schedule ?? [],
    results_locked: initial.results_locked,
  }
}

function CompetitionWizard({
  initial, onCancel, onSaved,
}: {
  initial?: Competition
  onCancel: () => void
  onSaved: (c: Competition) => void
}) {
  const [draft, setDraft] = useState<CompetitionInput>(draftFromCompetition(initial))
  const [step, setStep] = useState<WizardStep>('basics')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof CompetitionInput>(key: K, value: CompetitionInput[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  async function save() {
    if (!draft.name.trim() || !draft.competition_date) {
      setErr('Name and date are required.')
      setStep('basics')
      return
    }
    setSaving(true)
    setErr('')
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
      alert_emails: (draft.alert_emails ?? '').trim() || null,
      organiser_name: (draft.organiser_name ?? '').trim() || null,
      organiser_phone: (draft.organiser_phone ?? '').trim() || null,
      organiser_email: (draft.organiser_email ?? '').trim() || null,
      emergency_contact_name: (draft.emergency_contact_name ?? '').trim() || null,
      emergency_contact_phone: (draft.emergency_contact_phone ?? '').trim() || null,
      additional_rules: (draft.additional_rules ?? '').trim() || null,
      entry_fee: (draft.entry_fee ?? '').trim() || null,
      prize_info: (draft.prize_info ?? '').trim() || null,
      meeting_point_name: (draft.meeting_point_name ?? '').trim() || null,
      meeting_point_notes: (draft.meeting_point_notes ?? '').trim() || null,
      health_safety_notes: (draft.health_safety_notes ?? '').trim() || null,
      target_species: draft.target_species ?? [],
      schedule: (draft.schedule ?? [])
        .map(s => ({
          time: (s.time ?? '').trim(),
          title: (s.title ?? '').trim(),
          detail: (s.detail ?? '').trim() || null,
        }))
        .filter(s => s.time || s.title),
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

  const stepIndex = WIZARD_STEPS.findIndex(([k]) => k === step)
  const isFirst = stepIndex === 0
  const isLast = stepIndex === WIZARD_STEPS.length - 1

  return (
    <div className={styles.card}>
      <div className={styles.wizardHead}>
        <h2 className={styles.cardTitle}>{initial ? 'Edit competition' : 'New competition'}</h2>
        <span className={styles.wizardStepIndicator}>Step {stepIndex + 1} of {WIZARD_STEPS.length}</span>
      </div>

      <nav className={styles.wizardNav} aria-label="Wizard sections">
        {WIZARD_STEPS.map(([k, label], i) => (
          <button
            key={k}
            className={step === k ? styles.wizardTabActive : styles.wizardTab}
            aria-pressed={step === k}
            onClick={() => setStep(k)}
          >
            <span className={styles.wizardTabIndex}>{i + 1}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {err && <p className={styles.error} role="alert">{err}</p>}

      {step === 'basics' && <WizardStepBasics draft={draft} set={set} />}
      {step === 'timings' && <WizardStepTimings draft={draft} set={set} />}
      {step === 'rules' && <WizardStepRules draft={draft} set={set} />}
      {step === 'species' && <WizardStepSpecies draft={draft} set={set} />}
      {step === 'safety' && <WizardStepSafety draft={draft} set={set} />}
      {step === 'registration' && <WizardStepRegistration draft={draft} set={set} setDraft={setDraft} />}
      {step === 'review' && <WizardStepReview draft={draft} />}

      <div className={styles.formActions}>
        <button className={styles.btnGhost} onClick={onCancel} disabled={saving}>Cancel</button>
        {!isFirst && (
          <button className={styles.btnGhost} onClick={() => setStep(WIZARD_STEPS[stepIndex - 1][0])}
                  disabled={saving}>‹ Back</button>
        )}
        {!isLast ? (
          <button className={styles.btnPrimary}
                  onClick={() => setStep(WIZARD_STEPS[stepIndex + 1][0])}
                  disabled={saving}>Next ›</button>
        ) : (
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create competition'}
          </button>
        )}
      </div>
    </div>
  )
}

type WizardStepProps = {
  draft: CompetitionInput
  set: <K extends keyof CompetitionInput>(key: K, value: CompetitionInput[K]) => void
}

function WizardStepBasics({ draft, set }: WizardStepProps) {
  return (
    <div>
      <p className={styles.muted}>Give the competition a name and pin its dive area.</p>
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Name</span>
          <input className={styles.input} value={draft.name} maxLength={200}
                 placeholder="e.g. North East Spearos – Seaton Sluice Competition 2026"
                 onChange={e => set('name', e.target.value)} /></label>
        <label className={styles.field}><span>Location / site</span>
          <input className={styles.input} value={draft.location_site ?? ''} maxLength={200}
                 placeholder="e.g. Seaton Sluice"
                 onChange={e => set('location_site', e.target.value)} /></label>
        <label className={styles.field}><span>Date</span>
          <input className={styles.input} type="date" value={draft.competition_date}
                 onChange={e => set('competition_date', e.target.value)} /></label>
        <label className={styles.field}><span>Backup date</span>
          <input className={styles.input} type="date" value={draft.backup_date ?? ''}
                 onChange={e => set('backup_date', e.target.value)} /></label>
        <label className={styles.field}><span>Status</span>
          <select className={styles.input} value={draft.status}
                  onChange={e => set('status', e.target.value as CompetitionStatus)}>
            {Object.entries(COMPETITION_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select></label>
        <label className={styles.field}><span>Visibility</span>
          <select className={styles.input} value={draft.visibility}
                  onChange={e => set('visibility', e.target.value as 'admin' | 'released')}>
            <option value="admin">Admin only (default)</option>
            <option value="released">Released / public</option>
          </select></label>
      </div>
      <div className={`${styles.field} ${styles.fieldFull}`}>
        <span>Competition dive area (pin)</span>
        <CompetitionLocationPicker
          accent="cyan"
          label="Competition dive area"
          value={{ lat: draft.location_lat ?? null, lon: draft.location_lon ?? null, name: draft.location_site ?? null }}
          onChange={(p: PickedPoint | null) => {
            set('location_lat', p?.lat ?? null)
            set('location_lon', p?.lon ?? null)
            if (p?.name) set('location_site', p.name)
          }}
        />
      </div>
      <label className={`${styles.field} ${styles.fieldFull}`}>
        <span>Boundaries / area notes</span>
        <textarea className={styles.textarea} rows={3} value={draft.boundaries_notes ?? ''}
                  placeholder="Any out-of-bounds zones, hazards, boat lanes…"
                  onChange={e => set('boundaries_notes', e.target.value)} />
      </label>
    </div>
  )
}

function WizardStepTimings({ draft, set }: WizardStepProps) {
  return (
    <div>
      <p className={styles.muted}>Set start, finish, sign-in deadline, and weigh-in start times.</p>
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Start time</span>
          <input className={styles.input} type="time" value={draft.start_time ?? ''}
                 onChange={e => set('start_time', e.target.value)} /></label>
        <label className={styles.field}><span>Finish time</span>
          <input className={styles.input} type="time" value={draft.finish_time ?? ''}
                 onChange={e => set('finish_time', e.target.value)} /></label>
        <label className={styles.field}><span>Sign-in deadline</span>
          <input className={styles.input} type="time" value={draft.sign_in_deadline ?? ''}
                 onChange={e => set('sign_in_deadline', e.target.value)} /></label>
        <label className={styles.field}><span>Weigh-in start</span>
          <input className={styles.input} type="time" value={draft.weigh_in_start ?? ''}
                 onChange={e => set('weigh_in_start', e.target.value)} /></label>
      </div>
      <h3 className={styles.sectionHeading}>Schedule / itinerary</h3>
      <div className={`${styles.field} ${styles.fieldFull}`}>
        <ScheduleEditor
          value={draft.schedule ?? []}
          onChange={v => set('schedule', v)}
        />
      </div>
    </div>
  )
}

function WizardStepRules({ draft, set }: WizardStepProps) {
  return (
    <div>
      <p className={styles.muted}>Entry fee, prizes and any rules beyond the standard boundaries.</p>
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Entry fee</span>
          <input className={styles.input} value={draft.entry_fee ?? ''} maxLength={200}
                 placeholder="e.g. £20 per person"
                 onChange={e => set('entry_fee', e.target.value)} /></label>
      </div>
      <label className={`${styles.field} ${styles.fieldFull}`}>
        <span>Prize information</span>
        <textarea className={styles.textarea} rows={3} value={draft.prize_info ?? ''}
                  placeholder="e.g. 1st – £100 + trophy, 2nd – £50, Biggest fish – £25"
                  onChange={e => set('prize_info', e.target.value)} />
      </label>
      <label className={`${styles.field} ${styles.fieldFull}`}>
        <span>Additional rules / notes</span>
        <textarea className={styles.textarea} rows={4} value={draft.additional_rules ?? ''}
                  placeholder="Bag limits, prohibited species, minimum sizes not covered by target species…"
                  onChange={e => set('additional_rules', e.target.value)} />
      </label>
    </div>
  )
}

function WizardStepSpecies({ draft, set }: WizardStepProps) {
  return (
    <div>
      <p className={styles.muted}>
        Set a legal minimum <strong>length</strong> for each target species (spearfishing
        rules are almost always length-based). Undersize catches can be
        automatically disqualified at weigh-in.
      </p>
      <TargetSpeciesEditor
        value={draft.target_species ?? []}
        onChange={v => set('target_species', v)}
      />
    </div>
  )
}

function WizardStepSafety({ draft, set }: WizardStepProps) {
  return (
    <div>
      <p className={styles.muted}>
        Overdue safety alerting: how long after the sign-in deadline before a
        still-in-water diver escalates, and which channels get paged.
      </p>
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Overdue alert after (min past deadline)</span>
          <input className={styles.input} type="number" min={0} max={600}
                 value={draft.overdue_grace_minutes ?? 30}
                 onChange={e => set('overdue_grace_minutes', Number(e.target.value))} /></label>
        <label className={styles.field}><span>Extra alert emails (comma-separated)</span>
          <input className={styles.input} value={draft.alert_emails ?? ''} maxLength={2000}
                 placeholder="safety@club.org, organiser@club.org"
                 onChange={e => set('alert_emails', e.target.value)} /></label>
      </div>
      <div className={styles.checkRow}>
        <label className={styles.checkInline}>
          <input type="checkbox" checked={draft.alert_slack_enabled ?? true}
                 onChange={e => set('alert_slack_enabled', e.target.checked)} />
          <span>Send overdue alerts to Slack</span>
        </label>
        <label className={styles.checkInline}>
          <input type="checkbox" checked={draft.alert_email_enabled ?? true}
                 onChange={e => set('alert_email_enabled', e.target.checked)} />
          <span>Send overdue alerts by email</span>
        </label>
      </div>
      <p className={styles.muted}>
        Safety-critical thresholds must be signed off before every event — you can
        test channels once the competition is saved from the Setup tab.
      </p>
    </div>
  )
}

function WizardStepRegistration({
  draft, set, setDraft,
}: WizardStepProps & { setDraft: React.Dispatch<React.SetStateAction<CompetitionInput>> }) {
  return (
    <div>
      <p className={styles.muted}>
        Registration-form details: where to meet, emergency contact, organiser
        contact, and the health &amp; safety briefing shown to every diver.
      </p>
      <label className={styles.field}>
        <span>Meeting point name</span>
        <input className={styles.input} value={draft.meeting_point_name ?? ''} maxLength={200}
               placeholder="e.g. Kings Arms car park, Seaton Sluice"
               onChange={e => set('meeting_point_name', e.target.value)} />
      </label>
      <div className={`${styles.field} ${styles.fieldFull}`}>
        <CompetitionLocationPicker
          accent="red"
          label="Meeting point (where to meet)"
          value={{ lat: draft.meeting_point_lat ?? null, lon: draft.meeting_point_lon ?? null, name: draft.meeting_point_name ?? null }}
          onChange={(p: PickedPoint | null) => setDraft(d => ({
            ...d,
            meeting_point_lat: p?.lat ?? null,
            meeting_point_lon: p?.lon ?? null,
            meeting_point_name: p?.name ? p.name : d.meeting_point_name,
          }))}
        />
      </div>
      <label className={`${styles.field} ${styles.fieldFull}`}>
        <span>Meeting point notes / directions</span>
        <textarea className={styles.textarea} rows={2} value={draft.meeting_point_notes ?? ''}
                  placeholder="e.g. Clifftop, down the left side of the pub, past the car park."
                  onChange={e => set('meeting_point_notes', e.target.value)} />
      </label>

      <h3 className={styles.sectionHeading}>Organiser &amp; emergency contact</h3>
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Organiser name</span>
          <input className={styles.input} value={draft.organiser_name ?? ''} maxLength={200}
                 onChange={e => set('organiser_name', e.target.value)} /></label>
        <label className={styles.field}><span>Organiser phone</span>
          <input className={styles.input} value={draft.organiser_phone ?? ''} maxLength={40}
                 onChange={e => set('organiser_phone', e.target.value)} /></label>
        <label className={styles.field}><span>Organiser email</span>
          <input className={styles.input} type="email" value={draft.organiser_email ?? ''} maxLength={200}
                 onChange={e => set('organiser_email', e.target.value)} /></label>
        <label className={styles.field}><span>Emergency contact name</span>
          <input className={styles.input} value={draft.emergency_contact_name ?? ''} maxLength={200}
                 onChange={e => set('emergency_contact_name', e.target.value)} /></label>
        <label className={styles.field}><span>Emergency contact phone</span>
          <input className={styles.input} value={draft.emergency_contact_phone ?? ''} maxLength={40}
                 onChange={e => set('emergency_contact_phone', e.target.value)} /></label>
      </div>

      <h3 className={styles.sectionHeading}>Health &amp; safety briefing</h3>
      <label className={`${styles.field} ${styles.fieldFull}`}>
        <span>
          Safety briefing notes
          {!(draft.health_safety_notes ?? '').trim() && (
            <button type="button" className={styles.linkBtn} style={{ marginLeft: 8 }}
                    onClick={() => set('health_safety_notes', STANDARD_HEALTH_SAFETY)}>
              Load standard briefing
            </button>
          )}
        </span>
        <textarea className={styles.textarea} rows={6} value={draft.health_safety_notes ?? ''}
                  placeholder={'One rule per line — each line shows as a bullet point.'}
                  onChange={e => set('health_safety_notes', e.target.value)} />
        <span className={styles.fieldHint}>One rule per line — each line becomes a bullet on the brief and the public page.</span>
      </label>
    </div>
  )
}

function WizardStepReview({ draft }: { draft: CompetitionInput }) {
  const missing: string[] = []
  if (!draft.name.trim()) missing.push('Name')
  if (!draft.competition_date) missing.push('Date')
  if (!draft.start_time) missing.push('Start time')
  if (!draft.finish_time) missing.push('Finish time')
  if (!draft.sign_in_deadline) missing.push('Sign-in deadline')
  if (!draft.meeting_point_name) missing.push('Meeting point')
  if (!draft.emergency_contact_phone) missing.push('Emergency contact phone')
  if ((draft.target_species ?? []).length === 0) missing.push('Target species')

  return (
    <div>
      <p className={styles.muted}>
        Review the public information sheet that competitors will see. Save when
        the summary looks right — you can keep editing after.
      </p>
      {missing.length > 0 && (
        <div className={styles.warningBanner}>
          Missing information: {missing.join(', ')}. The PDF will still generate but
          items above are recommended for a shore-diving event.
        </div>
      )}
      <div className={styles.card}>
        <div className={styles.detailRow}><span>Name</span><strong>{draft.name || '—'}</strong></div>
        <div className={styles.detailRow}><span>Date</span><strong>{draft.competition_date || '—'}</strong></div>
        <div className={styles.detailRow}><span>Site</span><strong>{draft.location_site || '—'}</strong></div>
        <div className={styles.detailRow}><span>Start → Finish</span><strong>{(draft.start_time || '—')} → {(draft.finish_time || '—')}</strong></div>
        <div className={styles.detailRow}><span>Sign-in deadline</span><strong>{draft.sign_in_deadline || '—'}</strong></div>
        <div className={styles.detailRow}><span>Weigh-in start</span><strong>{draft.weigh_in_start || '—'}</strong></div>
        <div className={styles.detailRow}><span>Meeting point</span><strong>{draft.meeting_point_name || '—'}</strong></div>
        <div className={styles.detailRow}><span>Emergency phone</span><strong>{draft.emergency_contact_phone || '—'}</strong></div>
        <div className={styles.detailRow}><span>Target species</span><strong>{(draft.target_species ?? []).length}</strong></div>
        <div className={styles.detailRow}><span>Schedule entries</span><strong>{(draft.schedule ?? []).length}</strong></div>
      </div>
    </div>
  )
}

// ── Overdue safety notifications ─────────────────────────────────────────────

function NotificationPanel({ comp }: { comp: Competition }) {
  const [status, setStatus] = useState<NotificationStatus | null>(null)
  const [result, setResult] = useState<TestAlertResult | null>(null)
  const [busy, setBusy] = useState<'slack' | 'email' | 'both' | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    getNotificationStatus().then(setStatus).catch(() => setStatus(null))
  }, [])

  async function test(channel: 'slack' | 'email' | 'both') {
    setBusy(channel); setErr(''); setResult(null)
    try {
      setResult(await sendTestAlert(comp.id, channel))
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const slackOn = comp.alert_slack_enabled
  const emailOn = comp.alert_email_enabled
  const slackReady = slackOn && status?.slack_configured
  const emailReady = emailOn && status?.email_configured

  return (
    <div className={styles.card} style={{ marginTop: 'var(--space-md)' }}>
      <h3 className={styles.cardTitle}>Safety alerts</h3>
      <p className={styles.notes}>
        If a diver is still in the water {comp.overdue_grace_minutes} min past the sign-in
        deadline, organisers are paged automatically{status ? `, then re-paged every ${status.realert_minutes} min while they stay overdue` : ''}.
      </p>
      <div className={styles.detailRow}>
        <span>Slack</span>
        <strong>{!slackOn ? 'Off for this event' : status?.slack_configured ? 'Ready' : 'Enabled — not configured on server'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Email</span>
        <strong>{!emailOn ? 'Off for this event' : status?.email_configured ? 'Ready' : 'Enabled — SMTP not configured on server'}</strong>
      </div>
      {comp.alert_emails && (
        <div className={styles.detailRow}><span>Extra recipients</span><strong>{comp.alert_emails}</strong></div>
      )}
      {!slackReady && !emailReady && (
        <p className={styles.warnText}>
          No alert channel is deliverable right now — overdue divers will still be flagged
          on the board, but no Slack/email will be sent.
        </p>
      )}
      {err && <p className={styles.error} role="alert">{err}</p>}
      {result && (
        <p className={result.slack.sent || result.email.sent ? styles.notes : styles.warnText}>
          Test sent — Slack: {channelWord(result.slack)} · Email: {channelWord(result.email)}
          {result.email.sent && result.email.recipients.length > 0
            ? ` (${result.email.recipients.join(', ')})` : ''}
        </p>
      )}
      <div className={styles.formActions}>
        <button className={styles.btnGhost}
                onClick={() => test('slack')}
                disabled={busy !== null || !slackReady}>
          {busy === 'slack' ? 'Sending…' : 'Test Slack'}
        </button>
        <button className={styles.btnGhost}
                onClick={() => test('email')}
                disabled={busy !== null || !emailReady}>
          {busy === 'email' ? 'Sending…' : 'Test email'}
        </button>
        <button className={styles.btnGhost}
                onClick={() => test('both')}
                disabled={busy !== null || (!slackReady && !emailReady)}>
          {busy === 'both' ? 'Sending…' : 'Test both'}
        </button>
      </div>
    </div>
  )
}

function channelWord(c: { enabled: boolean; configured: boolean; sent: boolean }): string {
  if (c.sent) return 'sent ✓'
  if (!c.enabled) return 'off'
  if (!c.configured) return 'not configured'
  return 'failed'
}

// ── Water status board ───────────────────────────────────────────────────────

const BOARD_FILTERS: { key: CompetitorStatus | 'all' | 'overdue'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_water', label: 'In water' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'returned', label: 'Returned' },
  { key: 'not_arrived', label: 'Not arrived' },
  { key: 'registered', label: 'Registered' },
]

function BoardTab({ cid, onOpenIncident }: { cid: number; onOpenIncident: () => void }) {
  const [board, setBoard] = useState<WaterStatusBoard | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<CompetitorStatus | 'all' | 'overdue'>('all')
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    getBoard(cid).then(setBoard).catch(e => setError(errMsg(e)))
  }, [cid])

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

  async function logIncidentFor(c: Competitor) {
    // Prefill an incident for this competitor via a tiny prompt flow; the full
    // form lives on the Incidents tab and the caller can jump straight there.
    const notes = prompt(`Log an incident for ${c.full_name}?\n\nType a short note:`)?.trim()
    if (!notes) return
    try {
      await createIncident(cid, {
        incident_type: 'other',
        competitor_id: c.id,
        notes,
        severity: 'warning',
      })
      onOpenIncident()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  // Filter, then pin overdue to the top for the "all" view so a still-missing
  // diver is always the first thing an organiser sees.
  const items = useMemo(() => {
    if (!board) return []
    const arr = filter === 'all'
      ? board.items
      : filter === 'overdue'
      ? board.items.filter(i => i.is_overdue)
      : board.items.filter(i => i.status === filter)
    return [...arr].sort((a, b) => {
      if (a.is_overdue && !b.is_overdue) return -1
      if (!a.is_overdue && b.is_overdue) return 1
      // Overdue rows: worst first
      if (a.is_overdue && b.is_overdue) return b.minutes_overdue - a.minutes_overdue
      // In-water next
      if (a.status === 'in_water' && b.status !== 'in_water') return -1
      if (b.status === 'in_water' && a.status !== 'in_water') return 1
      return a.full_name.localeCompare(b.full_name)
    })
  }, [board, filter])

  if (error && !board) return <p className={styles.error} role="alert">{error}</p>
  if (!board) return <p className={styles.muted}>Loading board…</p>

  const c = board.counts
  const due = outOfWaterLabel(board.competition)
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
        <span className={styles.dueBackChip}>Everyone back by <strong>{due}</strong></span>
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
                    {c2.team_name ? c2.team_name : <span className={styles.warnText}>No buddy/team</span>}
                    {c2.float_colour ? ` · float: ${c2.float_colour}` : ''}
                    {c2.intended_dive_area ? ` · ${c2.intended_dive_area}` : ''}
                  </div>
                </div>
                <StatusBadge status={c2.status} overdue={c2.is_overdue} />
              </div>

              <div className={styles.boardTimes}>
                <span>Out: {fmtTime(c2.signed_out_at)}</span>
                <span>Due back: {due}</span>
                <span>Back: {fmtTime(c2.returned_at)}</span>
                {c2.is_overdue && <span className={styles.warnText}>+{c2.minutes_overdue} min overdue</span>}
                {c2.overdue_alerted_at && <span className={styles.badgeOverdue}>Organisers paged</span>}
              </div>

              {(c2.phone || c2.emergency_contact_name || c2.emergency_contact_phone) && (
                <div className={styles.boardEmergency}>
                  {c2.phone && (
                    <>Phone: <a className={styles.callLink} href={`tel:${c2.phone}`}>{c2.phone}</a>{' · '}</>
                  )}
                  ICE: {c2.emergency_contact_name ?? '—'}
                  {c2.emergency_contact_phone && (
                    <> <a className={styles.callLink} href={`tel:${c2.emergency_contact_phone}`}>{c2.emergency_contact_phone}</a></>
                  )}
                </div>
              )}

              <div className={styles.actionRow}>
                {c2.status === 'not_arrived' && (
                  <button className={styles.actBtn} disabled={busy === c2.id} onClick={() => act(c2, 'registered')}>
                    Mark arrived
                  </button>
                )}
                {c2.status !== 'in_water' && c2.status !== 'withdrawn' && (
                  <button className={`${styles.actBtn} ${styles.actWater}`} disabled={busy === c2.id} onClick={() => act(c2, 'in_water')}>
                    Sign out → water
                  </button>
                )}
                {c2.status === 'in_water' && (
                  <button className={`${styles.actBtn} ${styles.actReturn}`} disabled={busy === c2.id} onClick={() => act(c2, 'returned')}>
                    Mark returned
                  </button>
                )}
                {c2.phone && (
                  <a className={`${styles.actBtn} ${styles.actCall}`} href={`tel:${c2.phone}`}>Call</a>
                )}
                <button className={styles.actBtnGhost} disabled={busy === c2.id} onClick={() => logIncidentFor(c2)}>
                  Log incident
                </button>
                {c2.status !== 'withdrawn' && (
                  <button className={styles.actBtnGhost} disabled={busy === c2.id} onClick={() => act(c2, 'withdrawn')}>
                    Withdraw
                  </button>
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

// Multi-select filter chips — an organiser can layer "unpaid" + "no buddy" to
// find the exact set they need to chase before the briefing.
type CompetitorFilterKey =
  | 'unpaid' | 'waiver_missing' | 'no_buddy'
  | 'in_water' | 'returned' | 'withdrawn'
const COMPETITOR_FILTERS: { key: CompetitorFilterKey; label: string }[] = [
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'waiver_missing', label: 'Waiver missing' },
  { key: 'no_buddy', label: 'No buddy' },
  { key: 'in_water', label: 'In water' },
  { key: 'returned', label: 'Returned' },
  { key: 'withdrawn', label: 'Withdrawn' },
]

function CompetitorsTab({ cid }: { cid: number }) {
  const [items, setItems] = useState<Competitor[]>([])
  const [teams, setTeams] = useState<CompetitionTeam[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Set<CompetitorFilterKey>>(new Set())
  const [editing, setEditing] = useState<Competitor | 'new' | null>(null)
  const [importing, setImporting] = useState(false)

  const load = useCallback(() => {
    Promise.all([
      listCompetitors(cid, { q: search || undefined }),
      listTeams(cid),
    ])
      .then(([c, t]) => { setItems(c); setTeams(t) })
      .catch(e => setError(errMsg(e)))
  }, [cid, search])

  useEffect(() => { load() }, [load])

  function toggleFilter(k: CompetitorFilterKey) {
    setFilters(s => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  const filtered = useMemo(() => items.filter(c => {
    if (filters.has('unpaid') && c.paid) return false
    if (filters.has('waiver_missing') && c.waiver_accepted) return false
    if (filters.has('no_buddy') && c.has_team) return false
    if (filters.has('in_water') && c.status !== 'in_water') return false
    if (filters.has('returned') && c.status !== 'returned') return false
    if (filters.has('withdrawn') && c.status !== 'withdrawn') return false
    return true
  }), [items, filters])

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

  if (importing) {
    return <CompetitorImport cid={cid}
                             onCancel={() => setImporting(false)}
                             onDone={() => { setImporting(false); load() }} />
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <input className={styles.input} placeholder="Search name / phone / float / reg"
               value={search} onChange={e => setSearch(e.target.value)} />
        <button className={styles.btnPrimary} onClick={() => setEditing('new')}>+ Add</button>
        <button className={styles.btnGhost} onClick={() => setImporting(true)}>Import CSV</button>
        <button className={styles.btnGhost} onClick={() => downloadCompetitionCsv(cid, 'competitors')}>Export CSV</button>
      </div>

      <div className={styles.filterRow} role="group" aria-label="Filter competitors">
        {COMPETITOR_FILTERS.map(f => (
          <button key={f.key} aria-pressed={filters.has(f.key)}
                  className={filters.has(f.key) ? styles.chipActive : styles.chip}
                  onClick={() => toggleFilter(f.key)}>
            {f.label}
          </button>
        ))}
        {filters.size > 0 && (
          <button className={styles.chip} onClick={() => setFilters(new Set())}>Clear</button>
        )}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {filtered.length === 0 ? (
        <p className={styles.muted}>{items.length === 0 ? 'No competitors yet.' : 'No competitors match this filter.'}</p>
      ) : (
        <ul className={styles.cardList}>
          {filtered.map(c => (
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
              <div className={styles.boardMeta}>
                {c.phone ? `Phone ${c.phone} · ` : ''}
                {c.emergency_contact_name ? `ICE ${c.emergency_contact_name}` : ''}
                {c.emergency_contact_phone ? ` ${c.emergency_contact_phone}` : ''}
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

function CompetitorImport({
  cid, onCancel, onDone,
}: { cid: number; onCancel: () => void; onDone: () => void }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<CompetitorInput[]>([])
  const [importing, setImporting] = useState(false)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState<string>('')

  function refreshPreview(csv: string) {
    setText(csv)
    setPreview(parseCompetitorsCsv(csv))
  }

  async function runImport() {
    if (preview.length === 0) {
      setErr('Paste a CSV with at least a header row and one row of competitor data.')
      return
    }
    setImporting(true); setErr(''); setStatus('')
    let ok = 0
    let failed = 0
    for (const row of preview) {
      try {
        await createCompetitor(cid, row)
        ok++
      } catch {
        failed++
      }
    }
    setImporting(false)
    setStatus(`Imported ${ok} competitor${ok === 1 ? '' : 's'}${failed ? ` · ${failed} failed` : ''}.`)
    if (failed === 0) {
      setTimeout(onDone, 400)
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Import competitors from CSV</h2>
      <p className={styles.muted}>
        Paste a CSV with a header row. Recognised columns: <code>full_name</code>,
        <code>phone</code>, <code>email</code>, <code>emergency_contact_name</code>,
        <code>emergency_contact_phone</code>, <code>vehicle_reg</code>,
        <code>float_colour</code>, <code>experience_level</code>, <code>paid</code>,
        <code>waiver_accepted</code>, <code>notes</code>. Only <code>full_name</code> is required.
      </p>
      <textarea
        className={styles.textarea}
        rows={8}
        placeholder="full_name,phone,paid,waiver_accepted&#10;Jamie Diver,07000000000,yes,yes"
        value={text}
        onChange={e => refreshPreview(e.target.value)}
      />
      {err && <p className={styles.error} role="alert">{err}</p>}
      {status && <p className={styles.notes}>{status}</p>}
      {preview.length > 0 && (
        <p className={styles.muted}>Preview: {preview.length} competitor{preview.length === 1 ? '' : 's'} ready to import.</p>
      )}
      <div className={styles.formActions}>
        <button className={styles.btnGhost} onClick={onCancel} disabled={importing}>Cancel</button>
        <button className={styles.btnPrimary} onClick={runImport} disabled={importing || preview.length === 0}>
          {importing ? 'Importing…' : `Import ${preview.length || ''} row${preview.length === 1 ? '' : 's'}`}
        </button>
      </div>
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
    if (!draft.full_name?.trim()) { setErr('Name is required.'); return }
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
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_locked ? ' 🔒' : ''}</option>)}
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
  const [locked, setLocked] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editArea, setEditArea] = useState('')
  const [editLocked, setEditLocked] = useState(false)

  const load = useCallback(() => {
    listTeams(cid).then(setTeams).catch(e => setError(errMsg(e)))
  }, [cid])
  useEffect(() => { load() }, [load])

  async function add() {
    if (!name.trim()) return
    try {
      await createTeam(cid, { name: name.trim(), intended_dive_area: area.trim() || null, is_locked: locked })
      setName(''); setArea(''); setLocked(false); load()
    } catch (e) { setError(errMsg(e)) }
  }

  async function saveEdit(id: number) {
    await updateTeam(cid, id, {
      name: editName.trim(),
      intended_dive_area: editArea.trim() || null,
      is_locked: editLocked,
    })
    setEditingId(null); load()
  }

  async function toggleLock(t: CompetitionTeam) {
    await updateTeam(cid, t.id, { is_locked: !t.is_locked })
    load()
  }

  async function remove(t: CompetitionTeam) {
    if (t.is_locked && !confirm(`Team “${t.name}” is locked. Delete anyway?`)) return
    if (!t.is_locked && !confirm(`Delete team “${t.name}”? Members will be unassigned.`)) return
    await deleteTeam(cid, t.id); load()
  }

  async function autoPair() {
    if (!confirm('Randomly pair every competitor who still has no buddy?\n\nLocked teams stay untouched, and the pairer tries to avoid two-beginner buddies where possible.')) return
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
          <label className={styles.checkInline}>
            <input type="checkbox" checked={locked} onChange={e => setLocked(e.target.checked)} /> Locked
          </label>
          <button className={styles.btnPrimary} onClick={add}>Add</button>
          <button className={styles.btnGhost} onClick={() => downloadCompetitionCsv(cid, 'teams')}>Export CSV</button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Dive-day buddy assignment</h2>
        <p className={styles.muted}>
          Randomly pairs everyone still without a buddy (solo divers and those whose
          invited buddy never registered). Locked teams stay as-is; the pairer
          interleaves beginners with more experienced divers so no pair is left
          with the least-safe combination.
        </p>
        <button className={styles.btnPrimary} onClick={autoPair}>Randomly assign buddies</button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {teams.length === 0 ? (
        <p className={styles.muted}>No teams yet.</p>
      ) : (
        <ul className={styles.cardList}>
          {teams.map(t => (
            <li key={t.id} className={t.is_locked ? `${styles.compCard} ${styles.teamLocked}` : styles.compCard}>
              {editingId === t.id ? (
                <div>
                  <div className={styles.toolbar}>
                    <input className={styles.input} value={editName} onChange={e => setEditName(e.target.value)} />
                    <input className={styles.input} value={editArea} onChange={e => setEditArea(e.target.value)} />
                    <label className={styles.checkInline}>
                      <input type="checkbox" checked={editLocked} onChange={e => setEditLocked(e.target.checked)} /> Locked
                    </label>
                    <button className={styles.btnPrimary} onClick={() => saveEdit(t.id)}>Save</button>
                    <button className={styles.btnGhost} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.compCardHead}>
                    <span className={styles.compName}>
                      {t.is_locked && <span className={styles.teamLockIcon} aria-label="Locked team">🔒 </span>}
                      {t.name}
                    </span>
                    <span className={`${styles.badge} ${t.member_count < 2 ? styles.badgeWarn : styles.badge_returned}`}>
                      {t.member_count} {t.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                  <div className={styles.boardMeta}>{t.intended_dive_area ?? 'No dive area set'}</div>
                  {t.members.length > 0 && (
                    <ul className={styles.teamRoster}>
                      {t.members.map(m => (
                        <li key={m.id}>
                          <span className={styles.rosterName}>{m.full_name}</span>
                          {m.experience_level && <span className={styles.rosterMeta}>{m.experience_level}</span>}
                          <StatusBadge status={m.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {t.member_count < 2 && <div className={styles.warnText}>Needs a buddy — fewer than 2 members</div>}
                  <div className={styles.actionRow}>
                    <button className={styles.linkBtn} onClick={() => toggleLock(t)}>
                      {t.is_locked ? 'Unlock' : 'Lock'}
                    </button>
                    <button className={styles.linkBtn}
                            onClick={() => { setEditingId(t.id); setEditName(t.name); setEditArea(t.intended_dive_area ?? ''); setEditLocked(t.is_locked) }}>Edit</button>
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

function WeighInTab({ comp }: { comp: Competition }) {
  const cid = comp.id
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
        comp={comp}
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
               value={search} onChange={e => setSearch(e.target.value)} autoFocus />
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
  comp, competitor, species, entries, onBack, onChanged, onError, error,
}: {
  comp: Competition
  competitor: Competitor
  species: string[]
  entries: FishEntry[]
  onBack: () => void
  onChanged: () => Promise<unknown>
  onError: (msg: string) => void
  error: string
}) {
  const [busy, setBusy] = useState(false)
  const speciesBySlug = useMemo(() => {
    const m = new Map<string, TargetSpecies>()
    for (const s of comp.target_species ?? []) m.set(s.species.toLowerCase(), s)
    return m
  }, [comp.target_species])

  const countFor = (sp: string) => entries.filter(f => f.species === sp && !f.disqualified).length

  async function addOne(sp: string) {
    setBusy(true); onError('')
    try {
      await createFish(comp.id, { competitor_id: competitor.id, species: sp })
      await onChanged()
    } catch (e) { onError(errMsg(e)) } finally { setBusy(false) }
  }

  async function removeOne(sp: string) {
    const candidates = entries
      .filter(f => f.species === sp && !f.disqualified)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (candidates.length === 0) return
    const target = candidates.filter(f => f.pending).pop() ?? candidates[candidates.length - 1]
    if (target.lock_result) {
      onError('Cannot remove a locked fish — unlock it first.')
      return
    }
    setBusy(true); onError('')
    try {
      await deleteFish(comp.id, target.id)
      await onChanged()
    } catch (e) { onError(errMsg(e)) } finally { setBusy(false) }
  }

  async function setField(f: FishEntry, patch: FishEntryPatch) {
    onError('')
    try { await updateFish(comp.id, f.id, patch); await onChanged() }
    catch (e) { onError(errMsg(e)) }
  }

  async function toggleDq(f: FishEntry) {
    if (f.lock_result) { onError('Cannot change DQ on a locked fish — unlock it first.'); return }
    const reason = f.disqualified ? null : (prompt('Disqualification reason?') ?? 'Disqualified')
    await setField(f, { disqualified: !f.disqualified, disqualification_reason: reason })
  }

  async function toggleLock(f: FishEntry) {
    await setField(f, { lock_result: !f.lock_result })
  }

  async function remove(f: FishEntry) {
    if (f.lock_result) { onError('Cannot delete a locked fish — unlock it first.'); return }
    if (!confirm('Delete this entry?')) return
    onError('')
    try { await deleteFish(comp.id, f.id); await onChanged() }
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
            const meta = speciesBySlug.get(sp.toLowerCase())
            return (
              <li key={sp} className={styles.tallyRow}>
                <div>
                  <span className={styles.tallySpecies}>{sp}</span>
                  {meta && meta.min_length != null && (
                    <span className={styles.tallyMeta}>min {formatSpeciesMin(meta)}</span>
                  )}
                </div>
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
        <h2 className={styles.cardTitle}>Catch details</h2>
        {sortedEntries.length === 0 ? (
          <p className={styles.muted}>No fish tallied yet. Use the steppers above.</p>
        ) : (
          <ul className={styles.cardList}>
            {sortedEntries.map(f => (
              <FishRow
                key={f.id}
                fish={f}
                speciesMeta={speciesBySlug.get(f.species.toLowerCase())}
                onField={setField}
                onToggleDq={() => toggleDq(f)}
                onToggleLock={() => toggleLock(f)}
                onDelete={() => remove(f)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// A single fish row inside a competitor's weigh-in card. Warns when the length
// is below the target species' minimum; auto-DQs when the species has
// ``auto_disqualify_undersize`` set and a length below the minimum is entered.
function FishRow({
  fish, speciesMeta, onField, onToggleDq, onToggleLock, onDelete,
}: {
  fish: FishEntry
  speciesMeta?: TargetSpecies
  onField: (f: FishEntry, patch: FishEntryPatch) => Promise<void>
  onToggleDq: () => void
  onToggleLock: () => void
  onDelete: () => void
}) {
  const min = speciesMeta?.min_length ?? null
  const unit = speciesMeta?.unit ?? 'cm'
  const undersize = min != null && fish.length_cm != null && fish.length_cm < min

  async function commitLength(v: string) {
    const trimmed = v.trim()
    const num = trimmed === '' ? null : parseFloat(trimmed)
    if (num !== null && !(num >= 0)) return
    if (num === (fish.length_cm ?? null)) return
    const patch: FishEntryPatch = { length_cm: num }
    // If this species auto-DQs undersize and the entered length is below the
    // legal minimum, flip the DQ flag as part of the same save.
    if (
      speciesMeta?.auto_disqualify_undersize
      && min != null && num != null && num < min
      && !fish.disqualified
    ) {
      patch.disqualified = true
      const unitLabel = unit === 'mm_carapace' ? 'mm carapace' : 'cm'
      patch.disqualification_reason = `Undersize (${num} ${unitLabel} < ${min} ${unitLabel})`
    }
    await onField(fish, patch)
  }

  return (
    <li className={
      [styles.compCard, fish.disqualified ? styles.dqCard : '',
       undersize && !fish.disqualified ? styles.warnCard : '',
       fish.lock_result ? styles.lockedCard : ''].filter(Boolean).join(' ')
    }>
      <div className={styles.compCardHead}>
        <span className={styles.compName}>{fish.species}</span>
        <span>
          {fish.disqualified
            ? <span className={`${styles.badge} ${styles.badgeOverdue}`}>DQ</span>
            : fish.pending && <span className={`${styles.badge} ${styles.badgeWarn}`}>To weigh</span>}
          {fish.lock_result && <span className={`${styles.badge} ${styles.badgeLocked}`}>Locked</span>}
        </span>
      </div>
      <div className={styles.weighFields}>
        <label className={styles.field}><span>Length ({unit === 'mm_carapace' ? 'mm carapace' : 'cm'})</span>
          <input className={styles.input} type="number" inputMode="decimal"
                 disabled={fish.lock_result}
                 defaultValue={fish.length_cm ?? ''}
                 key={`l-${fish.id}-${fish.length_cm ?? ''}`}
                 onBlur={e => commitLength(e.target.value)} />
        </label>
        <label className={styles.field}><span>Weight (g)</span>
          <input className={styles.input} type="number" inputMode="decimal"
                 disabled={fish.lock_result}
                 defaultValue={fish.weight_grams ?? ''}
                 key={`w-${fish.id}-${fish.weight_grams ?? ''}`}
                 onBlur={e => {
                   const v = e.target.value.trim()
                   const num = v === '' ? null : parseFloat(v)
                   if (num !== null && !(num > 0)) return
                   if (num !== (fish.weight_grams ?? null)) onField(fish, { weight_grams: num })
                 }} />
        </label>
      </div>
      {undersize && !fish.disqualified && (
        <div className={styles.warnText}>
          Undersize: {fish.length_cm} {unit === 'mm_carapace' ? 'mm carapace' : 'cm'} is below the {min} {unit === 'mm_carapace' ? 'mm carapace' : 'cm'} minimum.
          {speciesMeta?.auto_disqualify_undersize
            ? ' Will auto-DQ on save.'
            : ' Consider disqualifying.'}
        </div>
      )}
      {fish.disqualified && fish.disqualification_reason && (
        <div className={styles.warnText}>DQ: {fish.disqualification_reason}</div>
      )}
      <div className={styles.actionRow}>
        <button className={styles.linkBtn} onClick={onToggleDq}>
          {fish.disqualified ? 'Reinstate' : 'Disqualify'}
        </button>
        <button className={styles.linkBtn} onClick={onToggleLock}>
          {fish.lock_result ? 'Unlock result' : 'Lock result'}
        </button>
        <button className={styles.linkBtnDanger} onClick={onDelete}>Delete</button>
      </div>
    </li>
  )
}

// ── Results tab ──────────────────────────────────────────────────────────────

// Scoring editor: four dimensions (weight, length, per-fish flat, per-species
// bonus) that combine additively, plus the team-scoring toggle. Each numeric
// input commits on blur; the species-bonus editor commits on Add / Remove.
type NumericScoringField = 'points_per_gram' | 'points_per_cm' | 'points_per_fish'

function ScoringCard({
  rule,
  onSave,
}: {
  rule: ScoringRule
  onSave: (patch: Partial<ScoringRule>) => void | Promise<void>
}) {
  const [bonusSpecies, setBonusSpecies] = useState('')
  const [bonusPoints, setBonusPoints] = useState('')

  const bonusEntries = Object.entries(rule.species_bonus || {}).sort(
    (a, b) => a[0].localeCompare(b[0]),
  )

  function commitNumeric(field: NumericScoringField, raw: string) {
    const n = parseFloat(raw)
    const val = Number.isFinite(n) && n >= 0 ? n : 0
    // Fire-and-forget: onSave surfaces its own errors via the parent's
    // try/catch. void keeps this from becoming an unhandled rejection.
    if (val !== rule[field]) void onSave({ [field]: val })
  }

  function addBonus() {
    const s = bonusSpecies.trim()
    const pts = parseFloat(bonusPoints)
    if (!s || !Number.isFinite(pts)) return
    void onSave({ species_bonus: { ...(rule.species_bonus || {}), [s]: pts } })
    setBonusSpecies(''); setBonusPoints('')
  }

  function removeBonus(species: string) {
    const next = { ...(rule.species_bonus || {}) }
    delete next[species]
    void onSave({ species_bonus: next })
  }

  // Re-mount the numeric inputs whenever the rule is refreshed so the
  // displayed value tracks the server-side rule (e.g. after a save that
  // clamped or normalised the value). Uncontrolled inputs would otherwise
  // hold onto the last typed value.
  const inputKey = rule.updated_at
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Scoring</h2>
      <p className={styles.muted} style={{ margin: 0, fontSize: 12 }}>
        Each fish's score is the sum of every dimension you enable. Set a
        dimension to 0 to ignore it.
      </p>
      <div className={styles.formGrid}>
        <label className={styles.field}><span>Points per gram (weight)</span>
          <input key={`ppg-${inputKey}`} className={styles.input} type="number" inputMode="decimal" min={0} step="any"
                 defaultValue={rule.points_per_gram}
                 onBlur={e => commitNumeric('points_per_gram', e.target.value)} />
        </label>
        <label className={styles.field}><span>Points per cm (length)</span>
          <input key={`ppc-${inputKey}`} className={styles.input} type="number" inputMode="decimal" min={0} step="any"
                 defaultValue={rule.points_per_cm}
                 onBlur={e => commitNumeric('points_per_cm', e.target.value)} />
        </label>
        <label className={styles.field}><span>Points per fish (flat)</span>
          <input key={`ppf-${inputKey}`} className={styles.input} type="number" inputMode="decimal" min={0} step="any"
                 defaultValue={rule.points_per_fish}
                 onBlur={e => commitNumeric('points_per_fish', e.target.value)} />
        </label>
        <label className={styles.checkInline} style={{ alignSelf: 'end' }}>
          <input type="checkbox" checked={rule.use_team_scoring}
                 onChange={e => void onSave({ use_team_scoring: e.target.checked })} /> Team scoring
        </label>
      </div>

      <div>
        <h3 className={styles.cardTitle} style={{ fontSize: 14, marginTop: 8 }}>
          Species bonus (flat points per fish landed)
        </h3>
        {bonusEntries.length === 0 ? (
          <p className={styles.muted} style={{ margin: '4px 0 8px', fontSize: 12 }}>
            No species bonuses yet.
          </p>
        ) : (
          <ul className={styles.cardList} style={{ marginBottom: 8 }}>
            {bonusEntries.map(([species, pts]) => (
              <li key={species} className={styles.leaderRow}>
                <span className={styles.leaderName}>{species}</span>
                <span className={styles.leaderPts}>+{pts} pts</span>
                <button className={styles.linkBtnDanger} onClick={() => removeBonus(species)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.toolbar}>
          <label className={styles.field}><span>Species</span>
            <input className={styles.input} value={bonusSpecies}
                   placeholder="e.g. Bass"
                   onChange={e => setBonusSpecies(e.target.value)} />
          </label>
          <label className={styles.field}><span>Bonus points</span>
            <input className={styles.input} type="number" inputMode="decimal" step="any"
                   value={bonusPoints}
                   placeholder="e.g. 100"
                   onChange={e => setBonusPoints(e.target.value)} />
          </label>
          <button className={styles.btnGhost} onClick={addBonus}
                  disabled={!bonusSpecies.trim() || !Number.isFinite(parseFloat(bonusPoints))}>
            Add species bonus
          </button>
        </div>
      </div>
    </div>
  )
}

function ResultsTab({ comp, onChanged }: { comp: Competition; onChanged: () => void }) {
  const cid = comp.id
  const [results, setResults] = useState<CompetitionResults | null>(null)
  const [rule, setRule] = useState<ScoringRule | null>(null)
  const [error, setError] = useState('')
  const [locking, setLocking] = useState(false)

  const load = useCallback(() => {
    Promise.all([getResults(cid), getScoringRule(cid)])
      .then(([r, sr]) => { setResults(r); setRule(sr) })
      .catch(e => setError(errMsg(e)))
  }, [cid])
  useEffect(() => { load() }, [load])

  async function saveRule(patch: Partial<ScoringRule>) {
    setError('')
    try {
      const next = await updateScoringRule(cid, patch)
      setRule(next)
      // Refresh results (leaderboard) with the new rule applied.
      const fresh = await getResults(cid)
      setResults(fresh)
    } catch (e) {
      setError(errMsg(e))
    }
  }

  async function toggleLock() {
    setLocking(true)
    setError('')
    try {
      if (comp.results_locked) await unlockResults(cid)
      else await lockResults(cid)
      onChanged()
      load()
    } catch (e) { setError(errMsg(e)) }
    finally { setLocking(false) }
  }

  async function shareLink() {
    const url = `${window.location.origin}/competition/${cid}/results`
    try {
      await navigator.clipboard.writeText(url)
      alert(`Public results link copied:\n${url}`)
    } catch {
      prompt('Copy the public results link:', url)
    }
  }

  if (error && !results) return <p className={styles.error} role="alert">{error}</p>
  if (!results || !rule) return <p className={styles.muted}>Loading results…</p>

  const t = results.totals
  const isPublic = comp.visibility === 'released'
  return (
    <div>
      <div className={styles.resultsHead}>
        <span className={comp.results_locked ? styles.badgeLocked : styles.badgeWarn}>
          {comp.results_locked ? 'Final · locked' : 'Provisional · live'}
        </span>
        <div className={styles.formActions}>
          <button className={styles.btnGhost} onClick={() => downloadCompetitionCsv(cid, 'results')}>Export CSV</button>
          <button className={styles.btnGhost} onClick={shareLink} disabled={!isPublic}
                  title={!isPublic ? 'Set visibility to Released to enable the public share link' : undefined}>
            Copy public link
          </button>
          <button className={styles.btnPrimary} onClick={toggleLock} disabled={locking}>
            {comp.results_locked ? 'Unlock results' : 'Lock as final'}
          </button>
        </div>
      </div>

      <div className={styles.countBar}>
        <div className={styles.count}><strong>{t.total_fish}</strong><span>Fish</span></div>
        <div className={styles.count}><strong>{t.total_weight_kg}</strong><span>Total kg</span></div>
        {t.pending_fish > 0 && (
          <div className={`${styles.count} ${styles.countWarn}`}><strong>{t.pending_fish}</strong><span>To weigh</span></div>
        )}
        <div className={styles.count}><strong>{t.disqualified}</strong><span>DQ</span></div>
        <div className={styles.count}><strong>{t.competitors}</strong><span>Competitors</span></div>
      </div>

      <ScoringCard rule={rule} onSave={saveRule} />

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
          <h2 className={styles.sectionTitle}>Species winners</h2>
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
  const [showResolved, setShowResolved] = useState(true)
  const [type, setType] = useState<IncidentType>('other')
  const [severity, setSeverity] = useState<IncidentSeverity>('info')
  const [competitorId, setCompetitorId] = useState<number | ''>('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [actionTaken, setActionTaken] = useState('')

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
        severity,
        competitor_id: competitorId ? Number(competitorId) : null,
        location: location.trim() || null,
        action_taken: actionTaken.trim() || null,
        notes: notes.trim(),
      })
      setNotes(''); setActionTaken(''); setLocation(''); setCompetitorId(''); setSeverity('info'); setType('other')
      load()
    } catch (e) { setError(errMsg(e)) }
  }

  async function resolve(i: CompetitionIncident) {
    const note = prompt('Resolution notes?') ?? ''
    await updateIncident(cid, i.id, { resolved: true, resolution_notes: note })
    load()
  }

  const filtered = showResolved ? items : items.filter(i => !i.resolved)

  return (
    <div>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Log incident</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Type</span>
            <select className={styles.input} value={type} onChange={e => setType(e.target.value as IncidentType)}>
              {Object.entries(INCIDENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className={styles.field}><span>Severity</span>
            <select className={styles.input} value={severity} onChange={e => setSeverity(e.target.value as IncidentSeverity)}>
              {Object.entries(SEVERITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className={styles.field}><span>Competitor</span>
            <select className={styles.input} value={competitorId}
                    onChange={e => setCompetitorId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">No specific competitor</option>
              {competitors.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </label>
          <label className={styles.field}><span>Location</span>
            <input className={styles.input} value={location} maxLength={300}
                   placeholder="e.g. North reef" onChange={e => setLocation(e.target.value)} />
          </label>
        </div>
        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span>What happened?</span>
          <textarea className={styles.textarea} rows={3} value={notes}
                    placeholder="Short description of the incident" onChange={e => setNotes(e.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.fieldFull}`}>
          <span>Action taken</span>
          <textarea className={styles.textarea} rows={2} value={actionTaken}
                    placeholder="e.g. First aid on scene, called coastguard" onChange={e => setActionTaken(e.target.value)} />
        </label>
        <div className={styles.formActions}>
          <button className={styles.btnPrimary} onClick={add}>Log incident</button>
        </div>
      </div>

      <div className={styles.filterRow}>
        <label className={styles.checkInline}>
          <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
          <span>Show resolved</span>
        </label>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {filtered.length === 0 ? (
        <p className={styles.muted}>No incidents logged.</p>
      ) : (
        <ul className={styles.cardList}>
          {filtered.map(i => {
            const sev = i.severity ?? 'info'
            const sevCls =
              sev === 'critical' ? styles.severityCritical
              : sev === 'urgent' ? styles.severityUrgent
              : sev === 'warning' ? styles.severityWarning
              : styles.severityInfo
            const cardCls =
              i.resolved ? styles.compCard
              : sev === 'critical' || sev === 'urgent' ? `${styles.compCard} ${styles.dqCard}`
              : styles.compCard
            return (
              <li key={i.id} className={cardCls}>
                <div className={styles.compCardHead}>
                  <span className={styles.compName}>
                    <span className={`${styles.severityDot} ${sevCls}`} aria-hidden="true" />
                    {INCIDENT_LABELS[i.incident_type]}
                    {i.competitor_name ? ` — ${i.competitor_name}` : ''}
                  </span>
                  <span className={`${styles.badge} ${i.resolved ? styles.badge_returned : styles.badgeOverdue}`}>
                    {i.resolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
                <div className={styles.boardMeta}>
                  {fmtTime(i.occurred_at)} · Severity: {SEVERITY_LABELS[sev]}
                  {i.location ? ` · ${i.location}` : ''}
                </div>
                {i.notes && <p className={styles.notes}>{i.notes}</p>}
                {i.action_taken && <p className={styles.notes}><strong>Action:</strong> {i.action_taken}</p>}
                {i.resolved && i.resolution_notes && (
                  <p className={styles.boardMeta}>Resolution: {i.resolution_notes}</p>
                )}
                {!i.resolved && (
                  <div className={styles.actionRow}>
                    <button className={styles.linkBtn} onClick={() => resolve(i)}>Mark resolved</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Target species editor ────────────────────────────────────────────────────

const DEFAULT_SPECIES = [
  'Pollock', 'Bass', 'Cod', 'Coalfish', 'Ballan wrasse',
  'Plaice', 'Flounder', 'Dab', 'Lobster', 'Brown crab',
]

// Default minimum lengths / units for common UK species so the row is
// pre-filled sensibly when an organiser picks one from the dropdown. Values
// are baseline legal-size rules and can be edited per event.
const SPECIES_DEFAULTS: Record<string, { min_length: number; unit: TargetSpeciesUnit }> = {
  'Pollock': { min_length: 30, unit: 'cm' },
  'Bass': { min_length: 42, unit: 'cm' },
  'Cod': { min_length: 35, unit: 'cm' },
  'Coalfish': { min_length: 35, unit: 'cm' },
  'Ballan wrasse': { min_length: 30, unit: 'cm' },
  'Plaice': { min_length: 27, unit: 'cm' },
  'Flounder': { min_length: 25, unit: 'cm' },
  'Dab': { min_length: 20, unit: 'cm' },
  // Crustaceans use carapace measurements (mm across the widest point) — a
  // fin-fish "cm" gate here would mark every legal entry as undersize.
  'Lobster': { min_length: 87, unit: 'mm_carapace' },
  'Brown crab': { min_length: 140, unit: 'mm_carapace' },
}

function TargetSpeciesEditor({
  value, onChange,
}: {
  value: TargetSpecies[]
  onChange: (v: TargetSpecies[]) => void
}) {
  const [customSpecies, setCustomSpecies] = useState('')

  function add(species: string) {
    const s = species.trim()
    if (!s || value.some(x => x.species === s)) return
    const defaults = SPECIES_DEFAULTS[s]
    onChange([...value, {
      species: s,
      min_length: defaults?.min_length ?? null,
      unit: defaults?.unit ?? 'cm',
      notes: null,
      points_bonus: null,
      max_count: null,
      auto_disqualify_undersize: true,
    }])
    setCustomSpecies('')
  }

  function remove(species: string) {
    onChange(value.filter(x => x.species !== species))
  }

  function update(species: string, patch: Partial<TargetSpecies>) {
    onChange(value.map(x => x.species === species ? { ...x, ...patch } : x))
  }

  const available = DEFAULT_SPECIES.filter(s => !value.some(x => x.species === s))

  return (
    <div>
      <div className={styles.speciesAddRow}>
        <select className={styles.input} value=""
                onChange={e => { if (e.target.value) add(e.target.value) }}>
          <option value="">+ Add species…</option>
          {available.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className={styles.input} placeholder="Or type custom species"
               value={customSpecies} onChange={e => setCustomSpecies(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(customSpecies) } }} />
        <button className={styles.btnGhost} onClick={() => add(customSpecies)} type="button">Add</button>
      </div>

      {value.length === 0 && (
        <p className={styles.muted}>No target species yet. Add one to start setting minimum sizes.</p>
      )}

      {value.map(row => (
        <div key={row.species} className={styles.speciesCard}>
          <div className={styles.speciesCardHead}>
            <strong>{row.species}</strong>
            <button className={styles.linkBtnDanger} onClick={() => remove(row.species)} type="button">
              Remove
            </button>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}><span>Minimum length</span>
              <input className={styles.input} type="number" min={0} step={0.5}
                     value={row.min_length ?? ''}
                     placeholder="—"
                     onChange={e => {
                       const n = Number(e.target.value)
                       update(row.species, {
                         min_length: e.target.value && n > 0 ? n : null,
                         min_weight_g: null,   // upgrade off any legacy value
                       })
                     }} />
            </label>
            <label className={styles.field}><span>Unit</span>
              <select className={styles.input} value={row.unit ?? 'cm'}
                      onChange={e => update(row.species, { unit: e.target.value as TargetSpeciesUnit })}>
                {Object.entries(UNIT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}><span>Bonus points per landed fish</span>
              <input className={styles.input} type="number" min={0} step={1}
                     value={row.points_bonus ?? ''}
                     placeholder="0"
                     onChange={e => {
                       const n = Number(e.target.value)
                       update(row.species, {
                         points_bonus: e.target.value && n >= 0 ? n : null,
                       })
                     }} />
            </label>
            <label className={styles.field}><span>Max count / bag limit</span>
              <input className={styles.input} type="number" min={0} step={1}
                     value={row.max_count ?? ''}
                     placeholder="Unlimited"
                     onChange={e => {
                       const n = Number(e.target.value)
                       update(row.species, {
                         max_count: e.target.value && n >= 0 ? n : null,
                       })
                     }} />
            </label>
          </div>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span>Measurement notes</span>
            <input className={styles.input} value={row.notes ?? ''}
                   placeholder="e.g. measure to fork; carapace across the widest point"
                   onChange={e => update(row.species, { notes: e.target.value || null })} />
          </label>
          <label className={styles.checkInline}>
            <input type="checkbox" checked={row.auto_disqualify_undersize ?? false}
                   onChange={e => update(row.species, { auto_disqualify_undersize: e.target.checked })} />
            <span>Auto-disqualify undersize catches at weigh-in</span>
          </label>
          {row.min_weight_g != null && (
            <p className={styles.warnText}>
              Legacy weight minimum still stored ({row.min_weight_g} g). Save this row to
              migrate to length-based rules.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Schedule / itinerary editor (unchanged) ──────────────────────────────────

function ScheduleEditor({
  value, onChange,
}: {
  value: ScheduleItem[]
  onChange: (v: ScheduleItem[]) => void
}) {
  const keysRef = useRef<number[]>([])
  const nextId = useRef(0)
  while (keysRef.current.length < value.length) keysRef.current.push(nextId.current++)
  if (keysRef.current.length > value.length) keysRef.current.length = value.length

  function update(i: number, patch: Partial<ScheduleItem>) {
    onChange(value.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }
  function remove(i: number) {
    keysRef.current.splice(i, 1)
    onChange(value.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    const k = keysRef.current
    ;[k[i], k[j]] = [k[j], k[i]]
    onChange(next)
  }
  function add() {
    keysRef.current.push(nextId.current++)
    onChange([...value, { time: '', title: '', detail: '' }])
  }

  return (
    <div>
      <div className={styles.speciesAddRow}>
        <button type="button" className={styles.btnGhost} onClick={add}>+ Add row</button>
        {value.length === 0 && (
          <button type="button" className={styles.btnGhost} onClick={() => onChange(STANDARD_SCHEDULE)}>
            Load standard timeline
          </button>
        )}
      </div>

      {value.length === 0 ? (
        <p className={styles.muted}>No schedule yet. Add rows or load the standard timeline.</p>
      ) : (
        <ul className={styles.scheduleEditList}>
          {value.map((row, i) => (
            <li key={keysRef.current[i]} className={styles.scheduleEditRow}>
              <div className={styles.scheduleRowTop}>
                <input
                  className={styles.scheduleTimeInput}
                  placeholder="07:15"
                  value={row.time}
                  maxLength={20}
                  onChange={e => update(i, { time: e.target.value })}
                  aria-label="Time"
                />
                <div className={styles.scheduleRowActions}>
                  <button type="button" className={styles.iconBtn} disabled={i === 0}
                          onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button type="button" className={styles.iconBtn} disabled={i === value.length - 1}
                          onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                  <button type="button" className={styles.iconBtn} data-danger
                          onClick={() => remove(i)} aria-label="Remove row">✕</button>
                </div>
              </div>
              <input
                className={styles.input}
                placeholder="Title (e.g. Health & safety briefing)"
                value={row.title}
                maxLength={120}
                onChange={e => update(i, { title: e.target.value })}
                aria-label="Title"
              />
              <textarea
                className={styles.textarea}
                rows={2}
                placeholder="Detail (optional)"
                value={row.detail ?? ''}
                onChange={e => update(i, { detail: e.target.value || null })}
                aria-label="Detail"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Template / PDF tab ───────────────────────────────────────────────────────
//
// Multiple sheet types can be printed independently: an organiser info sheet
// (the current brief), a competitor register, an emergency-contact sheet, a
// water-board sheet, a weigh-in sheet, and a final results sheet. Each has
// its own layout and a print target that hides everything else.

type SheetKind = 'organiser' | 'register' | 'emergency' | 'board' | 'weighin' | 'results'
const SHEETS: [SheetKind, string][] = [
  ['organiser', 'Organiser info sheet'],
  ['register', 'Competitor register'],
  ['emergency', 'Emergency contact sheet'],
  ['board', 'Water board sheet'],
  ['weighin', 'Weigh-in sheet'],
  ['results', 'Final results sheet'],
]

function TemplateTab({ comp, onChanged }: { comp: Competition; onChanged: () => void }) {
  const [sheet, setSheet] = useState<SheetKind>('organiser')
  const [rule, setRule] = useState<ScoringRule | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [teams, setTeams] = useState<CompetitionTeam[]>([])
  const [results, setResults] = useState<CompetitionResults | null>(null)
  const [entries, setEntries] = useState<FishEntry[]>([])

  const [editingSpecies, setEditingSpecies] = useState(false)
  const [speciesDraft, setSpeciesDraft] = useState<TargetSpecies[]>(comp.target_species ?? [])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    getScoringRule(comp.id).then(setRule).catch(() => setRule(null))
    listCompetitors(comp.id).then(setCompetitors).catch(() => setCompetitors([]))
    listTeams(comp.id).then(setTeams).catch(() => setTeams([]))
    getResults(comp.id).then(setResults).catch(() => setResults(null))
    listFish(comp.id).then(setEntries).catch(() => setEntries([]))
  }, [comp.id])

  useEffect(() => { setSpeciesDraft(comp.target_species ?? []) }, [comp.target_species])

  async function saveSpecies() {
    setSaving(true); setErr('')
    try {
      await updateCompetition(comp.id, { target_species: speciesDraft })
      setEditingSpecies(false)
      onChanged()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() { window.print() }

  // Warnings shown before generation so an organiser can spot missing info.
  const warnings: string[] = []
  if (sheet === 'organiser' || sheet === 'register') {
    if (!comp.emergency_contact_phone) warnings.push('No emergency contact phone set (Setup wizard).')
    if (!comp.meeting_point_name) warnings.push('No meeting point set (Setup wizard).')
    if ((comp.target_species ?? []).length === 0) warnings.push('No target species set.')
  }
  if (sheet === 'register' && competitors.length === 0) warnings.push('No competitors registered yet.')
  if (sheet === 'board' && competitors.length === 0) warnings.push('No competitors to list on the water board.')
  if (sheet === 'weighin' && competitors.length === 0) warnings.push('No competitors to list on the weigh-in sheet.')
  if (sheet === 'results' && !results) warnings.push('Results not loaded yet.')

  return (
    <div className={styles.templateWrap}>
      <div className={styles.templateActions}>
        <h2 className={styles.cardTitle}>Printable sheets</h2>
        <button className={styles.btnPrimary} onClick={handlePrint}>Print / Save PDF</button>
      </div>
      <p className={styles.muted}>
        Pick a sheet and print with your browser's <em>Print → Save as PDF</em>.
        Missing-information warnings show below the preview.
      </p>

      <div className={styles.filterRow} role="group" aria-label="Choose sheet">
        {SHEETS.map(([k, l]) => (
          <button key={k} aria-pressed={sheet === k}
                  className={sheet === k ? styles.chipActive : styles.chip}
                  onClick={() => setSheet(k)}>{l}</button>
        ))}
      </div>

      {warnings.length > 0 && (
        <div className={styles.warningBanner}>
          <strong>Before printing:</strong>
          <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {err && <p className={styles.error} role="alert">{err}</p>}

      {/* Target species editor lives on the Organiser sheet where the printable
          rules table already renders — this is the primary place to edit the
          length-based rules that drive the weigh-in warnings. */}
      {sheet === 'organiser' && (
        <div className={styles.card}>
          <div className={styles.detailRow}>
            <strong>Target species</strong>
            {!editingSpecies && (
              <button className={styles.linkBtn} onClick={() => { setSpeciesDraft(comp.target_species ?? []); setEditingSpecies(true) }}>
                Edit
              </button>
            )}
          </div>
          {editingSpecies ? (
            <>
              <TargetSpeciesEditor value={speciesDraft} onChange={setSpeciesDraft} />
              <div className={styles.formActions}>
                <button className={styles.btnGhost} onClick={() => setEditingSpecies(false)} disabled={saving}>Cancel</button>
                <button className={styles.btnPrimary} onClick={saveSpecies} disabled={saving}>
                  {saving ? 'Saving…' : 'Save species'}
                </button>
              </div>
            </>
          ) : (
            comp.target_species && comp.target_species.length > 0 ? (
              <table className={styles.speciesTable}>
                <thead><tr><th>Species</th><th>Minimum length</th><th>Notes</th></tr></thead>
                <tbody>
                  {comp.target_species.map(s => (
                    <tr key={s.species}>
                      <td>{s.species}</td>
                      <td>{formatSpeciesMin(s)}</td>
                      <td>{s.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={styles.muted}>No target species set. Click Edit to add species.</p>
            )
          )}
        </div>
      )}

      <div className={styles.templateDoc} id="competition-template">
        {sheet === 'organiser' && <OrganiserSheet comp={comp} rule={rule} />}
        {sheet === 'register' && <RegisterSheet comp={comp} competitors={competitors} teams={teams} />}
        {sheet === 'emergency' && <EmergencySheet comp={comp} competitors={competitors} />}
        {sheet === 'board' && <BoardSheet comp={comp} competitors={competitors} teams={teams} />}
        {sheet === 'weighin' && <WeighInSheet comp={comp} competitors={competitors} />}
        {sheet === 'results' && <ResultsSheet comp={comp} results={results} entries={entries} />}
      </div>
    </div>
  )
}

function SheetHeader({ comp, subtitle }: { comp: Competition; subtitle: string }) {
  return (
    <div className={styles.templateHeader}>
      <p className={styles.templateKicker}>Spearfishing Competition · {subtitle}</p>
      <h1 className={styles.templateTitle}>{comp.name}</h1>
      <p className={styles.templateSub}>
        {new Date(comp.competition_date).toLocaleDateString(undefined, {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })}
        {comp.location_site ? ` · ${comp.location_site}` : ''}
      </p>
    </div>
  )
}

function OrganiserSheet({ comp, rule }: { comp: Competition; rule: ScoringRule | null }) {
  const bonusEntries = rule ? Object.entries(rule.species_bonus) : []
  return (
    <>
      <SheetHeader comp={comp} subtitle="Information Sheet" />
      <div className={styles.templateSection}>
        <h2>Event details</h2>
        <table className={styles.templateTable}>
          <tbody>
            <tr><td>Date</td><td><strong>{comp.competition_date}</strong>{comp.backup_date ? ` (backup: ${comp.backup_date})` : ''}</td></tr>
            {comp.location_site && <tr><td>Location</td><td><strong>{comp.location_site}</strong></td></tr>}
            {comp.start_time && <tr><td>Competition start</td><td><strong>{comp.start_time}</strong></td></tr>}
            {comp.finish_time && <tr><td>All divers return by</td><td><strong>{comp.finish_time}</strong></td></tr>}
            {comp.sign_in_deadline && <tr><td>Sign-in deadline</td><td><strong>{comp.sign_in_deadline}</strong></td></tr>}
            {comp.weigh_in_start && <tr><td>Weigh-in opens</td><td><strong>{comp.weigh_in_start}</strong></td></tr>}
            {comp.entry_fee && <tr><td>Entry fee</td><td><strong>{comp.entry_fee}</strong></td></tr>}
          </tbody>
        </table>
      </div>

      {(comp.organiser_name || comp.organiser_phone || comp.organiser_email) && (
        <div className={styles.templateSection}>
          <h2>Organiser contact</h2>
          <table className={styles.templateTable}>
            <tbody>
              {comp.organiser_name && <tr><td>Name</td><td>{comp.organiser_name}</td></tr>}
              {comp.organiser_phone && <tr><td>Phone</td><td>{comp.organiser_phone}</td></tr>}
              {comp.organiser_email && <tr><td>Email</td><td>{comp.organiser_email}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {(comp.emergency_contact_name || comp.emergency_contact_phone) && (
        <div className={`${styles.templateSection} ${styles.templateEmergency}`}>
          <h2>⚠ Emergency contact</h2>
          <p>If a diver does not return by the deadline, call immediately:</p>
          <table className={styles.templateTable}>
            <tbody>
              {comp.emergency_contact_name && <tr><td>Name</td><td><strong>{comp.emergency_contact_name}</strong></td></tr>}
              {comp.emergency_contact_phone && <tr><td>Phone</td><td><strong>{comp.emergency_contact_phone}</strong></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {(comp.meeting_point_name || comp.meeting_point_notes
        || (comp.meeting_point_lat != null && comp.meeting_point_lon != null)) && (
        <div className={`${styles.templateSection} ${styles.templateMeet}`}>
          <h2>📍 Where to meet</h2>
          {comp.meeting_point_name && <p className={styles.templateMeetName}>{comp.meeting_point_name}</p>}
          {comp.meeting_point_notes && <p className={styles.templatePre}>{comp.meeting_point_notes}</p>}
          {comp.meeting_point_lat != null && comp.meeting_point_lon != null && (
            <p className={styles.templateMapLink}>
              Map: <a href={mapsLink(comp.meeting_point_lat, comp.meeting_point_lon)}
                     target="_blank" rel="noopener noreferrer">
                {comp.meeting_point_lat.toFixed(4)}, {comp.meeting_point_lon.toFixed(4)}
              </a>
            </p>
          )}
        </div>
      )}

      {comp.schedule && comp.schedule.length > 0 && (
        <div className={styles.templateSection}>
          <h2>Schedule for the day</h2>
          <ul className={styles.timeline}>
            {comp.schedule.map((s, i) => (
              <li key={i} className={styles.timelineItem}>
                <span className={styles.timelineTime}>{s.time}</span>
                <span className={styles.timelineBody}>
                  <strong>{s.title}</strong>
                  {s.detail && <span className={styles.timelineDetail}>{s.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {safetyLines(comp.health_safety_notes).length > 0 && (
        <div className={`${styles.templateSection} ${styles.templateSafety}`}>
          <h2>⚠ Health &amp; safety</h2>
          <ul className={styles.safetyList}>
            {safetyLines(comp.health_safety_notes).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}

      {(comp.boundaries_notes || (comp.location_lat != null && comp.location_lon != null)) && (
        <div className={styles.templateSection}>
          <h2>Competition area &amp; boundaries</h2>
          {comp.boundaries_notes && <p className={styles.templatePre}>{comp.boundaries_notes}</p>}
          {comp.location_lat != null && comp.location_lon != null && (
            <p className={styles.templateMapLink}>
              Dive area: <a href={mapsLink(comp.location_lat, comp.location_lon)}
                           target="_blank" rel="noopener noreferrer">
                {comp.location_lat.toFixed(4)}, {comp.location_lon.toFixed(4)}
              </a>
            </p>
          )}
        </div>
      )}

      {comp.target_species && comp.target_species.length > 0 && (
        <div className={styles.templateSection}>
          <h2>Target species</h2>
          <table className={styles.templateTable}>
            <thead>
              <tr><th>Species</th><th>Minimum length</th><th>Bonus</th><th>Max</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {comp.target_species.map(s => (
                <tr key={s.species}>
                  <td>{s.species}</td>
                  <td>{formatSpeciesMin(s)}</td>
                  <td>{s.points_bonus != null ? `+${s.points_bonus}` : '—'}</td>
                  <td>{s.max_count != null ? s.max_count : '—'}</td>
                  <td>{s.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.templatePre} style={{ fontSize: 12, marginTop: 8 }}>
            Undersize catches must be released. Rows marked "auto-DQ" will be
            disqualified automatically if a length below the minimum is entered
            at weigh-in.
          </p>
        </div>
      )}

      {rule && (
        <div className={styles.templateSection}>
          <h2>Scoring</h2>
          <table className={styles.templateTable}>
            <tbody>
              {rule.points_per_gram > 0 && (
                <tr><td>Points per gram (weight)</td><td>{rule.points_per_gram}</td></tr>
              )}
              {rule.points_per_cm > 0 && (
                <tr><td>Points per cm (length)</td><td>{rule.points_per_cm}</td></tr>
              )}
              {rule.points_per_fish > 0 && (
                <tr><td>Points per fish (flat)</td><td>{rule.points_per_fish}</td></tr>
              )}
              <tr><td>Team scoring</td><td>{rule.use_team_scoring ? 'Yes' : 'No'}</td></tr>
            </tbody>
          </table>
          {bonusEntries.length > 0 && (
            <>
              <h3>Species bonuses (flat additional points)</h3>
              <table className={styles.templateTable}>
                <thead><tr><th>Species</th><th>Bonus points</th></tr></thead>
                <tbody>
                  {bonusEntries.map(([species, pts]) => (
                    <tr key={species}><td>{species}</td><td>+{pts}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {comp.prize_info && (
        <div className={styles.templateSection}>
          <h2>Prizes</h2>
          <p className={styles.templatePre}>{comp.prize_info}</p>
        </div>
      )}

      {comp.additional_rules && (
        <div className={styles.templateSection}>
          <h2>Additional rules</h2>
          <p className={styles.templatePre}>{comp.additional_rules}</p>
        </div>
      )}

      <div className={styles.templateFooter}>
        <p>Generated by DepthViz · {new Date().toLocaleDateString()}</p>
      </div>
    </>
  )
}

function RegisterSheet({
  comp, competitors, teams,
}: { comp: Competition; competitors: Competitor[]; teams: CompetitionTeam[] }) {
  const teamName = (id: number | null) => teams.find(t => t.id === id)?.name ?? '—'
  return (
    <>
      <SheetHeader comp={comp} subtitle="Competitor Register" />
      <div className={styles.templateSection}>
        <p className={styles.templatePre}>
          Have each competitor sign in before entering the water and sign out on
          return. This sheet is the primary head-count record for the event.
        </p>
        <table className={styles.templateTable}>
          <thead>
            <tr>
              <th style={{ width: 24 }}>#</th>
              <th>Name</th>
              <th>Team / buddy</th>
              <th>Float</th>
              <th>Paid</th>
              <th>Waiver</th>
              <th>Sign in</th>
              <th>Sign out</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td><strong>{c.full_name}</strong></td>
                <td>{teamName(c.team_id)}</td>
                <td>{c.float_colour ?? '—'}</td>
                <td>{c.paid ? '✓' : '☐'}</td>
                <td>{c.waiver_accepted ? '✓' : '☐'}</td>
                <td>_________</td>
                <td>_________</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function EmergencySheet({
  comp, competitors,
}: { comp: Competition; competitors: Competitor[] }) {
  return (
    <>
      <SheetHeader comp={comp} subtitle="Emergency Contact Sheet" />
      {(comp.emergency_contact_name || comp.emergency_contact_phone) && (
        <div className={`${styles.templateSection} ${styles.templateEmergency}`}>
          <h2>⚠ Event emergency contact</h2>
          <p><strong>{comp.emergency_contact_name ?? '—'}</strong> · {comp.emergency_contact_phone ?? '—'}</p>
        </div>
      )}
      <div className={styles.templateSection}>
        <h2>Competitor emergency contacts</h2>
        <table className={styles.templateTable}>
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Phone</th>
              <th>Emergency contact</th>
              <th>ICE phone</th>
              <th>Medical notes</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map(c => (
              <tr key={c.id}>
                <td><strong>{c.full_name}</strong></td>
                <td>{c.phone ?? '—'}</td>
                <td>{c.emergency_contact_name ?? '—'}</td>
                <td>{c.emergency_contact_phone ?? '—'}</td>
                <td>{c.medical_notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function BoardSheet({
  comp, competitors, teams,
}: { comp: Competition; competitors: Competitor[]; teams: CompetitionTeam[] }) {
  const teamName = (id: number | null) => teams.find(t => t.id === id)?.name ?? '—'
  return (
    <>
      <SheetHeader comp={comp} subtitle="Water Board" />
      <div className={styles.templateSection}>
        <p className={styles.templatePre}>
          Everyone back and signed in by <strong>{dueBackAndSignedInLabel(comp)}</strong>.
          Update this board every time a diver enters or leaves the water — this
          is your live record of who is currently in the water.
        </p>
        <table className={styles.templateTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Team / buddy</th>
              <th>Float</th>
              <th>Out</th>
              <th>Back</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map(c => (
              <tr key={c.id}>
                <td><strong>{c.full_name}</strong></td>
                <td>{teamName(c.team_id)}</td>
                <td>{c.float_colour ?? '—'}</td>
                <td>_______</td>
                <td>_______</td>
                <td>_______________________</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function WeighInSheet({ comp, competitors }: { comp: Competition; competitors: Competitor[] }) {
  const rules = comp.target_species ?? []
  return (
    <>
      <SheetHeader comp={comp} subtitle="Weigh-in Sheet" />
      {rules.length > 0 && (
        <div className={styles.templateSection}>
          <h2>Minimum sizes</h2>
          <table className={styles.templateTable}>
            <thead><tr><th>Species</th><th>Min. length</th><th>Notes</th></tr></thead>
            <tbody>
              {rules.map(s => (
                <tr key={s.species}>
                  <td>{s.species}</td>
                  <td>{formatSpeciesMin(s)}</td>
                  <td>{s.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.templateSection}>
        <p className={styles.templatePre}>
          Judges: enter length first, then weight. Undersize catches must be
          released — mark clearly if a fish is disqualified and give a reason.
        </p>
        <table className={styles.templateTable}>
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Species</th>
              <th>Length</th>
              <th>Weight (g)</th>
              <th>OK / DQ</th>
              <th>Judge</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map(c => (
              <tr key={c.id}>
                <td><strong>{c.full_name}</strong></td>
                <td>_____________</td>
                <td>______</td>
                <td>______</td>
                <td>_____</td>
                <td>___</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ResultsSheet({
  comp, results, entries,
}: { comp: Competition; results: CompetitionResults | null; entries: FishEntry[] }) {
  if (!results) {
    return (
      <>
        <SheetHeader comp={comp} subtitle="Final Results" />
        <p className={styles.templatePre}>Results not available yet.</p>
      </>
    )
  }
  const big = results.biggest_fish
  const totalKg = results.totals.total_weight_kg
  const dqCount = entries.filter(f => f.disqualified).length
  return (
    <>
      <SheetHeader comp={comp} subtitle="Final Results" />
      <div className={styles.templateSection}>
        <p className={styles.templatePre}>
          {comp.results_locked ? 'Final results — locked.' : 'Provisional results — subject to verification.'}
          {' '}Total catch: <strong>{totalKg} kg</strong>. Disqualified fish: {dqCount}.
        </p>
      </div>
      {big && (
        <div className={styles.templateSection}>
          <h2>Biggest fish</h2>
          <p><strong>{big.competitor_name}</strong> · {big.species} · {big.weight_kg} kg</p>
        </div>
      )}
      {results.individual.length > 0 && (
        <div className={styles.templateSection}>
          <h2>Overall leaderboard</h2>
          <table className={styles.templateTable}>
            <thead>
              <tr><th>Rank</th><th>Name</th><th>Team</th><th>Points</th><th>Fish</th><th>Total kg</th></tr>
            </thead>
            <tbody>
              {results.individual.map(r => (
                <tr key={r.competitor_id}>
                  <td>{r.rank}</td>
                  <td>{r.competitor_name}</td>
                  <td>{r.team_name ?? '—'}</td>
                  <td>{r.points}</td>
                  <td>{r.fish_count}</td>
                  <td>{r.total_weight_kg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {results.teams.length > 0 && (
        <div className={styles.templateSection}>
          <h2>Team leaderboard</h2>
          <table className={styles.templateTable}>
            <thead><tr><th>Rank</th><th>Team</th><th>Points</th><th>Total kg</th></tr></thead>
            <tbody>
              {results.teams.map(r => (
                <tr key={r.team_id}>
                  <td>{r.rank}</td>
                  <td>{r.team_name}</td>
                  <td>{r.points}</td>
                  <td>{r.total_weight_kg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {results.biggest_by_species.length > 0 && (
        <div className={styles.templateSection}>
          <h2>Species winners</h2>
          <table className={styles.templateTable}>
            <thead><tr><th>Species</th><th>Weight (kg)</th><th>Winner</th></tr></thead>
            <tbody>
              {results.biggest_by_species.map(b => (
                <tr key={b.species}>
                  <td>{b.species}</td>
                  <td>{b.weight_kg}</td>
                  <td>{b.competitor_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.templateFooter}>
        <p>Generated by DepthViz · {new Date().toLocaleDateString()}</p>
      </div>
    </>
  )
}
