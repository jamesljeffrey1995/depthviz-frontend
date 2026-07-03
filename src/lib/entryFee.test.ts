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
    expect(isFreeEntry('Free entry')).toBe(true)
  })

  test('detects a zero amount even with a trailing suffix', () => {
    // The field placeholder suggests a "£20 per person" style, so a free event
    // is commonly written "£0 per person".
    expect(isFreeEntry('£0 per person')).toBe(true)
    expect(isFreeEntry('0 per diver')).toBe(true)
    expect(isFreeEntry('£0.00 per person')).toBe(true)
  })

  test('treats a real fee as not free', () => {
    expect(isFreeEntry('20')).toBe(false)
    expect(isFreeEntry('£20')).toBe(false)
    expect(isFreeEntry('£0.50')).toBe(false)
    expect(isFreeEntry('25 per diver')).toBe(false)
    expect(isFreeEntry('£20 per person')).toBe(false)
    expect(isFreeEntry('£0.50 per person')).toBe(false)
  })

  test('treats blank / unset fees as unspecified, not free', () => {
    expect(isFreeEntry(null)).toBe(false)
    expect(isFreeEntry(undefined)).toBe(false)
    expect(isFreeEntry('')).toBe(false)
    expect(isFreeEntry('   ')).toBe(false)
    expect(isFreeEntry('£')).toBe(false)
  })
})
