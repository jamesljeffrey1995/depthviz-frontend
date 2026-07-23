import { describe, it, expect } from 'vitest'
import { fmtCompact, fmtRelative, fmtTime } from './trafficPrimitives'

describe('traffic formatting helpers', () => {
  it('fmtCompact abbreviates large numbers', () => {
    expect(fmtCompact(0)).toBe('0')
    expect(fmtCompact(999)).toBe('999')
    expect(fmtCompact(1500)).toBe('1.5k')
    expect(fmtCompact(2_400_000)).toBe('2.4M')
    expect(fmtCompact(null)).toBe('—')
    expect(fmtCompact(undefined)).toBe('—')
  })

  it('fmtRelative renders coarse relative times', () => {
    const now = Date.now()
    expect(fmtRelative(null)).toBe('—')
    expect(fmtRelative(new Date(now - 30_000).toISOString())).toMatch(/s ago$/)
    expect(fmtRelative(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago')
    expect(fmtRelative(new Date(now - 3 * 3600_000).toISOString())).toBe('3h ago')
    expect(fmtRelative(new Date(now - 2 * 86400_000).toISOString())).toBe('2d ago')
  })

  it('fmtTime returns empty string for null', () => {
    expect(fmtTime(null)).toBe('')
    expect(fmtTime(new Date().toISOString())).toMatch(/\d/)
  })
})
