import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getMyProfile, updateProfile, updateProfileDetails, getMyReports, getLeaderboard, exportMyData, deleteMyAccount } from '../lib/api'
import type { UserProfile, ProfileDiverDetails, ReportRead, LeaderboardEntry, ExperienceLevel } from '../types'
import { IconChevronLeft, IconChevronDown, IconChevronUp, IconCheck } from './icons'
import { Tabs } from './Tabs'
import { toUserFacingError } from '../lib/frontendErrors'
import { trackClientEvent } from '../lib/telemetry'
import styles from './ProfilePanel.module.css'

const AdminPanel = lazy(() => import('./AdminPanel').then(m => ({ default: m.AdminPanel })))
const TrafficAnalytics = lazy(() => import('./admin/TrafficAnalytics').then(m => ({ default: m.TrafficAnalytics })))

interface ProfilePanelProps {
  onClose?: () => void
  onNavigateFriends?: () => void
  onAuthRequired?: () => void
}

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  experienced: 'Experienced',
}

// The editable diver-detail fields, mirrored from the profile into local form
// state so the competition registration form can pre-fill from them.
function detailsFromProfile(p: UserProfile | null): ProfileDiverDetails {
  return {
    phone: p?.phone ?? '',
    emergency_contact_name: p?.emergency_contact_name ?? '',
    emergency_contact_phone: p?.emergency_contact_phone ?? '',
    vehicle_reg: p?.vehicle_reg ?? '',
    experience_level: p?.experience_level ?? null,
    float_colour: p?.float_colour ?? '',
    medical_notes: p?.medical_notes ?? '',
  }
}

