/**
 * Regression tests for the cache invalidation bug:
 *
 *   cacheDelete('stats:1') used a startsWith() prefix match, so it also wiped
 *   stats:10, stats:12, stats:199 … — silently clearing unrelated locations'
 *   cached stats. cacheDelete is now an exact-key delete; bulk invalidation is
 *   an explicit, separate call (cacheDeleteByPrefix).
 */
import { describe, expect, test, beforeEach, vi } from 'vitest'
import { cacheGet, cacheSet, cacheDelete, cacheDeleteByPrefix } from './cache'

const TTL = 60_000

// Minimal localStorage stub for Node environment (no jsdom needed)
function makeLsStub() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
    clear: () => map.clear(),
    get length() { return map.size },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  }
}

let lsStub: ReturnType<typeof makeLsStub>

beforeEach(() => {
  lsStub = makeLsStub()
  vi.stubGlobal('localStorage', lsStub)
  // Clear any cross-test state via the public prefix delete.
  cacheDeleteByPrefix('')
})

describe('cacheDelete (exact key)', () => {
  test('deletes only the exact key', () => {
    cacheSet('stats:1', { v: 1 }, TTL)
    cacheSet('stats:10', { v: 10 }, TTL)
    cacheSet('stats:12', { v: 12 }, TTL)

    cacheDelete('stats:1')

    expect(cacheGet('stats:1')).toBeUndefined()
    // The bug: these used to be wiped too.
    expect(cacheGet('stats:10')).toEqual({ v: 10 })
    expect(cacheGet('stats:12')).toEqual({ v: 12 })
  })

  test('does not affect a similarly-named sibling key', () => {
    cacheSet('locations', [1, 2, 3], TTL)
    cacheSet('leaderboard', ['a'], TTL)

    cacheDelete('locations')

    expect(cacheGet('locations')).toBeUndefined()
    expect(cacheGet('leaderboard')).toEqual(['a'])
  })

  test('no-op when the key does not exist', () => {
    cacheSet('history:5', { ok: true }, TTL)
    cacheDelete('history:999')
    expect(cacheGet('history:5')).toEqual({ ok: true })
  })
})

describe('cacheDeleteByPrefix (bulk)', () => {
  test('deletes every key sharing the prefix', () => {
    cacheSet('stats:1', { v: 1 }, TTL)
    cacheSet('stats:10', { v: 10 }, TTL)
    cacheSet('history:1', { v: 1 }, TTL)
    cacheSet('leaderboard', ['x'], TTL)

    cacheDeleteByPrefix('stats:')

    expect(cacheGet('stats:1')).toBeUndefined()
    expect(cacheGet('stats:10')).toBeUndefined()
    // Unrelated namespaces untouched.
    expect(cacheGet('history:1')).toEqual({ v: 1 })
    expect(cacheGet('leaderboard')).toEqual(['x'])
  })
})

describe('localStorage persistence', () => {
  test('cacheSet writes to localStorage', () => {
    cacheSet('loc:42', { lat: 1, lon: 2 }, TTL)
    const stored = JSON.parse(lsStub.getItem('dv_cache:loc:42')!)
    expect(stored.value).toEqual({ lat: 1, lon: 2 })
    expect(typeof stored.expiresAt).toBe('number')
  })

  test('cacheGet promotes a live localStorage entry into memory', () => {
    // Write directly to ls (simulates data from a prior page visit)
    lsStub.setItem('dv_cache:promoted', JSON.stringify({ value: { lat: 1, lon: 2 }, expiresAt: Date.now() + TTL }))
    expect(cacheGet('promoted')).toEqual({ lat: 1, lon: 2 })
  })

  test('cacheDelete removes from localStorage', () => {
    cacheSet('forecast:1', { days: [] }, TTL)
    cacheDelete('forecast:1')
    expect(lsStub.getItem('dv_cache:forecast:1')).toBeNull()
  })

  test('expired localStorage entry is removed and returns undefined', () => {
    // Write an already-expired entry directly to ls
    lsStub.setItem('dv_cache:stale', JSON.stringify({ value: 'old', expiresAt: Date.now() - 1 }))
    expect(cacheGet('stale')).toBeUndefined()
    expect(lsStub.getItem('dv_cache:stale')).toBeNull()
  })

  test('localStorage entry with missing expiresAt is treated as invalid', () => {
    // Simulates corrupted storage — expiresAt is absent
    lsStub.setItem('dv_cache:corrupt', JSON.stringify({ value: 'bad' }))
    expect(cacheGet('corrupt')).toBeUndefined()
    expect(lsStub.getItem('dv_cache:corrupt')).toBeNull()
  })

  test('invalid JSON in localStorage is silently ignored', () => {
    lsStub.setItem('dv_cache:broken', 'not-json{{{')
    expect(cacheGet('broken')).toBeUndefined()
  })
})
