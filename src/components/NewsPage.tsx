import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getNews, createNews, updateNews, deleteNews } from '../lib/api'
import type { Announcement } from '../types'
import { IconChevronDown, IconChevronUp } from './icons'
import styles from './NewsPage.module.css'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  isAdmin: boolean
}

const EMPTY = { title: '', summary: '', body: '', category: '', is_pinned: false, is_published: true }

export function NewsPage({ isAdmin }: Props) {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  // Client-side category filter. Empty string means "all".
  const [activeCategory, setActiveCategory] = useState('')
  // Cards render as a scannable index (title + excerpt); the full body only
  // expands on demand so the page never becomes a wall of text.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  function toggleExpanded(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Distinct categories present in the loaded posts, in first-seen order.
  const categories = Array.from(
    new Set(items.map(i => i.category).filter((c): c is string => !!c))
  )
  const visibleItems = activeCategory
    ? items.filter(i => i.category === activeCategory)
    : items

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    // Admins also see unpublished drafts so they can finish them.
    getNews({ includeUnpublished: isAdmin, limit: 100 })
      .then(setItems)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load news'))
      .finally(() => setLoading(false))
  }, [isAdmin])

  useEffect(() => { load() }, [load])

  function startCreate() {
    setEditingId(null)
    setDraft(EMPTY)
    setComposerOpen(true)
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id)
    setDraft({
      title: a.title,
      summary: a.summary ?? '',
      body: a.body,
      category: a.category ?? '',
      is_pinned: a.is_pinned,
      is_published: a.is_published,
    })
    setComposerOpen(true)
  }

  async function save() {
    if (!draft.title.trim() || !draft.body.trim()) return
    setSaving(true)
    setError('')
    // Optional text fields: blank → null so we store the API's null rather than
    // an empty string for these nullable columns.
    const payload = {
      ...draft,
      summary: draft.summary.trim() || null,
      category: draft.category.trim() || null,
    }
    try {
      if (editingId !== null) {
        await updateNews(editingId, payload)
      } else {
        await createNews(payload)
      }
      setComposerOpen(false)
      setDraft(EMPTY)
      setEditingId(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this announcement?')) return
    setError('')
    try {
      await deleteNews(id)
      setItems(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>DepthViz knowledge</p>
          <h1 className={styles.title}>News &amp; Guides</h1>
          <p className={styles.intro}>
            Practical visibility explainers, model updates and community knowledge for planning a better dive.
          </p>
        </div>
        {isAdmin && (
          <button className={styles.newBtn} onClick={startCreate}>+ New post</button>
        )}
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {isAdmin && composerOpen && (
        <div className={styles.composer}>
          <input
            className={styles.input}
            placeholder="Title"
            value={draft.title}
            maxLength={200}
            onChange={e => setDraft({ ...draft, title: e.target.value })}
          />
          <input
            className={styles.input}
            placeholder="Category (optional, e.g. Gear & Beginner Tips)"
            value={draft.category}
            maxLength={100}
            onChange={e => setDraft({ ...draft, category: e.target.value })}
          />
          <input
            className={styles.input}
            placeholder="One-line summary (optional)"
            value={draft.summary}
            maxLength={300}
            onChange={e => setDraft({ ...draft, summary: e.target.value })}
          />
          <textarea
            className={styles.textarea}
            placeholder="Write your announcement…"
            value={draft.body}
            rows={6}
            onChange={e => setDraft({ ...draft, body: e.target.value })}
          />
          <div className={styles.composerOpts}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={draft.is_pinned}
                onChange={e => setDraft({ ...draft, is_pinned: e.target.checked })}
              /> Pin to top
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={e => setDraft({ ...draft, is_published: e.target.checked })}
              /> Published
            </label>
            <div className={styles.composerActions}>
              <button className={styles.ghostBtn} onClick={() => setComposerOpen(false)} disabled={saving}>Cancel</button>
              <button className={styles.newBtn} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editingId !== null ? 'Update' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div className={styles.filters} role="group" aria-label="Filter by category">
          <button
            type="button"
            aria-pressed={activeCategory === ''}
            className={activeCategory === '' ? styles.chipActive : styles.chip}
            onClick={() => setActiveCategory('')}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c}
              type="button"
              aria-pressed={activeCategory === c}
              className={activeCategory === c ? styles.chipActive : styles.chip}
              onClick={() => setActiveCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className={styles.muted} role="status">Loading news…</p>
      ) : visibleItems.length === 0 ? (
        <div className={styles.emptyBox}>
          <p className={styles.emptyTitle}>
            {activeCategory ? `No posts in “${activeCategory}” yet` : 'No announcements yet'}
          </p>
          <p className={styles.muted}>
            {activeCategory
              ? 'Try another category, or check back soon.'
              : 'News about forecasts, spots and the community will appear here.'}
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {visibleItems.map(a => {
            const expanded = expandedIds.has(a.id)
            const excerpt = a.summary || `${a.body.slice(0, 220)}${a.body.length > 220 ? '…' : ''}`
            return (
              <li key={a.id} className={styles.card}>
                {(a.is_pinned || !a.is_published || a.category) && (
                  <div className={styles.cardHead}>
                    {a.is_pinned && <span className={styles.pin}>Pinned</span>}
                    {!a.is_published && <span className={styles.draft}>Draft</span>}
                    {a.category && <span className={styles.badge}>{a.category}</span>}
                  </div>
                )}
                <h2 className={styles.cardTitle}>{a.title}</h2>
                <div className={styles.meta}>
                  {a.author_name} · {formatDate(a.created_at)}
                </div>
                {expanded ? (
                  <>
                    {a.summary && <p className={styles.summary}>{a.summary}</p>}
                    <p className={styles.body}>{a.body}</p>
                  </>
                ) : (
                  <p className={styles.summary}>{excerpt}</p>
                )}
                <button
                  type="button"
                  className={styles.readBtn}
                  onClick={() => toggleExpanded(a.id)}
                  aria-expanded={expanded}
                >
                  {expanded ? <><IconChevronUp width={14} height={14} /> Show less</> : <><IconChevronDown width={14} height={14} /> Read article</>}
                </button>
                {expanded && (
                  <div className={styles.articleActions} role="group" aria-label="Use this guide">
                    <Link className={styles.primaryAction} to="/forecast">Check your forecast</Link>
                    <Link className={styles.secondaryAction} to="/report">Log what you found</Link>
                  </div>
                )}
                {isAdmin && (
                  <div className={styles.adminRow}>
                    <button className={styles.linkBtn} onClick={() => startEdit(a)}>Edit</button>
                    <button className={styles.linkBtnDanger} onClick={() => remove(a.id)}>Delete</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
