/**
 * Client-side encryption for private spot coordinates.
 *
 * Uses AES-256-GCM via the Web Crypto API. The encryption key is stored as a
 * **non-extractable** CryptoKey in IndexedDB, making it inaccessible to XSS
 * payloads (unlike localStorage where it was previously stored as base64).
 *
 * On first call the module checks for a legacy localStorage key and migrates
 * it into IndexedDB, then deletes the localStorage copy.
 *
 * DB name : `depthviz_keys`
 * Store   : `spot_keys`
 * Key     : user UID
 * Value   : CryptoKey (non-extractable)
 */

const ALGO = 'AES-GCM'
const KEY_LENGTH = 256
const DB_NAME = 'depthviz_keys'
const STORE_NAME = 'spot_keys'
const DB_VERSION = 1

// Legacy localStorage key (for migration)
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

// ── Key management ─────────────────────────────────────────────────────────

/** Import a base64-encoded key (legacy migration). Returns a non-extractable key. */
async function importLegacyKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, ALGO, false, ['encrypt', 'decrypt'])
}

/** Get or create the user's spot encryption key. Migrates from localStorage if needed. */
export async function getOrCreateSpotKey(uid: string): Promise<CryptoKey> {
  const db = await openDB()

  // Check IndexedDB first
  const existing = await idbGet(db, uid)
  if (existing) return existing

  // Migrate from legacy localStorage if present
  const legacy = localStorage.getItem(legacyStorageKey(uid))
  if (legacy) {
    const key = await importLegacyKey(legacy)
    await idbPut(db, uid, key)
    localStorage.removeItem(legacyStorageKey(uid))
    return key
  }

  // Generate a new non-extractable key
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    false,  // non-extractable — cannot be read by JS
    ['encrypt', 'decrypt'],
  )
  await idbPut(db, uid, key)
  return key
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
  // Prepend IV to ciphertext
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

/** Decrypt both lat and lon from a private spot. */
export async function decryptCoords(
  encrypted_lat: string,
  encrypted_lon: string,
  uid: string,
): Promise<{ lat: number; lon: number }> {
  const key = await getOrCreateSpotKey(uid)
  return {
    lat: await decryptCoord(encrypted_lat, key),
    lon: await decryptCoord(encrypted_lon, key),
  }
}

/** Check if the user has a spot encryption key (in IndexedDB or legacy localStorage). */
export async function hasSpotKey(uid: string): Promise<boolean> {
  try {
    const db = await openDB()
    const key = await idbGet(db, uid)
    if (key) return true
  } catch { /* IndexedDB unavailable */ }
  return localStorage.getItem(legacyStorageKey(uid)) !== null
}
