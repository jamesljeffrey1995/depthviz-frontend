import { describe, expect, test } from 'vitest'
import forumStyles from '../components/ForumPage.module.css'
import weeklyStyles from '../components/WeeklyOverview.module.css'

describe('critical CSS module contracts', () => {
  test('weekly wind layout classes exist', () => {
    for (const key of ['windRow', 'windVal', 'windSpeed', 'gust', 'windUnit', 'windDirLabel']) {
      expect(weeklyStyles[key], `WeeklyOverview.module.css is missing .${key}`).toBeTruthy()
    }
  })

  test('forum category and empty-state classes exist', () => {
    for (const key of ['catGlyph', 'catCta', 'startHint', 'emptyBox', 'emptyTitle']) {
      expect(forumStyles[key], `ForumPage.module.css is missing .${key}`).toBeTruthy()
    }
  })
})
