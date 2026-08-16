import { describe, expect, test } from 'vitest'
import { shiftIsoDate } from './dateOnly'

describe('shiftIsoDate', () => {
  test('moves across month and year boundaries', () => {
    expect(shiftIsoDate('2026-08-31', 1)).toBe('2026-09-01')
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31')
  })

  test('does not mutate invalid input', () => {
    expect(shiftIsoDate('not-a-date', 1)).toBe('not-a-date')
  })
})
