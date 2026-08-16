import { describe, expect, test } from 'vitest'
import { getPageMeta } from './pageMeta'

describe('getPageMeta', () => {
  test('returns route-specific titles for core pages', () => {
    expect(getPageMeta('/').title).toMatch(/Underwater Visibility/)
    expect(getPageMeta('/forecast').title).toBe('Dive Forecast — DepthViz')
    expect(getPageMeta('/tides').title).toBe('Tides and Currents — DepthViz')
  })

  test('handles dynamic, legal and unknown routes', () => {
    expect(getPageMeta('/forum/general').title).toBe('Discussion — DepthViz')
    expect(getPageMeta('/legal/privacy').title).toBe('Privacy — DepthViz')
    expect(getPageMeta('/does-not-exist').title).toBe('Page Not Found — DepthViz')
  })
})
