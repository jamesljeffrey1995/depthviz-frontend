import { describe, expect, test } from 'vitest'
import { canonicalUrlForPath, getPageMeta } from './pageMeta'

describe('getPageMeta', () => {
  test('returns route-specific titles for core pages', () => {
    expect(getPageMeta('/').title).toMatch(/Underwater Visibility/)
    expect(getPageMeta('/forecast').title).toBe('Dive Forecast — DepthViz')
    expect(getPageMeta('/tides').title).toBe('Tides and Currents — DepthViz')
    expect(getPageMeta('/news').title).toBe('News & Guides — DepthViz')
  })

  test('handles dynamic, legal and unknown routes', () => {
    expect(getPageMeta('/forum/general').title).toBe('Discussion — DepthViz')
    expect(getPageMeta('/news/42/example-guide').ogType).toBe('article')
    expect(getPageMeta('/legal/privacy').title).toBe('Privacy — DepthViz')
    expect(getPageMeta('/does-not-exist').title).toBe('Page Not Found — DepthViz')
    expect(getPageMeta('/does-not-exist').robots).toBe('noindex, follow')
  })

  test('builds route-specific canonical URLs', () => {
    expect(canonicalUrlForPath('/news/42/example-guide'))
      .toBe('https://depthviz.uk/news/42/example-guide')
    expect(canonicalUrlForPath('//untrusted.example/guide')).toBe('https://depthviz.uk/')
  })
})
