import { describe, test, expect } from 'vitest'
import { resolveCssVar, resolveCssVars } from './cssVar'

/**
 * These cover the deterministic contract the marker code relies on: an
 * unresolved token (unset, or no stylesheet applied) always falls back to the
 * provided value rather than returning an empty string, so a marker never
 * renders with an empty fill. Actual computed-value resolution is a browser
 * behaviour exercised at runtime, not in jsdom.
 */

describe('resolveCssVar', () => {
  test('returns the fallback when the property is not set', () => {
    expect(resolveCssVar('--definitely-not-a-real-token', '#123456')).toBe('#123456')
  })

  test('fallback defaults to an empty string when omitted', () => {
    expect(resolveCssVar('--definitely-not-a-real-token')).toBe('')
  })
})

describe('resolveCssVars', () => {
  test('maps each key through, applying the shared fallback', () => {
    const out = resolveCssVars(
      { primary: '--nope-1', secondary: '--nope-2' },
      '#000000',
    )
    expect(out).toEqual({ primary: '#000000', secondary: '#000000' })
  })

  test('preserves the key set', () => {
    const out = resolveCssVars({ a: '--x', b: '--y', c: '--z' }, '#fff')
    expect(Object.keys(out).sort()).toEqual(['a', 'b', 'c'])
  })
})