export function ProfilePanel({ onClose, onNavigateFriends, onAuthRequired }: ProfilePanelProps) {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reports, setReports] = useState<ReportRead[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [editName, setEditName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [tab, setTab] = useState<'mine' | 'board' | 'admin' | 'security'>('mine')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [details, setDetails] = useState<ProfileDiverDetails>(detailsFromProfile(null))
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsSaved, setDetailsSaved] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    if (!user) return
    setDataError('')
    getMyProfile().then(p => {
      setProfile(p)
      setNameInput(p.display_name ?? '')
      setDetails(detailsFromProfile(p))
    }).catch((e) => {
      const failure = toUserFacingError(e, 'profile')
      setDataError(failure.message)
      if (failure.requiresAuth) onAuthRequired?.()
    })
    getMyReports().then(setReports).catch((e) => {
      const failure = toUserFacingError(e, 'profile')
      setDataError(failure.message)
      if (failure.requiresAuth) onAuthRequired?.()
    })
    getLeaderboard().then(setLeaderboard).catch((e) => {
      const failure = toUserFacingError(e, 'profile')
      setDataError(failure.message)
      if (failure.requiresAuth) onAuthRequired?.()
    })
  }, [user, onAuthRequired])

  const setDetail = (patch: Partial<ProfileDiverDetails>) => {
    setDetails(d => ({ ...d, ...patch }))
    setDetailsSaved(false)
  }

  const saveDetails = async () => {
    setSavingDetails(true)
    try {
      const updated = await updateProfileDetails(details)
      setProfile(updated)
      setDetails(detailsFromProfile(updated))
      setDetailsSaved(true)
    } catch (e) {
      const failure = toUserFacingError(e, 'profile')
      setDataError(failure.message)
      trackClientEvent('profile.save_details_failed', {
        code: failure.telemetryCode,
        status: failure.status,
        requiresAuth: failure.requiresAuth,
      })
      if (failure.requiresAuth) onAuthRequired?.()
    } finally {
      setSavingDetails(false)
    }
  }

  const saveName = async () => {
    const trimmed = nameInput.trim().slice(0, 50)
    if (!trimmed) return
    try {
      await updateProfile(trimmed)
      setProfile(p => p ? { ...p, display_name: trimmed } : p)
      setNameInput(trimmed)
      setEditName(false)
    } catch (e) {
      const failure = toUserFacingError(e, 'profile')
      setDataError(failure.message)
      if (failure.requiresAuth) onAuthRequired?.()
    }
  }

  const handleSignOut = () => {
    signOut()
    onClose?.()
  }

  const handleExport = async () => {
    setExporting(true)
    setDataError('')
    try {
      const data = await exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `depthviz-my-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      const failure = toUserFacingError(e, 'profile')
      setDataError(failure.message)
      if (failure.requiresAuth) onAuthRequired?.()
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (confirmDelete.trim().toUpperCase() !== 'DELETE') return
    setDeleting(true)
    setDataError('')
    try {
      await deleteMyAccount()
      // Account and login are gone; sign out and close the panel.
      signOut()
      onClose?.()
    } catch (e) {
      const failure = toUserFacingError(e, 'profile')
      setDataError(failure.message)
      if (failure.requiresAuth) onAuthRequired?.()
      setDeleting(false)
    }
  }

  if (!user) return null

  return (
    <div className={styles.panel}>
      {/* Back button */}
      {onClose && (
        <button className={styles.backBtn} onClick={onClose}>
          <IconChevronLeft width={14} height={14} /> Back
        </button>
      )}

      {/* User card */}
      <div className={styles.userCard}>
        <div className={styles.avatar}>{(profile?.display_name ?? user.email ?? '?').charAt(0).toUpperCase()}</div>
        <div className={styles.userInfo}>
          {editName ? (
            <div className={styles.nameEdit}>
              <input
                className={styles.nameInput}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && saveName()}
                maxLength={50}
              />
              <button className={styles.nameSave} onClick={saveName}>Save</button>
            </div>
          ) : (
            <div className={styles.displayName} onClick={() => setEditName(true)}>
              {profile?.display_name ?? 'Anonymous Diver'}
              <span className={styles.editHint}> ✎</span>
            </div>
          )}
          <div className={styles.email}>{user.email}</div>
        </div>
        <button className={styles.signOut} onClick={handleSignOut}>Sign out</button>
      </div>

      {/* Stats row */}
      {profile && (
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statVal}>{profile.report_count}</div>
            <div className={styles.statLbl}>Reports</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>
              {profile.mean_accuracy != null ? `±${profile.mean_accuracy.toFixed(1)}m` : '—'}
            </div>
            <div className={styles.statLbl}>Accuracy</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal} style={{ color: profile.trusted ? 'var(--sev-good)' : 'var(--ink-dim)' }}>
              {profile.trusted ? '★ Trusted' : 'Standard'}
            </div>
            <div className={styles.statLbl}>Status</div>
          </div>
        </div>
      )}

      {/* Diver details — saved once, reused to pre-fill competition sign-up. */}
      <div className={styles.details}>
        <button
          className={styles.detailsHead}
          onClick={() => setDetailsOpen(o => !o)}
          aria-expanded={detailsOpen}
        >
          <span>Diver details</span>
          {detailsOpen ? <IconChevronUp aria-hidden="true" /> : <IconChevronDown aria-hidden="true" />}
        </button>
        {detailsOpen && (
          <>
            <p className={styles.detailsHint}>
              Save these once and we'll pre-fill them for you when you register for a competition.
            </p>
            <div className={styles.detailsGrid}>
              <label className={styles.detailField}>
                <span>Phone</span>
                <input className={styles.detailInput} type="tel" value={details.phone ?? ''}
                  onChange={e => setDetail({ phone: e.target.value })} />
              </label>
              <label className={styles.detailField}>
                <span>Experience</span>
                <select className={styles.detailSelect} value={details.experience_level ?? ''}
                  onChange={e => setDetail({ experience_level: (e.target.value || null) as ExperienceLevel | null })}>
                  <option value="">Select…</option>
                  {(Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[]).map(k => (
                    <option key={k} value={k}>{EXPERIENCE_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              <label className={styles.detailField}>
                <span>Float colour</span>
                <input className={styles.detailInput} value={details.float_colour ?? ''}
                  onChange={e => setDetail({ float_colour: e.target.value })} />
              </label>
              <label className={styles.detailField}>
                <span>Vehicle reg</span>
                <input className={styles.detailInput} value={details.vehicle_reg ?? ''}
                  onChange={e => setDetail({ vehicle_reg: e.target.value })} />
              </label>
              <label className={styles.detailField}>
                <span>Emergency contact name</span>
                <input className={styles.detailInput} value={details.emergency_contact_name ?? ''}
                  onChange={e => setDetail({ emergency_contact_name: e.target.value })} />
              </label>
              <label className={styles.detailField}>
                <span>Emergency contact phone</span>
                <input className={styles.detailInput} type="tel" value={details.emergency_contact_phone ?? ''}
                  onChange={e => setDetail({ emergency_contact_phone: e.target.value })} />
              </label>
              <label className={styles.detailField}>
                <span>Medical notes</span>
                <textarea className={styles.detailTextarea} value={details.medical_notes ?? ''}
                  onChange={e => setDetail({ medical_notes: e.target.value })} />
              </label>
            </div>
            <div className={styles.detailsActions}>
              <button className={styles.detailsSave} onClick={saveDetails} disabled={savingDetails}>
                {savingDetails ? 'Saving…' : 'Save details'}
              </button>
              {detailsSaved && (
                <span className={styles.detailsSaved} aria-live="polite">
                  <IconCheck width={14} height={14} aria-hidden="true" /> Saved
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Privacy & your data — GDPR export / erasure */}
      <div className={styles.details}>
        <button
          className={styles.detailsHead}
          onClick={() => setPrivacyOpen(o => !o)}
          aria-expanded={privacyOpen}
        >
          <span>Privacy &amp; your data</span>
          {privacyOpen ? <IconChevronUp aria-hidden="true" /> : <IconChevronDown aria-hidden="true" />}
        </button>
        {privacyOpen && (
          <div className={styles.privacyBody}>
            <p className={styles.privacyNote}>
              You can download everything we hold about you, or permanently delete
              your account at any time.
            </p>
            <button
              className={styles.detailsSave}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Preparing…' : 'Download my data'}
            </button>

            <div className={styles.dangerZone}>
              <p className={styles.dangerLabel}>Delete account</p>
              <p className={styles.privacyNote}>
                This permanently erases your account and data. Your dive reports are
                kept but anonymised (they improve forecasts for everyone) and cannot
                be traced back to you. This cannot be undone. Type <strong>DELETE</strong> to confirm.
              </p>
              <input
                className={styles.nameInput}
                value={confirmDelete}
                onChange={e => setConfirmDelete(e.target.value)}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm account deletion"
              />
              <button
                className={styles.deleteBtn}
                onClick={handleDeleteAccount}
                disabled={deleting || confirmDelete.trim().toUpperCase() !== 'DELETE'}
              >
                {deleting ? 'Deleting…' : 'Permanently delete my account'}
              </button>
            </div>
            {dataError && <p className={styles.dataError} aria-live="polite">{dataError}</p>}
          </div>
        )}
      </div>

      {/* Friends — moved here from the bottom navigation bar */}
      {onNavigateFriends && (
        <button className={styles.friendsBtn} onClick={onNavigateFriends}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          Friends
        </button>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'mine', label: 'My Reports' },
          { id: 'board', label: 'Leaderboard' },
          ...(profile?.is_admin ? [{ id: 'admin', label: 'Admin' }, { id: 'security', label: 'Security' }] : []),
        ]}
        active={tab}
        onChange={t => setTab(t as 'mine' | 'board' | 'admin' | 'security')}
      />

      {tab === 'mine' && (
        <div className={styles.reportList}>
          {reports.length === 0 && <div className={styles.empty}>No reports yet — log your next dive!</div>}
          {reports.map(r => {
            const delta = r.actual_vis - r.predicted_vis
            const deltaStr = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}m from expected`
            return (
              <div key={r.id} className={`${styles.reportRow} ${r.is_quarantined ? styles.quarantined : ''}`}>
                <div className={styles.reportDate}>{r.report_date}</div>
                <div className={styles.reportVis}>{r.actual_vis.toFixed(1)}m actual</div>
                <div className={styles.reportPred}>({r.predicted_vis.toFixed(1)}m predicted)</div>
                {r.is_quarantined && (
                  <div className={styles.qTag} title={`Statistical outlier: ${deltaStr}`}>
                    outlier · {deltaStr}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'board' && (
        <div className={styles.reportList}>
          {leaderboard.map((u, i) => (
            <div key={i} className={styles.reportRow}>
              <div className={styles.rank}>#{i + 1}</div>
              <div className={styles.boardName}>
                {u.display_name}
                {u.trusted && <span className={styles.trustedBadge}>★</span>}
              </div>
              <div className={styles.boardReports}>{u.report_count} dives</div>
              <div className={styles.boardAcc}>{u.mean_accuracy != null ? `±${u.mean_accuracy}m` : ''}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'admin' && profile?.is_admin && (
        <Suspense fallback={null}>
          <AdminPanel />
        </Suspense>
      )}

      {tab === 'security' && profile?.is_admin && (
        <Suspense fallback={null}>
          <TrafficAnalytics />
        </Suspense>
      )}
    </div>
  )
}