/**
 * Regression tests for the API error-body parsing bug:
 *
 *   When the API returned a FastAPI-style error like
 *   `{"detail":"Weather service temporarily unavailable"}`, the frontend
 *   surfaced the raw JSON string to users (visible at the bottom of the
 *   home page below the DIVE / USE MY LOCATION buttons). parseErrorBody
 *   extracts the `detail` field so users see a clean sentence instead.
 */
import { describe, expect, test, vi, afterEach } from 'vitest'

const { getSessionMock, cacheGetMock, cacheSetMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(async () => ({ data: { session: null } })),
  cacheGetMock: vi.fn(() => null),
  cacheSetMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}))

vi.mock('./cache', () => ({
  cacheGet: cacheGetMock,
  cacheSet: cacheSetMock,
  cacheDelete: vi.fn(),
  cacheDeleteByPrefix: vi.fn(),
}))

import { getForecast, parseErrorBody, parseRetryAfter } from './api'

describe('parseErrorBody', () => {
  test('extracts FastAPI detail string', () => {
    expect(parseErrorBody('{"detail":"Weather service temporarily unavailable"}'))
      .toBe('Weather service temporarily unavailable')
  })

  test('extracts first msg from FastAPI validation error array', () => {
    const body = JSON.stringify({
      detail: [{ msg: 'field required', loc: ['body', 'lat'], type: 'value_error' }],
    })
    expect(parseErrorBody(body)).toBe('field required')
  })

  test('falls back to message field when detail is missing', () => {
    expect(parseErrorBody('{"message":"Something broke"}')).toBe('Something broke')
  })

  test('returns raw body when JSON has no usable field', () => {
    const body = '{"other":"value"}'
    expect(parseErrorBody(body)).toBe(body)
  })

  test('returns raw body for plain-text errors', () => {
    expect(parseErrorBody('Internal Server Error')).toBe('Internal Server Error')
  })

  test('returns raw body for malformed JSON', () => {
    expect(parseErrorBody('{not valid json')).toBe('{not valid json')
  })

  test('returns empty string for empty body', () => {
    expect(parseErrorBody('')).toBe('')
  })

  test('handles leading whitespace before JSON', () => {
    expect(parseErrorBody('   {"detail":"oops"}'))
      .toBe('oops')
  })
})

describe('parseRetryAfter', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    getSessionMock.mockResolvedValue({ data: { session: null } })
    cacheGetMock.mockReturnValue(null)
    cacheSetMock.mockReset()
  })

  test('returns null for a missing header', () => {
    expect(parseRetryAfter(null)).toBeNull()
  })

  test('parses delta-seconds', () => {
    expect(parseRetryAfter('30')).toBe(30)
    expect(parseRetryAfter('  5 ')).toBe(5)
  })

  test('parses an HTTP-date into remaining seconds', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:10 GMT')).toBe(10)
  })

  test('clamps a past HTTP-date to zero', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
    expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:00 GMT')).toBe(0)
  })

  test('returns null for unparseable values', () => {
    expect(parseRetryAfter('soon')).toBeNull()
  })

  test('does not retry aborted forecast requests', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getForecast(50.5, -2.5, 'Portland', 'ft', undefined, new AbortController().signal))
      .rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
