import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getMyProfile, updateProfile, getMyReports, getLeaderboard } from '../lib/api'
import type { UserProfile, ReportRead, LeaderboardEntry } from '../types'
import styles from './ProfilePanel.module.css'

const AdminPanel = lazy(() => import('./AdminPanel').then(m => ({ default: m.AdminPanel })))

interface ProfilePanelProps {
  onClose?: () => void
}

export function ProfilePanel({ onClose }: ProfilePanelProps) {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reports, setReports] = useState<ReportRead[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [editName, setEditName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [tab, setTab] = useState<'mine' | 'board' | 'admin'>('mine')

  useEffect(() => {
    if (!user) return
    getMyProfile().then(p => { setProfile(p); setNameInput(p.display_name ?? '') }).catch(() => {})
    getMyReports().then(setReports).catch(() => {})
    getLeaderboard().then(setLeaderboard).catch(() => {})
  }, [user])

  const saveName = async () => {
    const trimmed = nameInput.trim().slice(0, 50)
    if (!trimmed) return
    await updateProfile(trimmed)
    setProfile(p => p ? { ...p, display_name: trimmed } : p)
    setNameInput(trimmed)
    setEditName(false)
  }

  const handleSignOut = () => {
    signOut()
    onClose?.()
  }

  if (!user) return null

  return (
    <div className={styles.panel}>
      {/* Back button */}
      {onClose && (
        <button className={styles.backBtn} onClick={onClose}>
          ← Back
        </button>
      )}

      {/* User card */}
      <div className={styles.userCard}>
        <div className={styles.avatar}>{(profile?.display_name ?? user.email ?? '?')[0].toUpperCase()}</div>
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
            <div className={styles.statVal} style={{ color: profile.trusted ? 'var(--excellent)' : 'var(--text)' }}>
              {profile.trusted ? '★ Trusted' : 'Standard'}
            </div>
            <div className={styles.statLbl}>Status</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`} onClick={() => setTab('mine')}>My Reports</button>
        <button className={`${styles.tab} ${tab === 'board' ? styles.tabActive : ''}`} onClick={() => setTab('board')}>Leaderboard</button>
        {profile?.is_admin && (
          <button className={`${styles.tab} ${tab === 'admin' ? styles.tabActive : ''}`} onClick={() => setTab('admin')}>Admin</button>
        )}
      </div>

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
    </div>
  )
}