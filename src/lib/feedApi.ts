import { supabase } from './supabase'
import type { FeedItem } from '../types'

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')

export interface FeedPageResponse {
  items: FeedItem[]
  total: number
  next_cursor: string | null
}

export interface FeedPageParams {
  scope: 'all' | 'friends'
  filter_type: 'all' | 'reports' | 'catches'
  limit: number
  cursor?: string | null
}

/** Cursor-based activity feed client. The global API transport moves this
 * request onto /api/v1 and preserves auth/private-feed behaviour. */
export async function getFeedPage(params: FeedPageParams): Promise<FeedPageResponse> {
  const query = new URLSearchParams({
    scope: params.scope,
    filter_type: params.filter_type,
    limit: String(params.limit),
  })
  if (params.cursor) query.set('cursor', params.cursor)

  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

  const response = await fetch(`${API_BASE}/feed?${query}`, { headers })
  if (!response.ok) {
    const body = await response.text()
    let message = `Failed to load feed (${response.status})`
    try {
      const parsed = JSON.parse(body)
      if (typeof parsed?.detail === 'string') message = parsed.detail
    } catch {
      if (body.trim()) message = body.trim()
    }
    throw new Error(message)
  }

  const data = await response.json() as Partial<FeedPageResponse>
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: typeof data.total === 'number' ? data.total : 0,
    next_cursor: typeof data.next_cursor === 'string' ? data.next_cursor : null,
  }
}
