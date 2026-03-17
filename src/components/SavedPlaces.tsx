import { useState } from 'react'
import type { Location } from '../types'
import { deleteLocation } from '../lib/api'
import styles from './SavedPlaces.module.css'

interface Props {
  locations: Location[]
  onSelectLocation: (lat: number, lon: number, name: string) => void
  onDelete: (id: number) => void
}

export function SavedPlaces({ locations, onSelectLocation, onDelete }: Props) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async (id: number) => {
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
      {deleteError && <div className={styles.error}>{deleteError}</div>}
      <div className={styles.list}>
        {locations.map(loc => (
          <div key={loc.id} className={styles.row}>
            <div className={styles.info}>
              <div className={styles.name}>{loc.name}</div>
              <div className={styles.coords}>
                {Math.abs(loc.lat).toFixed(3)}°{loc.lat >= 0 ? 'N' : 'S'} · {Math.abs(loc.lon).toFixed(3)}°{loc.lon >= 0 ? 'E' : 'W'}
              </div>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.forecastBtn}
                onClick={() => onSelectLocation(loc.lat, loc.lon, loc.name)}
              >
                Forecast
              </button>
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(loc.id)}
                disabled={deletingId === loc.id}
              >
                {deletingId === loc.id ? '…' : '✕'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
