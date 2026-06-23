/**
 * Tests for the competition operations API layer.
 *
 * The whole module is admin-only and the backend enforces require_admin, so the
 * important frontend contract is that every helper targets the protected
 * /admin/competition endpoints, attaches the bearer token when a session
 * exists, and that the CSV export streams a download from the export route.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Provide a signed-in session so the Authorization header is attached, matching
// how a real admin request carries the JWT the backend verifies.
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'admin-jwt' } } }),
    },
  },
}))

vi.mock('./cache', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
  cacheDeleteByPrefix: vi.fn(),
}))

import {
  listCompetitions, createCompetition, setWaterStatus,
  createFish, downloadCompetitionCsv,
  getStandings, sendTestAlert,
} from './api'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

function lastCall() {
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
  return calls[calls.length - 1] as [string, RequestInit]
}

describe('competition API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: [] })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  test('listCompetitions hits the admin endpoint with the bearer token', async () => {
    await listCompetitions()
    const [url, init] = lastCall()
    expect(String(url)).toContain('/admin/competition')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer admin-jwt')
  })

  test('createCompetition POSTs to /admin/competition', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ id: 1, name: 'NE Open' })))
    await createCompetition({ name: 'NE Open', competition_date: '2026-08-15' })
    const [url, init] = lastCall()
    expect(String(url)).toContain('/admin/competition')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string).name).toBe('NE Open')
  })

  test('setWaterStatus posts the status to the competitor status endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ id: 9, status: 'in_water' })))
    await setWaterStatus(3, 9, 'in_water')
    const [url, init] = lastCall()
    expect(String(url)).toContain('/admin/competition/3/competitors/9/status')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string).status).toBe('in_water')
  })

  test('createFish posts weight in grams to the fish endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ id: 1, weight_kg: 2.5 })))
    await createFish(3, { competitor_id: 9, species: 'Bass', weight_grams: 2500 })
    const [url, init] = lastCall()
    expect(String(url)).toContain('/admin/competition/3/fish')
    expect(JSON.parse(init.body as string).weight_grams).toBe(2500)
  })

  test('createFish can tally a catch with no weight yet (pending)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ id: 2, pending: true, weight_kg: null })))
    await createFish(3, { competitor_id: 9, species: 'Pollock' })
    const [url, init] = lastCall()
    expect(String(url)).toContain('/admin/competition/3/fish')
    const body = JSON.parse(init.body as string)
    expect(body.species).toBe('Pollock')
    expect(body.weight_grams).toBeUndefined()
  })

  test('downloadCompetitionCsv fetches the export route with auth', async () => {    // jsdom isn't configured; stub the DOM bits the download helper touches.
    const click = vi.fn()
    const anchor = { href: '', download: '', click, remove: vi.fn() } as unknown as HTMLAnchorElement
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() })
    vi.stubGlobal('document', {
      createElement: () => anchor,
      body: { appendChild: vi.fn() },
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('a,b\n1,2', {
      status: 200, headers: { 'Content-Type': 'text/csv' },
    })))

    await downloadCompetitionCsv(7, 'competitors')
    const [url] = lastCall()
    expect(String(url)).toContain('/admin/competition/7/export/competitors.csv')
    expect(click).toHaveBeenCalled()
  })

  test('getStandings hits the competitor-facing (non-admin) standings endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ competition_id: 4, released: false, items: [] })))
    await getStandings(4)
    const [url, init] = lastCall()
    // Must use the diver-facing /competition route, never the admin one.
    expect(String(url)).toContain('/competition/4/standings')
    expect(String(url)).not.toContain('/admin/')
    expect(init.method ?? 'GET').toBe('GET')
  })

  test('sendTestAlert defaults to all channels and forwards the chosen channel', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      slack: { enabled: true, configured: true, sent: true },
      email: { enabled: true, configured: true, recipients: [], sent: true },
      sms: { enabled: true, configured: true, recipients: [], sent: true },
    })))
    await sendTestAlert(3)
    expect(String(lastCall()[0])).toContain('/admin/competition/3/test-alert?channel=all')
    await sendTestAlert(3, 'sms')
    const [url, init] = lastCall()
    expect(String(url)).toContain('/admin/competition/3/test-alert?channel=sms')
    expect(init.method).toBe('POST')
  })
})
