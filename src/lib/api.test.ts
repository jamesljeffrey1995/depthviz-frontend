/**
 * Regression tests for the API error-body parsing bug:
 *
 *   When the API returned a FastAPI-style error like
 *   `{"detail":"Weather service temporarily unavailable"}`, the frontend
 *   surfaced the raw JSON string to users (visible at the bottom of the
 *   home page below the DIVE / USE MY LOCATION buttons). parseErrorBody
 *   extracts the `detail` field so users see a clean sentence instead.
 */
import { describe, expect, test } from 'vitest'
import { parseErrorBody } from './api'

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
