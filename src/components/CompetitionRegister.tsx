import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listOpenCompetitions,
  listMyCompetitions,
  getMyRegistration,
  getMyProfile,
  registerForCompetition,
  updateMyRegistration,
  withdrawRegistration,
} from '../lib/api'
import type {
  OpenCompetition, MyCompetition, MyRegistration, RegistrationInput,
  ExperienceLevel, BuddyStatus, UserProfile,
} from '../types'
import { ApiError } from '../lib/api'
import styles from './CompetitionRegister.module.css'

// How an in-progress competition's status reads to a registered diver.
const COMP_STATUS_LABEL: Record<string, string> = {
  open: 'Registration open',
  active: 'Competition in progress',
  weigh_in: 'Weigh-in underway',
}

function fmtClock(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// Adapt a "my competition" day-view row to the OpenCompetition shape the detail
// view expects, so tapping it reuses the existing registration detail flow.
function toOpen(m: MyCompetition): OpenCompetition {
  return {
    id: m.id,
    name: m.name,
    competition_date: m.competition_date,
    location_site: m.location_site,
    location_lat: m.location_lat,
    location_lon: m.location_lon,
    boundaries_notes: m.boundaries_notes,
    start_time: m.start_time,
    finish_time: m.finish_time,
    sign_in_deadline: m.sign_in_deadline,
    status: m.status,
    registration_open: m.registration_open,
    already_registered: m.already_registered,
    meeting_point_name: m.meeting_point_name,
    meeting_point_lat: m.meeting_point_lat,
    meeting_point_lon: m.meeting_point_lon,
    meeting_point_notes: m.meeting_point_notes,
    health_safety_notes: m.health_safety_notes,
    target_species: m.target_species,
    schedule: m.schedule,
  }
}

/** OpenStreetMap link for a coordinate pair. */
function osmLink(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
}

/** Split free-text safety notes into bullet lines, one per non-blank line
 *  (handles both LF and CRLF line endings). */
function safetyLines(notes: string | null | undefined): string[] {
  return (notes ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}

/**
 * Day-of detail shown to a diver on a competition's page: where to meet, the
 * schedule, target species and the safety briefing. Mirrors the organiser's
 * printable brief so competitors see the same plan.
 */
function CompDayInfo({ comp }: { comp: OpenCompetition }) {
  const hasMeet = comp.meeting_point_name || comp.meeting_point_notes
    || (comp.meeting_point_lat != null && comp.meeting_point_lon != null)
  const hasSchedule = comp.schedule && comp.schedule.length > 0
  const hasSpecies = comp.target_species && comp.target_species.length > 0
  const safety = safetyLines(comp.health_safety_notes)
  const hasSafety = safety.length > 0
  if (!hasMeet && !hasSchedule && !hasSpecies && !hasSafety) return null

  return (
    <div className={styles.dayInfo}>
      {hasMeet && (
        <section className={styles.meetCard}>
          <h2 className={styles.infoHeading}>📍 Where to meet</h2>
          {comp.meeting_point_name && <div className={styles.meetName}>{comp.meeting_point_name}</div>}
          {comp.meeting_point_notes && <p className={styles.notes}>{comp.meeting_point_notes}</p>}
          {comp.meeting_point_lat != null && comp.meeting_point_lon != null && (
            <a className={styles.mapLink} href={osmLink(comp.meeting_point_lat, comp.meeting_point_lon)}
               target="_blank" rel="noopener noreferrer">
              Open in map ↗
            </a>
          )}
        </section>
      )}

      {hasSchedule && (
        <section>
          <h2 className={styles.infoHeading}>Schedule</h2>
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
        </section>
      )}

      {hasSpecies && (
        <section>
          <h2 className={styles.infoHeading}>Target species</h2>
          <ul className={styles.speciesList}>
            {comp.target_species.map(s => (
              <li key={s.species}>
                <strong>{s.species}</strong>
                {s.min_weight_g != null ? ` · min ${s.min_weight_g} g` : ''}
                {s.notes ? ` — ${s.notes}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasSafety && (
        <section className={styles.safetyCard}>
          <h2 className={styles.infoHeading}>⚠ Health &amp; safety</h2>
          <ul className={styles.safetyList}>
            {safety.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// The diver's own live water status on competition day. Read-only — an admin
// signs people in and out of the water on the board; this just mirrors it.
function MyWaterStatus({ comp }: { comp: MyCompetition }) {
  const s = comp.my_status
  let cls = styles.statusWaiting
  let line: React.ReactNode = <>Not signed into the water yet.</>
  if (s === 'in_water') {
    cls = styles.statusInWater
    line = <><strong>You are in the water</strong> — since {fmtClock(comp.signed_out_at)}.</>
  } else if (s === 'returned') {
    cls = styles.statusReturned
    line = <><strong>Back on shore</strong> — signed in at {fmtClock(comp.returned_at)}.</>
  } else if (s === 'withdrawn') {
    line = <>Withdrawn from this competition.</>
  } else if (s === 'registered' || s === 'not_arrived') {
    line = <>Checked in — waiting to be signed into the water.</>
  }
  return (
    <div className={`${styles.statusBanner} ${cls}`}>
      {line}
      <p className={styles.statusHint}>Water sign-in/out is managed by an organiser on the day.</p>
    </div>
  )
}

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  experienced: 'Experienced',
}

// Friendly explanation of each buddy state, shown on the diver's own card.
const BUDDY_STATUS: Record<BuddyStatus, { label: string; tone: 'ok' | 'pending' | 'warn' }> = {
  none: { label: 'No buddy yet', tone: 'pending' },
  invited: { label: 'Buddy invited — waiting for them to register', tone: 'pending' },
  paired: { label: 'Paired with your buddy', tone: 'ok' },
  auto_assigned: { label: 'Buddy assigned for dive day', tone: 'ok' },
  expired: { label: "Your buddy didn't register in time — you'll be paired on dive day", tone: 'warn' },
}

function emptyForm(): RegistrationInput {
  return {
    full_name: '',
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    vehicle_reg: '',
    experience_level: null,
    float_colour: '',
    medical_notes: '',
    waiver_accepted: false,
    buddy_invite_email: '',
  }
}

// Seed a fresh registration form from the diver's saved profile so they don't
// retype details they've already stored. Full name falls back to the account's
// display name; the waiver is always left unticked (it must be a fresh consent).
function formFromProfile(profile: UserProfile | null): RegistrationInput {
  const base = emptyForm()
  if (!profile) return base
  return {
    ...base,
    full_name: profile.display_name ?? '',
    phone: profile.phone ?? '',
    emergency_contact_name: profile.emergency_contact_name ?? '',
    emergency_contact_phone: profile.emergency_contact_phone ?? '',
    vehicle_reg: profile.vehicle_reg ?? '',
    experience_level: profile.experience_level ?? null,
    float_colour: profile.float_colour ?? '',
    medical_notes: profile.medical_notes ?? '',
  }
}

// Whether the form is still the blank baseline — i.e. the diver hasn't typed
// anything yet. Used to decide if it's safe to re-seed from a late-arriving
// profile without clobbering their input.
function formIsPristine(form: RegistrationInput): boolean {
  return JSON.stringify(form) === JSON.stringify(emptyForm())
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function CompetitionRegister() {
  const navigate = useNavigate()
  const [comps, setComps] = useState<OpenCompetition[] | null>(null)
  const [mine, setMine] = useState<MyCompetition[]>([])
  const [selected, setSelected] = useState<OpenCompetition | null>(null)
  const [registration, setRegistration] = useState<MyRegistration | null>(null)
  const [form, setForm] = useState<RegistrationInput>(emptyForm)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editingBuddy, setEditingBuddy] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [open, registered] = await Promise.all([
        listOpenCompetitions(),
        listMyCompetitions().catch(() => [] as MyCompetition[]),
      ])
      setComps(open)
      setMine(registered)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load competitions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  // Load the diver's saved profile once so the registration form can pre-fill
  // from it. Best-effort — a missing profile just leaves the form blank.
  useEffect(() => {
    getMyProfile().then(setProfile).catch(() => {})
  }, [])

  // While a registered event is live, refresh so the diver's own water status
  // (signed out / returned, set by the admin on the board) stays current.
  const hasLive = mine.some(m => m.is_live)
  useEffect(() => {
    if (selected || !hasLive) return
    const id = setInterval(() => { listMyCompetitions().then(setMine).catch(() => {}) }, 20000)
    return () => clearInterval(id)
  }, [selected, hasLive])

  const openComp = useCallback(async (comp: OpenCompetition) => {
    setSelected(comp)
    setError(null)
    setNotice(null)
    setForm(formFromProfile(profile))
    if (comp.already_registered) {
      try {
        const reg = await getMyRegistration(comp.id)
        setRegistration(reg)
        setEditingBuddy(reg.buddy_invite_email ?? '')
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load your registration')
      }
    } else {
      setRegistration(null)
    }
  }, [profile])

  // If the diver opened a competition before their profile finished loading
  // (slow network), openComp seeded a blank form. Re-seed once the profile
  // arrives — but only while the form is still untouched, so we never overwrite
  // details they've already started typing.
  useEffect(() => {
    if (!profile || !selected || registration) return
    setForm(f => (formIsPristine(f) ? formFromProfile(profile) : f))
  }, [profile, selected, registration])

  const back = () => {
    setSelected(null)
    setRegistration(null)
    setError(null)
    setNotice(null)
    loadList()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const reg = await registerForCompetition(selected.id, {
        ...form,
        buddy_invite_email: form.buddy_invite_email?.trim() || null,
      })
      setRegistration(reg)
      setEditingBuddy(reg.buddy_invite_email ?? '')
      setNotice('You are registered!')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  const saveBuddy = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const reg = await updateMyRegistration(selected.id, {
        buddy_invite_email: editingBuddy.trim() || null,
      })
      setRegistration(reg)
      setNotice('Buddy updated.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update buddy')
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    if (!selected) return
    if (!window.confirm('Withdraw your registration? This cannot be undone.')) return
    setBusy(true)
    setError(null)
    try {
      await withdrawRegistration(selected.id)
      back()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not withdraw')
      setBusy(false)
    }
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (!selected) {
    const mineIds = new Set(mine.map(m => m.id))
    // Don't duplicate a competition that's already in "Your competitions".
    const openComps = (comps ?? []).filter(c => !mineIds.has(c.id))
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Competitions</h1>
        {profile?.is_admin && (
          <button className={styles.adminLink} onClick={() => navigate('/admin/competition')}>
            Open competition ops →
          </button>
        )}
        {error && <div className={styles.error}>{error}</div>}

        {mine.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Your competitions</h2>
            <ul className={styles.cardList}>
              {mine.map(m => (
                <li key={m.id}>
                  <button className={styles.compCard} onClick={() => openComp(toOpen(m))}>
                    <div className={styles.compName}>
                      {m.name}
                      {m.is_live && <span className={styles.liveTag}>LIVE</span>}
                    </div>
                    <div className={styles.compMeta}>{fmtDate(m.competition_date)}</div>
                    {m.location_site && <div className={styles.compMeta}>{m.location_site}</div>}
                    <div className={styles.compMeta}>{COMP_STATUS_LABEL[m.status] ?? m.status}</div>
                    {m.is_live && <MyWaterStatus comp={m} />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {mine.length > 0 && <h2 className={styles.sectionTitle}>Open for registration</h2>}
        {loading ? (
          <div className={styles.muted}>Loading…</div>
        ) : openComps.length === 0 ? (
          <div className={styles.empty}>
            {mine.length > 0
              ? 'No other competitions are open for registration right now.'
              : 'No competitions are open for registration right now.'}
          </div>
        ) : (
          <ul className={styles.cardList}>
            {openComps.map(c => (
              <li key={c.id}>
                <button className={styles.compCard} onClick={() => openComp(c)}>
                  <div className={styles.compName}>{c.name}</div>
                  <div className={styles.compMeta}>{fmtDate(c.competition_date)}</div>
                  {c.location_site && <div className={styles.compMeta}>{c.location_site}</div>}
                  <div className={c.already_registered ? styles.badgeOk : styles.badge}>
                    {c.already_registered ? 'You are registered' : 'Tap to register'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={back}>← All competitions</button>
      <h1 className={styles.title}>{selected.name}</h1>
      <div className={styles.muted}>{fmtDate(selected.competition_date)}</div>
      {selected.location_site && <div className={styles.muted}>{selected.location_site}</div>}
      {selected.boundaries_notes && <p className={styles.notes}>{selected.boundaries_notes}</p>}

      <CompDayInfo comp={selected} />

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {registration ? (
        <RegisteredPanel
          reg={registration}
          editingBuddy={editingBuddy}
          setEditingBuddy={setEditingBuddy}
          onSaveBuddy={saveBuddy}
          onWithdraw={withdraw}
          busy={busy}
        />
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            <span>Full name *</span>
            <input className={styles.input} required value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Phone</span>
            <input className={styles.input} value={form.phone ?? ''}
              onChange={e => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Experience</span>
            <select className={styles.input} value={form.experience_level ?? ''}
              onChange={e => setForm({ ...form, experience_level: (e.target.value || null) as ExperienceLevel | null })}>
              <option value="">Select…</option>
              {(Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[]).map(k => (
                <option key={k} value={k}>{EXPERIENCE_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Float colour</span>
            <input className={styles.input} value={form.float_colour ?? ''}
              onChange={e => setForm({ ...form, float_colour: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Vehicle reg</span>
            <input className={styles.input} value={form.vehicle_reg ?? ''}
              onChange={e => setForm({ ...form, vehicle_reg: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Emergency contact name</span>
            <input className={styles.input} value={form.emergency_contact_name ?? ''}
              onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Emergency contact phone</span>
            <input className={styles.input} value={form.emergency_contact_phone ?? ''}
              onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} />
          </label>
          <label className={styles.field}>
            <span>Medical notes</span>
            <textarea className={styles.textarea} value={form.medical_notes ?? ''}
              onChange={e => setForm({ ...form, medical_notes: e.target.value })} />
          </label>

          <div className={styles.buddyBox}>
            <label className={styles.field}>
              <span>Buddy's email (optional)</span>
              <input className={styles.input} type="email" value={form.buddy_invite_email ?? ''}
                placeholder="mate@example.com"
                onChange={e => setForm({ ...form, buddy_invite_email: e.target.value })} />
            </label>
            <p className={styles.hint}>
              Enter your buddy's email and they'll be paired with you automatically when
              they register. If they don't register within 3 days the invite is dropped and
              you'll be randomly paired with another solo diver on dive day.
            </p>
          </div>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={!!form.waiver_accepted}
              onChange={e => setForm({ ...form, waiver_accepted: e.target.checked })} />
            <span>I accept the competition waiver and safety rules</span>
          </label>

          <div className={styles.actions}>
            <button className={styles.btnPrimary} type="submit" disabled={busy}>
              {busy ? 'Registering…' : 'Register'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function RegisteredPanel({
  reg, editingBuddy, setEditingBuddy, onSaveBuddy, onWithdraw, busy,
}: {
  reg: MyRegistration
  editingBuddy: string
  setEditingBuddy: (v: string) => void
  onSaveBuddy: () => void
  onWithdraw: () => void
  busy: boolean
}) {
  const status = BUDDY_STATUS[reg.buddy_status]
  const canEditBuddy = !reg.has_buddy
  return (
    <div className={styles.panel}>
      <div className={styles.confirm}>You're registered as <strong>{reg.full_name}</strong>.</div>

      <div className={`${styles.buddyStatus} ${styles[status.tone]}`}>
        {status.label}
        {reg.buddy_name && <> — <strong>{reg.buddy_name}</strong></>}
      </div>

      {canEditBuddy ? (
        <div className={styles.buddyBox}>
          <label className={styles.field}>
            <span>Buddy's email</span>
            <input className={styles.input} type="email" value={editingBuddy}
              placeholder="mate@example.com"
              onChange={e => setEditingBuddy(e.target.value)} />
          </label>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={onSaveBuddy} disabled={busy}>
              {busy ? 'Saving…' : 'Save buddy'}
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.hint}>
          Your buddy is locked in. To change it, withdraw and register again.
        </p>
      )}

      <div className={styles.actions}>
        <button className={styles.btnDanger} onClick={onWithdraw} disabled={busy}>
          Withdraw registration
        </button>
      </div>
    </div>
  )
}
