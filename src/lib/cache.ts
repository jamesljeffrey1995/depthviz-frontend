interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()
const LS_PREFIX = 'dv_cache:'

function lsRead<T>(key: string): CacheEntry<T> | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return undefined
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return undefined
  }
}

function lsWrite<T>(key: string, entry: CacheEntry<T>): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(LS_PREFIX + key)
  } catch {}
}

export function cacheGet<T>(key: string): T | undefined {
  const mem = store.get(key)
  if (mem) {
    if (Date.now() > mem.expiresAt) {
      store.delete(key)
      lsRemove(key)
      return undefined
    }
    return mem.value as T
  }
  const ls = lsRead<T>(key)
  if (!ls) return undefined
  if (Date.now() > ls.expiresAt) {
    lsRemove(key)
    return undefined
  }
  store.set(key, ls as CacheEntry<unknown>)
  return ls.value
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs }
  store.set(key, entry as CacheEntry<unknown>)
  lsWrite(key, entry)
}

/** Delete a single cache entry by its exact key. */
export function cacheDelete(key: string): void {
  store.delete(key)
  lsRemove(key)
}

/**
 * Delete every entry whose key starts with `prefix`.
 * Use only for intentional bulk invalidation (e.g. clearing all `stats:*`).
 * Prefer {@link cacheDelete} for a single keyed entry — a prefix delete of
 * `stats:1` would also wipe `stats:10`, `stats:12`, … which is almost never intended.
 */
export function cacheDeleteByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key)
      lsRemove(key)
    }
  }
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(LS_PREFIX + prefix)) keysToRemove.push(k)
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } catch {}
}
