import { useState } from 'react'
import type { Location } from '../types'
import { deleteLocation } from '../lib/api'
import { decryptCoords } from '../lib/spotCrypto'
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

    if (loc.is_public) {
      onSelectLocation(loc.lat, loc.lon, loc.name, loc.id)
      return
    }

    // Private spots: must decrypt — never fall back to zeroed lat/lon
    if (!loc.encrypted_lat || !loc.encrypted_lon || !userUid) {
      setSelectError('This private place cannot be opened right now.')
      console.error('Missing encrypted coordinates or user UID for private spot selection', {
        locationId: loc.id,
        hasEncryptedLat: Boolean(loc.encrypted_lat),
        hasEncryptedLon: Boolean(loc.encrypted_lon),
        hasUserUid: Boolean(userUid),
      })
      return
    }

    try {
      const { lat, lon } = await decryptCoords(loc.encrypted_lat, loc.encrypted_lon, userUid)
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
      setDeleteError('Failed to remove place — please try again')
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
        <div className={styles.emptyIcon}>📍</div>
        <div className={styles.emptyText}>No saved places yet<br />Search for a location and tap + Save</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.heading}>My Saved Places</div>
      {deleteError && <div className={styles.error} role="alert">{deleteError}</div>}
      {selectError && <div className={styles.error} role="alert">{selectError}</div>}
      <div className={styles.list}>
        {locations.map(loc => (
          <div key={loc.id} className={styles.row}>
            <div className={styles.info}>
              <div className={styles.name}>{loc.name}</div>
              <div className={styles.coords}>
                {loc.is_public
                  ? `${Math.abs(loc.lat).toFixed(3)}°${loc.lat >= 0 ? 'N' : 'S'} · ${Math.abs(loc.lon).toFixed(3)}°${loc.lon >= 0 ? 'E' : 'W'}`
                  : loc.encrypted_lat != null && loc.encrypted_lon != null
                    ? 'Private spot — coordinates encrypted'
                    : 'Private spot'
                }
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
                    {deletingId === loc.id ? '…' : '✕'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
