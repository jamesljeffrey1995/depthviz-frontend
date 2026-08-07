import { describe, expect, test } from 'vitest'
import { ApiError, AuthError, RateLimitError, ServerError } from './api'
import { toUserFacingError } from './frontendErrors'

describe('toUserFacingError', () => {
  test('maps auth errors to re-auth prompt', () => {
    const out = toUserFacingError(new AuthError('expired'), 'profile')
    expect(out.requiresAuth).toBe(true)
    expect(out.status).toBe(401)
    expect(out.message).toContain('sign in again')
  })

  test('maps 429 errors with retry-after hints', () => {
    const out = toUserFacingError(new RateLimitError('Too many requests', 7), 'forecast')
    expect(out.status).toBe(429)
    expect(out.retryable).toBe(true)
    expect(out.message).toContain('7s')
  })

  test('maps server errors as retryable', () => {
    const out = toUserFacingError(new ServerError(503, 'Server unavailable'), 'map')
    expect(out.status).toBe(503)
    expect(out.retryable).toBe(true)
    expect(out.requiresAuth).toBe(false)
  })

  test('maps generic fetch-style failures to network copy', () => {
    const out = toUserFacingError(new TypeError('Failed to fetch'), 'forecast')
    expect(out.telemetryCode).toBe('network')
    expect(out.message).toContain('Network issue')
  })

  test('preserves API 4xx messages', () => {
    const out = toUserFacingError(new ApiError(404, 'Not found'), 'map')
    expect(out.status).toBe(404)
    expect(out.message).toBe('Not found')
  })
})
