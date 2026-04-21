/**
 * Type-level + runtime sanity checks for the client-side privacy filter.
 * This file has no test runner wired up yet (the project ships no test
 * config) but the assertions are written so they fail fast if imported
 * from any harness (Vitest / Jest / node --test).
 */
import type { Location } from '../types'
import { canVisit, filterVisibleLocations } from './spots'

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`assertion failed: ${msg}`)
}

const ME = 'me-uuid'
const OTHER = 'someone-else'

const rows: Location[] = [
  { id: 1, name: 'mine private', lat: 0, lon: 0, user_id: ME, visibility: 'private' },
  { id: 2, name: 'mine public',  lat: 0, lon: 0, user_id: ME, visibility: 'public' },
  { id: 3, name: 'theirs private', lat: 0, lon: 0, user_id: OTHER, visibility: 'private' },
  { id: 4, name: 'theirs public',  lat: 0, lon: 0, user_id: OTHER, visibility: 'public' },
  { id: 5, name: 'legacy row (no fields)', lat: 0, lon: 0 },
]

export function runSpotsFilterTests(): void {
  // canVisit
  assert(canVisit(rows[0], ME), 'owner sees own private')
  assert(canVisit(rows[1], ME), 'owner sees own public')
  assert(!canVisit(rows[2], ME), 'other user private is hidden')
  assert(canVisit(rows[3], ME), 'any user sees public')
  assert(!canVisit(rows[4], ME), 'legacy row without user_id is hidden')
  assert(!canVisit(rows[0], null), 'anon cannot see private')
  assert(canVisit(rows[3], null), 'anon sees public')

  // filterVisibleLocations
  const forMe = filterVisibleLocations(rows, ME).map(r => r.id).sort()
  assert(JSON.stringify(forMe) === JSON.stringify([1, 2, 4]),
    `filter for owner returned ${JSON.stringify(forMe)}`)

  const forOther = filterVisibleLocations(rows, OTHER).map(r => r.id).sort()
  assert(JSON.stringify(forOther) === JSON.stringify([2, 3, 4]),
    `filter for other returned ${JSON.stringify(forOther)}`)

  const anon = filterVisibleLocations(rows, null).map(r => r.id).sort()
  assert(JSON.stringify(anon) === JSON.stringify([2, 4]),
    `anon filter returned ${JSON.stringify(anon)}`)
}
