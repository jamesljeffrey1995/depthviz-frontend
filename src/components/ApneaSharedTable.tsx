import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { decodeShareFragment, sharedTableFromPayload } from '../lib/shareTable'
import { ApneaTableRunner } from './ApneaTableRunner'
import styles from './ApneaTableRunner.module.css'

interface Props {
  user: User | null
  onShowAuth: () => void
}

/**
 * Landing page for /training/shared#v1.… links (QR codes). Decodes the
 * table from the URL fragment and hands it to the runner — no account or
 * network needed to view and run a shared table; saving a copy requires
 * sign-in.
 */
export function ApneaSharedTable({ user, onShowAuth }: Props) {
  const navigate = useNavigate()
  const { hash } = useLocation()

  const table = useMemo(() => {
    const payload = decodeShareFragment(hash)
    return payload ? sharedTableFromPayload(payload) : null
  }, [hash])

  if (!table) {
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>
          This share link is invalid or incomplete. Ask the sender to generate
          a fresh QR code, and make sure the whole link was copied.
        </div>
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={() => navigate('/training')}
        >Back to library</button>
      </div>
    )
  }

  // Key by the fragment so a hash-only navigation (same route, different
  // shared table) remounts the runner — its table/session state is
  // initialised from the prop and would otherwise go stale.
  return <ApneaTableRunner key={hash} user={user} onShowAuth={onShowAuth} sharedTable={table} />
}
