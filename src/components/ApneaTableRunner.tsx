import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { copyApneaTable, getApneaTable } from '../lib/api'
import type { ApneaCycle, ApneaTable } from '../types'
import styles from './ApneaTableRunner.module.css'

type Phase = 'idle' | 'prep' | 'hold' | 'rest' | 'done'

const PREP_SECONDS = 10

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function totalSeconds(cycles: ApneaCycle[]): number {
  return cycles.reduce((acc, c) => acc + c.hold_seconds + c.rest_seconds, 0)
}

/** Tiny Web Audio beep — created lazily on first user gesture so we don't
 *  trip browser autoplay policies. Plays a clean sine pulse with a short
 *  fade so it sounds like a soft chime, not a click. */
function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null)

  const ensureCtx = useCallback(() => {
    if (typeof window === 'undefined') return null
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctxRef.current) ctxRef.current = new AC()
    return ctxRef.current
  }, [])

  const beep = useCallback((freq: number, durationMs: number) => {
    const ctx = ensureCtx()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    const seconds = durationMs / 1000
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds)
    osc.start(now)
    osc.stop(now + seconds + 0.02)
  }, [ensureCtx])

  return { beep, ensureCtx }
}

interface Props {
  user: User | null
  onShowAuth: () => void
}

export function ApneaTableRunner({ user, onShowAuth }: Props) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  // Reject non-numeric route params up front — Number("foo") gives NaN, and
  // a NaN id would otherwise be passed through to /apnea/tables/NaN.
  const parsedId = id !== undefined ? Number(id) : NaN
  const tableId = Number.isFinite(parsedId) ? parsedId : null

  const [table, setTable] = useState<ApneaTable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [phase, setPhase] = useState<Phase>('idle')
  const [cycleIdx, setCycleIdx] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [phaseDuration, setPhaseDuration] = useState(0)
  const [audioOn, setAudioOn] = useState(true)
  const [copying, setCopying] = useState(false)

  // Latest audioOn value, read from inside setTimeout callbacks that would
  // otherwise capture the value at the time they were scheduled.
  const audioOnRef = useRef(audioOn)
  useEffect(() => { audioOnRef.current = audioOn }, [audioOn])

  // Pending timeouts from finish() so stop()/unmount can cancel them and
  // beeps don't fire after the user has reset or navigated away.
  const pendingTimeoutsRef = useRef<number[]>([])
  const clearPendingTimeouts = () => {
    for (const t of pendingTimeoutsRef.current) clearTimeout(t)
    pendingTimeoutsRef.current = []
  }
  useEffect(() => clearPendingTimeouts, [])  // clear on unmount

  const { beep, ensureCtx } = useBeep()
  const playBeep = useCallback((freq: number, ms: number) => {
    if (audioOnRef.current) beep(freq, ms)
  }, [beep])

  // Load table
  useEffect(() => {
    if (tableId === null) {
      setLoading(false)
      setError('Invalid table id')
      return
    }
    let cancelled = false
    setLoading(true)
    getApneaTable(tableId)
      .then(t => { if (!cancelled) setTable(t) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tableId])

  // Tick loop — drives the timer regardless of phase.
  // Uses a monotonic deadline rather than counting interval ticks, so the
  // timer stays accurate even when the tab is throttled in the background.
  const deadlineRef = useRef<number | null>(null)
  // Tracks the most recent whole-second that already fired a countdown beep,
  // so the 3/2/1 chime plays exactly once per crossing rather than every
  // animation frame while ceil(sec) sits at the same value.
  const lastBeepSecRef = useRef<number | null>(null)
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') {
      deadlineRef.current = null
      lastBeepSecRef.current = null
      return
    }
    let raf = 0
    let cancelled = false
    lastBeepSecRef.current = null  // reset at the start of every phase

    const advance = () => {
      if (deadlineRef.current === null || !table) return
      const ms = deadlineRef.current - Date.now()
      const sec = ms / 1000
      setRemaining(sec)

      // Final-second beep at 3s, 2s, 1s — fired once per second crossing.
      const curWhole = Math.ceil(sec)
      if (
        (curWhole === 3 || curWhole === 2 || curWhole === 1) &&
        curWhole !== lastBeepSecRef.current
      ) {
        playBeep(660, 100)
        lastBeepSecRef.current = curWhole
      }

      if (ms <= 0) {
        // Phase complete — advance
        if (phase === 'prep') {
          startHold(0)
        } else if (phase === 'hold') {
          const cyc = table.cycles[cycleIdx]
          if (cyc && cyc.rest_seconds > 0 && cycleIdx < table.cycles.length - 1) {
            startRest(cycleIdx)
          } else if (cycleIdx < table.cycles.length - 1) {
            startHold(cycleIdx + 1)
          } else {
            finish()
          }
        } else if (phase === 'rest') {
          startHold(cycleIdx + 1)
        }
        return
      }
      if (!cancelled) raf = requestAnimationFrame(advance)
    }
    raf = requestAnimationFrame(advance)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
    // We intentionally include only the phase trigger — the inner functions
    // close over current state via refs/setters which React keeps stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cycleIdx, table, playBeep])

  const startHold = (idx: number) => {
    if (!table) return
    const cycle = table.cycles[idx]
    if (!cycle) {
      // Defensive guard — schema validation rejects this, but if the API
      // ever returned a table with no cycles or an idx walked past the end,
      // just stop the session rather than throw on a missing field.
      setError('This table has no cycles to run')
      stop()
      return
    }
    const dur = cycle.hold_seconds
    setCycleIdx(idx)
    setPhaseDuration(dur)
    setRemaining(dur)
    deadlineRef.current = Date.now() + dur * 1000
    setPhase('hold')
    playBeep(880, 300)  // High beep = start hold
  }

  const startRest = (idx: number) => {
    if (!table) return
    const cycle = table.cycles[idx]
    if (!cycle) { stop(); return }
    const dur = cycle.rest_seconds
    setPhaseDuration(dur)
    setRemaining(dur)
    deadlineRef.current = Date.now() + dur * 1000
    setPhase('rest')
    playBeep(440, 300)  // Lower beep = start rest
  }

  const startPrep = () => {
    if (!table || table.cycles.length === 0) {
      setError('This table has no cycles to run')
      return
    }
    ensureCtx()  // Unlock audio context on user gesture
    clearPendingTimeouts()  // any leftover finish() chimes from a prior run
    setError('')
    setCycleIdx(0)
    setPhaseDuration(PREP_SECONDS)
    setRemaining(PREP_SECONDS)
    deadlineRef.current = Date.now() + PREP_SECONDS * 1000
    setPhase('prep')
  }

  const finish = () => {
    deadlineRef.current = null
    setPhase('done')
    playBeep(523, 400)
    // Schedule the rest of the chord through tracked timeouts so stop() or
    // unmount can cancel them. playBeep itself reads the latest audioOn
    // value via audioOnRef.
    pendingTimeoutsRef.current.push(
      window.setTimeout(() => playBeep(659, 400), 250),
      window.setTimeout(() => playBeep(784, 600), 500),
    )
  }

  const stop = () => {
    deadlineRef.current = null
    clearPendingTimeouts()
    setPhase('idle')
    setCycleIdx(0)
    setRemaining(0)
  }

  const skip = () => {
    if (phase === 'idle' || phase === 'done' || !table) return
    deadlineRef.current = Date.now()  // Falls through on next frame
    setRemaining(0)
  }

  const handleCopy = async () => {
    if (!user) { onShowAuth(); return }
    if (tableId === null) return
    setCopying(true)
    try {
      const copy = await copyApneaTable(tableId)
      navigate(`/training/${copy.id}/edit`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to copy')
    } finally {
      setCopying(false)
    }
  }

  // Wake Lock — keep the screen on while a session is running, so users
  // don't lose the timer mid-hold to a phone display timeout.
  useEffect(() => {
    if (phase !== 'hold' && phase !== 'rest' && phase !== 'prep') return
    let lock: { release: () => Promise<void> } | null = null
    type Nav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const w = navigator as Nav
    if (w.wakeLock) {
      w.wakeLock.request('screen').then(l => { lock = l }).catch(() => {})
    }
    return () => {
      if (lock) lock.release().catch(() => {})
    }
  }, [phase])

  const progress = useMemo(() => {
    if (phaseDuration <= 0 || phase === 'idle' || phase === 'done') return 0
    return Math.max(0, Math.min(100, (1 - remaining / phaseDuration) * 100))
  }, [phaseDuration, remaining, phase])

  const isOwner = user !== null && table?.user_id === user.id
  const canEdit = isOwner && table && !table.is_system

  if (loading) {
    return <div className={styles.wrap}><div className={styles.subtitle}>Loading…</div></div>
  }
  if (error || !table) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{error || 'Table not found'}</div>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => navigate('/training')}>Back to library</button>
      </div>
    )
  }

  const phaseClass =
    phase === 'hold' ? styles.phaseHold :
    phase === 'rest' ? styles.phaseRest :
    phase === 'prep' ? styles.phasePrep :
    phase === 'done' ? styles.phaseDone : ''

  const phaseLabel =
    phase === 'idle' ? 'Ready' :
    phase === 'prep' ? 'Get ready' :
    phase === 'hold' ? `Hold #${cycleIdx + 1} of ${table.cycles.length}` :
    phase === 'rest' ? `Rest before #${cycleIdx + 2}` :
    'Complete'

  const displaySeconds =
    phase === 'idle' ? totalSeconds(table.cycles) :
    phase === 'done' ? 0 :
    remaining

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.title}>{table.name}</div>
          {table.description && <div className={styles.subtitle}>{table.description}</div>}
        </div>
      </div>

      <div className={styles.badges}>
        <span className={`${styles.badge} ${
          table.difficulty === 'beginner' ? styles.badgeBeginner :
          table.difficulty === 'intermediate' ? styles.badgeIntermediate :
          styles.badgeExpert
        }`}>{table.difficulty}</span>
        <span className={`${styles.badge} ${styles.badgeType}`}>{table.table_type.toUpperCase()}</span>
      </div>

      <div className={styles.actions}>
        <button className={styles.iconBtn} onClick={() => navigate('/training')}>← Back</button>
        {canEdit && (
          <button className={`${styles.iconBtn} ${styles.iconBtnAccent}`} onClick={() => navigate(`/training/${table.id}/edit`)}>
            Edit
          </button>
        )}
        {!isOwner && (
          <button className={styles.iconBtn} onClick={handleCopy} disabled={copying}>
            {copying ? 'Copying…' : 'Copy to my tables'}
          </button>
        )}
      </div>

      <div className={styles.warning}>
        <strong>Dry training only</strong>
        Never practice breath-holds in or near water without direct, qualified
        supervision. Stop immediately if you feel light-headed or notice strong
        contractions.
      </div>

      <div className={styles.audioToggle}>
        <input
          id="audio-toggle"
          type="checkbox"
          checked={audioOn}
          onChange={e => setAudioOn(e.target.checked)}
        />
        <label htmlFor="audio-toggle">Audio cues (start, countdown, finish)</label>
      </div>

      <div className={`${styles.runnerCard} ${phaseClass}`} aria-live="polite">
        <div className={styles.phaseLabel}>{phaseLabel}</div>
        <div className={styles.bigTime}>{formatTime(displaySeconds)}</div>
        <div className={styles.roundInfo}>
          {phase === 'idle' && `${table.cycles.length} rounds · total ${Math.round(totalSeconds(table.cycles) / 60)} min`}
          {phase === 'hold' && `Hold ${cycleIdx + 1}/${table.cycles.length} · target ${formatTime(table.cycles[cycleIdx].hold_seconds)}`}
          {phase === 'rest' && `Rest ${formatTime(table.cycles[cycleIdx].rest_seconds)} before round ${cycleIdx + 2}`}
          {phase === 'prep' && 'Get into position — first hold starts when this reaches zero'}
          {phase === 'done' && 'Session complete — recover and hydrate'}
        </div>

        <div className={styles.progress} aria-hidden="true">
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.controls}>
          {phase === 'idle' && (
            <button className={styles.btn} onClick={startPrep}>Start session</button>
          )}
          {(phase === 'prep' || phase === 'hold' || phase === 'rest') && (
            <>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={skip}>Skip phase</button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={stop}>Stop</button>
            </>
          )}
          {phase === 'done' && (
            <button className={styles.btn} onClick={stop}>Reset</button>
          )}
        </div>
      </div>

      <div className={styles.cyclesTable}>
        <div className={styles.cyclesTitle}>Cycles</div>
        <div className={styles.tableHeader}>
          <span>#</span>
          <span>Hold</span>
          <span>Rest</span>
          <span className={styles.statusCol}>Status</span>
        </div>
        {table.cycles.map((c, idx) => {
          const isActive = (phase === 'hold' || phase === 'rest') && cycleIdx === idx
          const isDone = phase !== 'idle' && phase !== 'prep' && (
            cycleIdx > idx || (phase === 'done')
          )
          return (
            <div
              key={idx}
              className={`${styles.tableRow} ${isActive ? styles.active : ''} ${isDone && !isActive ? styles.done : ''}`}
            >
              <span className={styles.idx}>#{idx + 1}</span>
              <span>{formatTime(c.hold_seconds)}</span>
              <span>{c.rest_seconds > 0 ? formatTime(c.rest_seconds) : '—'}</span>
              <span className={styles.statusCol}>
                {isActive ? (phase === 'hold' ? 'holding' : 'resting')
                  : isDone && !isActive ? 'done'
                  : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
