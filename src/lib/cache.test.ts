/**
 * Regression tests for the cache invalidation bug:
 *
 *   cacheDelete('stats:1') used a startsWith() prefix match, so it also wiped
 *   stats:10, stats:12, stats:199 … — silently clearing unrelated locations'
 *   cached stats. cacheDelete is now an exact-key delete; bulk invalidation is
 *   an explicit, separate call (cacheDeleteByPrefix).
 */
import { describe, expect, test, beforeEach } from 'vitest'
import { cacheGet, cacheSet, cacheDelete, cacheDeleteByPrefix } from './cache'

const TTL = 60_000

beforeEach(() => {
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
