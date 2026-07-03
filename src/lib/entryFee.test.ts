import { describe, expect, test } from 'vitest'

import { isFreeEntry } from './entryFee'

describe('isFreeEntry', () => {
  test('treats explicit zero fees as free', () => {
    expect(isFreeEntry('0')).toBe(true)
    expect(isFreeEntry('£0')).toBe(true)
    expect(isFreeEntry('$0')).toBe(true)
    expect(isFreeEntry('€0')).toBe(true)
    expect(isFreeEntry('0.00')).toBe(true)
    expect(isFreeEntry('£0.00')).toBe(true)
    expect(isFreeEntry(' 0 ')).toBe(true)
  })

  test('treats the word "free" as free, case-insensitively', () => {
    expect(isFreeEntry('Free')).toBe(true)
    expect(isFreeEntry('FREE')).toBe(true)
    expect(isFreeEntry('free')).toBe(true)
  })

  test('treats a real fee as not free', () => {
    expect(isFreeEntry('20')).toBe(false)
    expect(isFreeEntry('£20')).toBe(false)
    expect(isFreeEntry('£0.50')).toBe(false)
    expect(isFreeEntry('25 per diver')).toBe(false)
  })

  test('treats blank / unset fees as unspecified, not free', () => {
    expect(isFreeEntry(null)).toBe(false)
    expect(isFreeEntry(undefined)).toBe(false)
    expect(isFreeEntry('')).toBe(false)
    expect(isFreeEntry('   ')).toBe(false)
    expect(isFreeEntry('£')).toBe(false)
  })
})
