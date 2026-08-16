import type { Announcement } from '../types'

export function slugifyNewsTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'guide'
}

export function newsPath(article: Pick<Announcement, 'id' | 'title'>): string {
  return `/news/${article.id}/${slugifyNewsTitle(article.title)}`
}
