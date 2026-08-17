import { describe, expect, test } from 'vitest'
import { getRouteTheme } from './routeTheme'

describe('route theme task registers', () => {
  test.each(['/forecast', '/map', '/tides', '/best', '/training', '/weight', '/history'])('%s uses deep water', path => {
    expect(getRouteTheme(path)).toBe('dark')
  })

  test.each(['/', '/feed', '/news', '/profile', '/competition', '/report'])('%s uses porcelain', path => {
    expect(getRouteTheme(path)).toBe('light')
  })
})
