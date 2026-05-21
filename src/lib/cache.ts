interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.value as T
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/** Delete a single cache entry by its exact key. */
export function cacheDelete(key: string): void {
  store.delete(key)
}

/**
 * Delete every entry whose key starts with `prefix`.
 * Use only for intentional bulk invalidation (e.g. clearing all `stats:*`).
 * Prefer {@link cacheDelete} for a single keyed entry — a prefix delete of
 * `stats:1` would also wipe `stats:10`, `stats:12`, … which is almost never intended.
 */
export function cacheDeleteByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
