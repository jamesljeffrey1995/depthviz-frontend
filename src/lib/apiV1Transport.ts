const API_MOUNT = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '') || '/api'

const CANONICAL_ROUTE_REWRITES: Array<[RegExp, string]> = [
  [/^\/locations\/(\d+)\/vote$/, '/locations/$1/votes'],
  [/^\/social\/friend-request$/, '/social/friend-requests'],
  [/^\/admin\/competition\/(\d+)\/auto-pair-buddies$/, '/admin/competition/$1/buddy-pairings/auto'],
  [/^\/admin\/analytics\/alerts\/(\d+)\/dismiss$/, '/admin/analytics/alerts/$1/dismissals'],
  [/^\/admin\/ml\/retrain$/, '/admin/ml/training-runs'],
]

function mountUrl(): URL {
  return new URL(API_MOUNT, window.location.origin)
}

function versionedMountPath(pathname: string): string {
  const mountPath = pathname === '/' ? '' : pathname.replace(/\/+$/, '')
  return mountPath.endsWith('/api') ? `${mountPath}/v1` : `${mountPath}/api/v1`
}

function canonicalizeRoute(route: string): string {
  for (const [pattern, replacement] of CANONICAL_ROUTE_REWRITES) {
    if (pattern.test(route)) return route.replace(pattern, replacement)
  }
  return route
}

/**
 * Rewrite a legacy DepthViz client URL onto the canonical /api/v1 namespace.
 * URLs outside VITE_API_URL are returned untouched (Supabase, Open-Meteo, etc.).
 */
export function rewriteDepthVizApiUrl(input: string): string {
  const mount = mountUrl()
  const url = new URL(input, window.location.origin)
  if (url.origin !== mount.origin) return input

  const mountPath = mount.pathname === '/' ? '' : mount.pathname.replace(/\/+$/, '')
  const versionedPath = versionedMountPath(mount.pathname)

  let route: string
  if (url.pathname === versionedPath || url.pathname.startsWith(`${versionedPath}/`)) {
    route = url.pathname.slice(versionedPath.length) || '/'
  } else if (mountPath && (url.pathname === mountPath || url.pathname.startsWith(`${mountPath}/`))) {
    route = url.pathname.slice(mountPath.length) || '/'
  } else if (!mountPath) {
    route = url.pathname
  } else {
    return input
  }

  route = canonicalizeRoute(route)
  url.pathname = `${versionedPath}${route === '/' ? '' : route}`

  // Preserve relative URLs when the caller supplied one; this keeps the browser
  // on the current origin and avoids changing the deployment/reverse-proxy model.
  if (input.startsWith('/')) return `${url.pathname}${url.search}${url.hash}`
  return url.toString()
}

function isDepthVizApiUrl(input: string): boolean {
  return rewriteDepthVizApiUrl(input) !== input || (() => {
    const mount = mountUrl()
    const url = new URL(input, window.location.origin)
    const versionedPath = versionedMountPath(mount.pathname)
    return url.origin === mount.origin && (url.pathname === versionedPath || url.pathname.startsWith(`${versionedPath}/`))
  })()
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
  return headers
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError'
}

let installed = false

/**
 * Installs one narrow fetch wrapper for DepthViz backend traffic only.
 *
 * - routes first-party API calls through /api/v1
 * - maps deprecated aliases to canonical resource paths
 * - attaches one Idempotency-Key to JSON POSTs
 * - retries a keyed POST once on a network error or 5xx, reusing the same key
 *
 * Non-DepthViz requests are passed through byte-for-byte to the native fetch.
 */
export function installApiV1Transport(): void {
  if (installed) return
  installed = true

  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = input instanceof Request ? input.url : input.toString()
    if (!isDepthVizApiUrl(rawUrl)) return nativeFetch(input, init)

    const rewrittenUrl = rewriteDepthVizApiUrl(rawUrl)
    const method = requestMethod(input, init)
    const headers = requestHeaders(input, init)
    const contentType = headers.get('Content-Type') ?? ''
    const keyedPost = method === 'POST' && (contentType.includes('application/json') || contentType === '')

    if (keyedPost && !headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', newIdempotencyKey())
    }

    const attempts = keyedPost ? 2 : 1
    let lastError: unknown

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        let response: Response
        if (input instanceof Request) {
          const request = new Request(rewrittenUrl, input.clone())
          headers.forEach((value, key) => request.headers.set(key, value))
          response = await nativeFetch(request, init)
        } else {
          response = await nativeFetch(rewrittenUrl, { ...init, headers })
        }

        if (keyedPost && response.status >= 500 && attempt < attempts - 1) continue
        return response
      } catch (error) {
        if (isAbortError(error)) throw error
        lastError = error
        if (attempt >= attempts - 1) throw error
      }
    }

    throw lastError ?? new Error('DepthViz API request failed')
  }
}
