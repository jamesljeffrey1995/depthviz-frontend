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

const base = {
  is_public: false,
  is_predefined: false,
  vote_count: 0,
  user_vote: null as null,
  encrypted_lat: null as null,
  encrypted_lon: null as null,
}

const rows: Location[] = [
  { ...base, id: 1, name: 'mine private', lat: 0, lon: 0, user_id: ME, visibility: 'private' as const },
  { ...base, id: 2, name: 'mine public',  lat: 0, lon: 0, user_id: ME, visibility: 'public' as const, is_public: true },
  { ...base, id: 3, name: 'theirs private', lat: 0, lon: 0, user_id: OTHER, visibility: 'private' as const },
  { ...base, id: 4, name: 'theirs public',  lat: 0, lon: 0, user_id: OTHER, visibility: 'public' as const, is_public: true },
  { ...base, id: 5, name: 'legacy row (no fields)', lat: 0, lon: 0 },
  // id 6: legacy row that predates the `visibility` column but is marked public
  // via the old `is_public` boolean. These should remain visible to everyone.
  { ...base, id: 6, name: 'legacy public (is_public only)', lat: 0, lon: 0, user_id: OTHER, is_public: true },
  // id 7: legacy private row — no visibility, is_public false — hidden to non-owners
  { ...base, id: 7, name: 'legacy private (is_public only)', lat: 0, lon: 0, user_id: OTHER },
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

  // Back-compat: is_public without visibility field
  assert(canVisit(rows[5], ME), 'legacy is_public row visible to any logged-in user')
  assert(canVisit(rows[5], null), 'legacy is_public row visible to anon')
  assert(!canVisit(rows[6], ME), 'legacy non-public row hidden to non-owner')

  // filterVisibleLocations
  const forMe = filterVisibleLocations(rows, ME).map(r => r.id).sort()
  assert(JSON.stringify(forMe) === JSON.stringify([1, 2, 4, 6]),
    `filter for owner returned ${JSON.stringify(forMe)}`)

  const forOther = filterVisibleLocations(rows, OTHER).map(r => r.id).sort()
  assert(JSON.stringify(forOther) === JSON.stringify([2, 3, 4, 6, 7]),
    `filter for other returned ${JSON.stringify(forOther)}`)

  const anon = filterVisibleLocations(rows, null).map(r => r.id).sort()
  assert(JSON.stringify(anon) === JSON.stringify([2, 4, 6]),
    `anon filter returned ${JSON.stringify(anon)}`)
}
