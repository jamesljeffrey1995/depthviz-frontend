/**
 * Client-side encryption for private spot coordinates.
 *
 * Uses AES-256-GCM via the Web Crypto API. Keys are exportable (JWK) and
 * synced to the server on creation so they work across all devices for the
 * same account. Coordinates remain encrypted at rest in the database.
 */

import { getSpotKeyMaterial, saveSpotKeyMaterial } from './api'

const ALGO = 'AES-GCM'
const KEY_LENGTH = 256
const DB_NAME = 'depthviz_keys'
const STORE_NAME = 'spot_keys'
const DB_VERSION = 1

function legacyStorageKey(uid: string): string {
  return `depthviz_spot_key_${uid}`
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(db: IDBDatabase, key: string): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, key: string, value: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Key import/export ──────────────────────────────────────────────────────

async function exportKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key)
  return JSON.stringify(jwk)
}

async function importKey(jwkJson: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkJson) as JsonWebKey
  return crypto.subtle.importKey('jwk', jwk, ALGO, true, ['encrypt', 'decrypt'])
}

/** Import a base64-encoded legacy key as extractable so it can be synced to the server. */
async function importLegacyKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, ALGO, true, ['encrypt', 'decrypt'])
}

// ── Key resolution (never auto-generates) ─────────────────────────────────

/**
 * Look up the user's spot key: local IndexedDB → legacy localStorage → server.
 * Returns null if no key is found anywhere; never generates a new key.
 * Used for decryption so a missing key is always explicit.
 */
async function resolveSpotKey(uid: string): Promise<CryptoKey | null> {
  const db = await openDB()

  // 1. Local IndexedDB
  const existing = await idbGet(db, uid)
  if (existing) {
    // Best-effort: upload if this key was never synced (non-extractable keys will throw and be silently ignored)
    exportKey(existing).then(jwk => saveSpotKeyMaterial(jwk)).catch(() => { /* non-extractable or network error */ })
    return existing
  }

  // 2. Legacy localStorage migration
  const legacy = localStorage.getItem(legacyStorageKey(uid))
  if (legacy) {
    const key = await importLegacyKey(legacy)
    await idbPut(db, uid, key)
    localStorage.removeItem(legacyStorageKey(uid))
    exportKey(key).then(jwk => saveSpotKeyMaterial(jwk)).catch(() => { /* best-effort */ })
    return key
  }

  // 3. Server (key was created on another device)
  try {
    const jwkJson = await getSpotKeyMaterial()
    if (jwkJson) {
      const key = await importKey(jwkJson)
      await idbPut(db, uid, key)
      return key
    }
  } catch { /* network error — treat as no key */ }

  return null
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get or create the user's spot encryption key.
 * Unlike resolveSpotKey, this will generate and upload a new key if none exists.
 * Use only when encrypting (saving) a new private spot.
 */
export async function getOrCreateSpotKey(uid: string): Promise<CryptoKey> {
  const key = await resolveSpotKey(uid)
  if (key) return key

  const db = await openDB()
  const newKey = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  )
  await idbPut(db, uid, newKey)
  exportKey(newKey).then(jwk => saveSpotKeyMaterial(jwk)).catch(() => { /* best-effort */ })
  return newKey
}

/** Encrypt a coordinate value. Returns base64(iv + ciphertext). */
export async function encryptCoord(value: number, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(value.toString())
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded,
  )
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

/** Decrypt a coordinate value from base64(iv + ciphertext). */
export async function decryptCoord(encrypted: string, key: CryptoKey): Promise<number> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ciphertext,
  )
  return parseFloat(new TextDecoder().decode(decrypted))
}

/** Encrypt both lat and lon for a private spot. */
export async function encryptCoords(
  lat: number,
  lon: number,
  uid: string,
): Promise<{ encrypted_lat: string; encrypted_lon: string }> {
  const key = await getOrCreateSpotKey(uid)
  return {
    encrypted_lat: await encryptCoord(lat, key),
    encrypted_lon: await encryptCoord(lon, key),
  }
}

/**
 * Decrypt both lat and lon from a private spot.
 * Throws "Missing spot encryption key" if no key is available anywhere.
 */
export async function decryptCoords(
  encrypted_lat: string,
  encrypted_lon: string,
  uid: string,
): Promise<{ lat: number; lon: number }> {
  const key = await resolveSpotKey(uid)
  if (!key) {
    throw new Error(`Missing spot encryption key for user ${uid}`)
  }
  return {
    lat: await decryptCoord(encrypted_lat, key),
    lon: await decryptCoord(encrypted_lon, key),
  }
}

/** Check if a spot key is available locally or on the server. */
export async function hasSpotKey(uid: string): Promise<boolean> {
  const key = await resolveSpotKey(uid).catch(() => null)
  return key !== null
}
