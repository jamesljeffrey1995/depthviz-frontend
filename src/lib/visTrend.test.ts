import { describe, expect, test } from 'vitest'
import type { DayForecast } from '../types'
import { categoriseVis, visForDay, buildVisSummary } from './visTrend'

/** Minimal DayForecast factory — only the fields visTrend reads matter. */
function day(date: string, vis: number, corrected: number | null = null): DayForecast {
  return {
    date,
    is_forecast: true,
    vis_estimate: vis,
    vis_corrected: corrected,
  } as DayForecast
}

describe('categoriseVis', () => {
  test('buckets by the getVerdict thresholds', () => {
    expect(categoriseVis(12)).toBe('good')
    expect(categoriseVis(8)).toBe('good')
    expect(categoriseVis(7.9)).toBe('marginal')
    expect(categoriseVis(5)).toBe('marginal')
    expect(categoriseVis(4.9)).toBe('poor')
    expect(categoriseVis(0)).toBe('poor')
  })
})

describe('visForDay', () => {
  test('prefers the AI-corrected value when present', () => {
    expect(visForDay(day('2026-01-01', 10, 6))).toBe(6)
    expect(visForDay(day('2026-01-01', 10, null))).toBe(10)
  })
})

describe('buildVisSummary', () => {
  // 2026-01-02 = Fri, 03 = Sat, 04 = Sun, 05 = Mon
  test('good run followed by a drop reports deterioration', () => {
    const days = [day('2026-01-02', 10), day('2026-01-03', 9), day('2026-01-04', 3)]
    expect(buildVisSummary(days)).toBe('Good visibility expected Fri–Sat, deteriorating Sun.')
  })

  test('poor start improving to good reports the turnaround', () => {
    const days = [day('2026-01-02', 3), day('2026-01-03', 4), day('2026-01-04', 9)]
    expect(buildVisSummary(days)).toBe('Improving — good visibility expected from Sun.')
  })

  test('all-good forecast gives a clean range', () => {
    const days = [day('2026-01-02', 10), day('2026-01-03', 11), day('2026-01-04', 9)]
    expect(buildVisSummary(days)).toBe('Good visibility expected Fri–Sun.')
  })

  test('single good day uses one weekday, not a range', () => {
    expect(buildVisSummary([day('2026-01-02', 10)])).toBe('Good visibility expected Fri.')
  })

  test('marginal-only forecast still produces a marginal sentence', () => {
    const days = [day('2026-01-02', 6), day('2026-01-03', 7)]
    expect(buildVisSummary(days)).toBe('Marginal visibility expected Fri–Sat.')
  })

  test('all-poor forecast produces the poor sentence', () => {
    const days = [day('2026-01-02', 2), day('2026-01-03', 1)]
    expect(buildVisSummary(days)).toBe('Poor visibility expected across the forecast — conditions look unsuitable.')
  })

  test('uses the corrected value for categorisation', () => {
    // raw says good, corrected says poor → poor wins
    const days = [day('2026-01-02', 12, 2), day('2026-01-03', 12, 1)]
    expect(buildVisSummary(days)).toBe('Poor visibility expected across the forecast — conditions look unsuitable.')
  })

  test('empty series returns empty string', () => {
    expect(buildVisSummary([])).toBe('')
  })
})
