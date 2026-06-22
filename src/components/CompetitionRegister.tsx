import { useState, useEffect, useCallback } from 'react'
import {
  listOpenCompetitions,
  getMyRegistration,
  registerForCompetition,
  updateMyRegistration,
  withdrawRegistration,
} from '../lib/api'
import type {
  OpenCompetition, MyRegistration, RegistrationInput,
  ExperienceLevel, BuddyStatus,
} from '../types'
import { ApiError } from '../lib/api'
import styles from './CompetitionRegister.module.css'

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

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function CompetitionRegister() {
  const [comps, setComps] = useState<OpenCompetition[] | null>(null)
  const [selected, setSelected] = useState<OpenCompetition | null>(null)
  const [registration, setRegistration] = useState<MyRegistration | null>(null)
  const [form, setForm] = useState<RegistrationInput>(emptyForm)
  const [editingBuddy, setEditingBuddy] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setComps(await listOpenCompetitions())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load competitions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  const openComp = useCallback(async (comp: OpenCompetition) => {
    setSelected(comp)
    setError(null)
    setNotice(null)
    setForm(emptyForm())
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
  }, [])

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
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Competition registration</h1>
        {error && <div className={styles.error}>{error}</div>}
        {loading ? (
          <div className={styles.muted}>Loading…</div>
        ) : !comps || comps.length === 0 ? (
          <div className={styles.empty}>No competitions are open for registration right now.</div>
        ) : (
          <ul className={styles.cardList}>
            {comps.map(c => (
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
