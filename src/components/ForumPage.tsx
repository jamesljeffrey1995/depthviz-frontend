import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import {
  getForumCategories, getForumCategory, getForumThread,
  createForumThread, createForumPost, deleteForumPost,
} from '../lib/api'
import type { ForumCategory, ForumCategoryView, ForumThreadDetail } from '../types'
import { IconChevronLeft, IconPlus } from './icons'
import styles from './ForumPage.module.css'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

interface ForumProps {
  user: User | null
  onShowAuth: () => void
}

// ── Forum index: list of categories ────────────────────────────────────────
export function ForumIndex() {
  const navigate = useNavigate()
  const [cats, setCats] = useState<ForumCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getForumCategories()
      .then(setCats)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load categories'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Discussions</h1>
      <p className={styles.intro}>
        Swap notes on spots, gear, safety and catches with other spearos and freedivers.
      </p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <ul className={styles.catList}>
          {cats.map(c => (
            <li key={c.id}>
              <button className={styles.catItem} onClick={() => navigate(`/forum/${c.slug}`)}>
                <div className={styles.catMain}>
                  <span className={styles.catName}>{c.name}</span>
                  {c.description && <span className={styles.catDesc}>{c.description}</span>}
                </div>
                <span className={styles.catCount}>{c.thread_count} {c.thread_count === 1 ? 'thread' : 'threads'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Category view: threads + new-thread form ────────────────────────────────
export function ForumCategoryPage({ user, onShowAuth }: ForumProps) {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [view, setView] = useState<ForumCategoryView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    getForumCategory(slug, { limit: 50 })
      .then(setView)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => { load() }, [load])

  function openComposer() {
    if (!user) { onShowAuth(); return }
    setComposerOpen(true)
  }

  async function submit() {
    if (title.trim().length < 3 || !body.trim()) return
    setPosting(true)
    setError('')
    try {
      const created = await createForumThread(slug, title.trim(), body.trim())
      navigate(`/forum/thread/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post')
      setPosting(false)
    }
  }

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={() => navigate('/forum')}>
        <IconChevronLeft width={14} height={14} /> All categories
      </button>
      <header className={styles.head}>
        <h1 className={styles.pageTitle}>{view?.category.name ?? 'Loading…'}</h1>
        <button className={styles.primaryBtn} onClick={openComposer}>
          <IconPlus width={14} height={14} /> New thread
        </button>
      </header>
      {view?.category.description && <p className={styles.intro}>{view.category.description}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      {composerOpen && (
        <div className={styles.composer}>
          <input
            className={styles.input}
            placeholder="Thread title"
            value={title}
            maxLength={200}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className={styles.textarea}
            placeholder="What's on your mind?"
            rows={5}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <div className={styles.composerActions}>
            <button className={styles.ghostBtn} onClick={() => setComposerOpen(false)} disabled={posting}>Cancel</button>
            <button className={styles.primaryBtn} onClick={submit} disabled={posting}>
              {posting ? 'Posting…' : 'Post thread'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : view && view.threads.length === 0 ? (
        <p className={styles.muted}>No threads yet — start the first one.</p>
      ) : (
        <ul className={styles.threadList}>
          {view?.threads.map(t => (
            <li key={t.id}>
              <button className={styles.threadItem} onClick={() => navigate(`/forum/thread/${t.id}`)}>
                <div className={styles.threadMain}>
                  <span className={styles.threadTitle}>
                    {t.is_pinned && <span className={styles.pin}>Pinned</span>}
                    {t.is_locked && <span className={styles.lock}>Locked</span>}
                    {t.title}
                  </span>
                  <span className={styles.threadMeta}>by {t.author_name} · {timeAgo(t.last_post_at)}</span>
                </div>
                <span className={styles.replyCount}>{t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Thread view: posts + reply box ──────────────────────────────────────────
export function ForumThreadPage({ user, onShowAuth }: ForumProps) {
  const { id = '' } = useParams<{ id: string }>()
  const threadId = Number(id)
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ForumThreadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [posting, setPosting] = useState(false)

  const load = useCallback(() => {
    if (!Number.isInteger(threadId) || threadId <= 0) {
      setDetail(null)
      setError('Thread not found.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    getForumThread(threadId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load thread'))
      .finally(() => setLoading(false))
  }, [threadId])

  useEffect(() => { load() }, [load])

  async function submitReply() {
    if (!user) { onShowAuth(); return }
    if (!reply.trim()) return
    setPosting(true)
    setError('')
    try {
      const post = await createForumPost(threadId, reply.trim())
      setDetail(prev => prev ? { ...prev, posts: [...prev.posts, post] } : prev)
      setReply('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reply')
    } finally {
      setPosting(false)
    }
  }

  async function removePost(postId: number, isOpener: boolean) {
    if (!confirm(isOpener ? 'Delete this thread?' : 'Delete this post?')) return
    setError('')
    try {
      await deleteForumPost(postId)
      if (isOpener) {
        navigate('/forum')
      } else {
        setDetail(prev => prev ? { ...prev, posts: prev.posts.filter(p => p.id !== postId) } : prev)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  if (loading) return <div className={styles.container}><p className={styles.muted}>Loading…</p></div>
  if (!detail) return <div className={styles.container}><p className={styles.error}>{error || 'Thread not found.'}</p></div>

  const { thread, posts } = detail
  const categorySlug = thread.category?.slug

  return (
    <div className={styles.container}>
      <button
        className={styles.back}
        onClick={() => navigate(categorySlug ? `/forum/${categorySlug}` : '/forum')}
      >
        <IconChevronLeft width={14} height={14} /> {thread.category?.name ?? 'Forum'}
      </button>
      <h1 className={styles.threadHeading}>
        {thread.is_pinned && <span className={styles.pin}>Pinned</span>}
        {thread.is_locked && <span className={styles.lock}>Locked</span>}
        {thread.title}
      </h1>
      {error && <p className={styles.error} role="alert">{error}</p>}

      <ul className={styles.postList}>
        {posts.map((p, i) => {
          const canDelete = !!user && (user.id === p.author_uid)
          return (
            <li key={p.id} className={styles.post}>
              <div className={styles.postHead}>
                <span className={styles.postAuthor}>{p.author_name}</span>
                <span className={styles.postDate}>{timeAgo(p.created_at)}</span>
                {canDelete && (
                  <button className={styles.deleteBtn} onClick={() => removePost(p.id, i === 0)}>
                    Delete
                  </button>
                )}
              </div>
              <p className={styles.postBody}>{p.body}</p>
            </li>
          )
        })}
      </ul>

      {thread.is_locked ? (
        <p className={styles.muted}>This thread is locked — no new replies.</p>
      ) : user ? (
        <div className={styles.replyBox}>
          <textarea
            className={styles.textarea}
            placeholder="Write a reply…"
            rows={4}
            value={reply}
            onChange={e => setReply(e.target.value)}
          />
          <div className={styles.composerActions}>
            <button className={styles.primaryBtn} onClick={submitReply} disabled={posting}>
              {posting ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.primaryBtn} onClick={onShowAuth}>Sign in to reply</button>
      )}
    </div>
  )
}
