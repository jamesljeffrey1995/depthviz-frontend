import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getNewsArticle } from '../lib/api'
import { newsPath, slugifyNewsTitle } from '../lib/newsPath'
import { SITE_ORIGIN } from '../lib/pageMeta'
import type { Announcement } from '../types'
import styles from './NewsPage.module.css'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function setMeta(selector: string, value: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value)
}

export function NewsArticlePage() {
  const { id, slug } = useParams<{ id: string; slug?: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const articleId = Number(id)
    if (!Number.isInteger(articleId) || articleId < 1) {
      setError('This guide could not be found.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    getNewsArticle(articleId)
      .then(item => {
        if (cancelled) return
        setArticle(item)
        const canonicalPath = newsPath(item)
        if (slug !== slugifyNewsTitle(item.title)) {
          navigate(canonicalPath, { replace: true })
        }
      })
      .catch(() => { if (!cancelled) setError('This guide could not be found.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, navigate, slug])

  useEffect(() => {
    if (!article) return
    const description = article.summary || article.body.slice(0, 155)
    const title = `${article.title} — DepthViz`
    const canonicalUrl = `${SITE_ORIGIN}${newsPath(article)}`
    document.title = title
    setMeta('meta[name="description"]', description)
    setMeta('meta[property="og:title"]', title)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[property="og:type"]', 'article')
    setMeta('meta[property="og:url"]', canonicalUrl)
    setMeta('meta[name="twitter:title"]', title)
    setMeta('meta[name="twitter:description"]', description)
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonicalUrl)
  }, [article, slug])

  useEffect(() => {
    if (!error) return
    document.title = 'Guide Not Found — DepthViz'
    setMeta('meta[name="robots"]', 'noindex, follow')
  }, [error])

  if (loading) return <p className={styles.muted} role="status">Loading guide…</p>

  if (error || !article) {
    return (
      <div className={styles.emptyBox}>
        <h1 className={styles.emptyTitle}>Guide not found</h1>
        <p className={styles.muted}>{error || 'This guide is no longer available.'}</p>
        <Link className={styles.primaryAction} to="/news">Browse all guides</Link>
      </div>
    )
  }

  return (
    <article className={styles.articlePage}>
      <Link className={styles.backLink} to="/news">← News &amp; guides</Link>
      <header className={styles.articleHeader}>
        {article.category && <span className={styles.badge}>{article.category}</span>}
        <h1 className={styles.articleTitle}>{article.title}</h1>
        <p className={styles.meta}>{article.author_name} · {formatDate(article.created_at)}</p>
        {article.summary && <p className={styles.articleSummary}>{article.summary}</p>}
      </header>
      <div className={styles.articleBody}>{article.body}</div>
      <div className={styles.articleActions} role="group" aria-label="Use this guide">
        <Link className={styles.primaryAction} to="/forecast">Check your forecast</Link>
        <Link className={styles.secondaryAction} to="/report">Log what you found</Link>
      </div>
    </article>
  )
}
