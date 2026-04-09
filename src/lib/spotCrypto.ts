/**
 * Client-side encryption for private spot coordinates.
 *
 * Uses AES-256-GCM via the Web Crypto API. The encryption key is generated
 * once per user and stored in localStorage. The server never sees plaintext
 * coordinates for private spots — only the encrypted blobs.
 *
 * Key storage: localStorage under `depthviz_spot_key_<uid>`
 * Format: base64-encoded raw AES key (32 bytes)
 */

const ALGO = 'AES-GCM'
const KEY_LENGTH = 256

function storageKey(uid: string): string {
  return `depthviz_spot_key_${uid}`
}

/** Export a CryptoKey to base64 for storage. */
async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

/** Import a base64-encoded key back to CryptoKey. */
async function importKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, ALGO, true, ['encrypt', 'decrypt'])
}

/** Get or create the user's spot encryption key. */
export async function getOrCreateSpotKey(uid: string): Promise<CryptoKey> {
  const stored = localStorage.getItem(storageKey(uid))
  if (stored) {
    return importKey(stored)
  }
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  )
  localStorage.setItem(storageKey(uid), await exportKey(key))
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

/** Check if the user has a spot encryption key. */
export function hasSpotKey(uid: string): boolean {
  return localStorage.getItem(storageKey(uid)) !== null
}

/** Export the user's spot key as base64 (for backup/sharing). */
export async function exportSpotKey(uid: string): Promise<string | null> {
  return localStorage.getItem(storageKey(uid))
}
