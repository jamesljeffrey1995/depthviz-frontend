import { describe, expect, test } from 'vitest'
import { newsPath, slugifyNewsTitle } from './newsPath'

describe('newsPath', () => {
  test('creates a stable, readable route from an article id and title', () => {
    expect(newsPath({ id: 42, title: 'Wind & Visibility: A diver’s guide' }))
      .toBe('/news/42/wind-and-visibility-a-diver-s-guide')
  })

  test('normalises accents, punctuation and empty titles', () => {
    expect(slugifyNewsTitle('Café swell — explained')).toBe('cafe-swell-explained')
    expect(slugifyNewsTitle('---')).toBe('guide')
  })
})
