import { useState } from 'react'
import type { Location } from '../types'
import { deleteLocation } from '../lib/api'
import { decryptCoords } from '../lib/spotCrypto'
import { IconAnchor, IconLock } from './icons'
import { toUserFacingError } from '../lib/frontendErrors'
import styles from './SavedPlaces.module.css'

interface Props {
  locations: Location[]
  onSelectLocation: (lat: number, lon: number, name: string, locationId?: number) => void
  onDelete: (id: number) => void
  userUid?: string
}

export function SavedPlaces({ locations, onSelectLocation, onDelete, userUid }: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [selectError, setSelectError] = useState('')

  const handleSelect = async (loc: Location) => {
    setSelectError('')

    const hasEncryptedCoords = Boolean(loc.encrypted_lat && loc.encrypted_lon)

    if (!hasEncryptedCoords) {
      onSelectLocation(loc.lat, loc.lon, loc.name, loc.id)
      return
    }

    // Encrypted spots require decryption; plaintext spots fall back to stored lat/lon.
    if (!userUid) {
      setSelectError('This private place cannot be opened right now.')
      console.error('Missing user UID for encrypted spot selection', {
        locationId: loc.id,
        hasEncryptedLat: Boolean(loc.encrypted_lat),
        hasEncryptedLon: Boolean(loc.encrypted_lon),
        hasUserUid: Boolean(userUid),
      })
      return
    }

    const encLat = loc.encrypted_lat!
    const encLon = loc.encrypted_lon!

    try {
      const { lat, lon } = await decryptCoords(encLat, encLon, userUid)
      onSelectLocation(lat, lon, loc.name, loc.id)
    } catch (e) {
      setSelectError('Failed to open this private place.')
      console.error('Failed to decrypt private spot coordinates', e)
    }
  }

  const handleDeleteRequest = (id: number) => {
    setConfirmId(id)
  }

  const handleDeleteConfirm = async (id: number) => {
    setConfirmId(null)
    setDeletingId(id)
    setDeleteError('')
    try {
      await deleteLocation(id)
      onDelete(id)
    } catch (e) {
      const failure = toUserFacingError(e, 'map')
      setDeleteError(failure.message)
      console.error(e)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteCancel = () => {
    setConfirmId(null)
  }

  if (locations.length === 0) {
    return (
      <div className={styles.empty}>
        <IconAnchor className={styles.emptyIcon} aria-hidden="true" />
        <div className={styles.emptyText}>No saved places yet</div>
        <div className={styles.emptySub}>Search for a location and tap + Save</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.heading}>My Saved Places</div>
      {(deleteError || selectError) && (
        <div className={styles.errorGroup}>
          {deleteError && <div className={styles.error} role="alert">{deleteError}</div>}
          {selectError && <div className={styles.error} role="alert">{selectError}</div>}
        </div>
      )}
      <div className={styles.list}>
        {locations.map(loc => {
          const isPrivate = loc.encrypted_lat != null && loc.encrypted_lon != null
          return (
            <div key={loc.id} className={styles.row}>
              <div className={styles.info}>
                <div className={styles.name}>{loc.name}</div>
                <div className={styles.coords}>
                  {isPrivate ? (
                    <span className={styles.privateTag}>
                      <IconLock className={styles.privateIcon} aria-hidden="true" />
                      Private spot — coordinates encrypted
                    </span>
                  ) : (
                    `${Math.abs(loc.lat).toFixed(3)}°${loc.lat >= 0 ? 'N' : 'S'} · ${Math.abs(loc.lon).toFixed(3)}°${loc.lon >= 0 ? 'E' : 'W'}`
                  )}
                </div>
              </div>
              <div className={styles.actions}>
                {confirmId === loc.id ? (
                  <div className={styles.confirmRow} role="group" aria-label={`Confirm removal of ${loc.name}`}>
                    <span className={styles.confirmText}>Remove?</span>
                    <button
                      className={styles.confirmYes}
                      onClick={() => handleDeleteConfirm(loc.id)}
                      aria-label={`Yes, remove ${loc.name}`}
                    >
                      Yes
                    </button>
                    <button
                      className={styles.confirmNo}
                      onClick={handleDeleteCancel}
                      aria-label="Cancel removal"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className={styles.forecastBtn}
                      onClick={() => handleSelect(loc)}
                      aria-label={`View forecast for ${loc.name}`}
                    >
                      Forecast
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteRequest(loc.id)}
                      disabled={deletingId === loc.id}
                      aria-label={`Remove ${loc.name} from saved places`}
                    >
                      {deletingId === loc.id ? 'Removing…' : 'Remove'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
