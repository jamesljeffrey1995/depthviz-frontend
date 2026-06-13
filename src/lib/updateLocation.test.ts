/**
 * Tests for updateLocation() (issue #155): it must PATCH /locations/{id} with a
 * JSON body and invalidate both the cached locations list and any cached
 * forecasts (depth/seabed feed the resuspension model, so forecasts go stale).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Avoid pulling in the real Supabase client (and its env requirements).
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))

// Spy on the cache so we can assert invalidation without real storage.
vi.mock('./cache', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
  cacheDeleteByPrefix: vi.fn(),
}))

import { updateLocation } from './api'
import { cacheDelete, cacheDeleteByPrefix } from './cache'

const SAMPLE = {
  id: 5, name: 'Wreck', lat: 50, lon: -4, is_public: false, is_predefined: false,
  vote_count: 0, user_vote: null, encrypted_lat: null, encrypted_lon: null,
  depth_m: 8, seabed_class: 'mud',
}

describe('updateLocation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(SAMPLE), { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  test('PATCHes the location endpoint with a JSON body', async () => {
    const result = await updateLocation(5, { depth_m: 8, seabed_class: 'mud' })

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('/locations/5')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ depth_m: 8, seabed_class: 'mud' })
    expect(result.seabed_class).toBe('mud')
  })

  test('invalidates the locations list and cached forecasts', async () => {
    await updateLocation(5, { depth_m: null, seabed_class: null })

    expect(cacheDelete).toHaveBeenCalledWith('locations')
    expect(cacheDeleteByPrefix).toHaveBeenCalledWith('forecast:')
  })
})
