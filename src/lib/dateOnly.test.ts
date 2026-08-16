import { describe, expect, test } from 'vitest'
import { normalizeIsoDate, shiftIsoDate } from './dateOnly'

describe('normalizeIsoDate', () => {
  test('accepts date-only values and production-style ISO timestamps', () => {
    expect(normalizeIsoDate('2026-08-16')).toBe('2026-08-16')
    expect(normalizeIsoDate('2026-08-16T00:00:00+00:00')).toBe('2026-08-16')
  })

  test('rejects malformed and impossible calendar dates', () => {
    expect(normalizeIsoDate('not-a-date')).toBeNull()
    expect(normalizeIsoDate('2026-02-31T00:00:00Z')).toBeNull()
  })
})

describe('shiftIsoDate', () => {
  test('moves across month and year boundaries', () => {
    expect(shiftIsoDate('2026-08-31', 1)).toBe('2026-09-01')
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31')
  })

  test('does not mutate invalid input', () => {
    expect(shiftIsoDate('not-a-date', 1)).toBe('not-a-date')
  })
})
