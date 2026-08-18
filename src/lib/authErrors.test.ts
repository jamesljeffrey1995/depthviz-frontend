import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './authErrors'

describe('getAuthErrorMessage', () => {
  it('returns a helpful message for HTTP rate limits', () => {
    expect(getAuthErrorMessage({ status: 429, message: 'Too many requests' })).toBe(
      'Too many sign-in emails have been requested. Please wait a few minutes and try again.',
    )
  })

  it('recognises rate-limit messages without a status', () => {
    expect(getAuthErrorMessage(new Error('Email rate limit exceeded'))).toBe(
      'Too many sign-in emails have been requested. Please wait a few minutes and try again.',
    )
  })

  it('preserves other authentication errors', () => {
    expect(getAuthErrorMessage(new Error('Invalid email'))).toBe('Invalid email')
  })
})
