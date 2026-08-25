import { describe, expect, it, vi } from 'vitest'
import { installApiV1Transport, rewriteDepthVizApiUrl } from './apiV1Transport'

describe('DepthViz API v1 transport', () => {
  it('moves legacy paths onto /api/v1 and canonical resource names', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://depthviz.uk' },
      fetch: vi.fn(),
    })

    expect(rewriteDepthVizApiUrl('/api/forecast?lat=55')).toBe('/api/v1/forecast?lat=55')
    expect(rewriteDepthVizApiUrl('/api/locations/42/vote')).toBe('/api/v1/locations/42/votes')
    expect(rewriteDepthVizApiUrl('/api/social/friend-request')).toBe('/api/v1/social/friend-requests')
    expect(rewriteDepthVizApiUrl('/api/admin/competition/7/auto-pair-buddies'))
      .toBe('/api/v1/admin/competition/7/buddy-pairings/auto')
    expect(rewriteDepthVizApiUrl('/api/admin/analytics/alerts/9/dismiss'))
      .toBe('/api/v1/admin/analytics/alerts/9/dismissals')
    expect(rewriteDepthVizApiUrl('/api/admin/ml/retrain')).toBe('/api/v1/admin/ml/training-runs')
    expect(rewriteDepthVizApiUrl('https://example.com/api/forecast')).toBe('https://example.com/api/forecast')
  })

  it('reuses one idempotency key when a JSON POST is retried after a 5xx', async () => {
    const calls: Array<{ url: string; key: string | null }> = []
    const nativeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString()
      const headers = new Headers(input instanceof Request ? input.headers : init?.headers)
      calls.push({ url, key: headers.get('Idempotency-Key') })
      if (calls.length === 1) return new Response('{"detail":"temporary"}', { status: 503 })
      return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    vi.stubGlobal('window', {
      location: { origin: 'https://depthviz.uk' },
      fetch: nativeFetch,
    })

    installApiV1Transport()
    const response = await window.fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: 1 }),
    })

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toBe('/api/v1/reports')
    expect(calls[1].url).toBe('/api/v1/reports')
    expect(calls[0].key).toBeTruthy()
    expect(calls[1].key).toBe(calls[0].key)
  })
})
