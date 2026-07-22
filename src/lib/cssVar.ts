/**
 * Resolve a CSS custom property to its concrete computed value from `:root`.
 *
 * Most of the app should reference tokens the normal way — `var(--ds-…)` in
 * CSS or an inline style — and never touch this. It exists for the handful of
 * contexts where `var()` genuinely cannot resolve because there is no element
 * for the cascade to act on:
 *
 *   - an SVG serialized into a `data:` URI (Leaflet marker `iconUrl`s), and
 *   - a `<canvas>` `fillStyle`.
 *
 * For those, read the token's value here and pass the returned string in.
 *
 * Only use this for tokens defined as a *direct* value (e.g. the `--ds-cat-*`
 * qualitative palette). A token defined as `var(--other)` can come back as the
 * unresolved reference depending on the browser, so resolve flat tokens only.
 * `fallback` covers SSR / a stylesheet that hasn't applied yet.
 */
export function resolveCssVar(name: string, fallback = ''): string {
  if (typeof document === 'undefined' || typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/**
 * Resolve several tokens at once into a `{ key: value }` map. Reads the
 * computed style of `:root` once and reuses it across every entry, and only
 * walks the object's own keys.
 */
export function resolveCssVars<K extends string>(
  entries: Record<K, string>,
  fallback = '',
): Record<K, string> {
  const root = typeof document !== 'undefined' && typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement)
    : null
  const out = {} as Record<K, string>
  for (const key of Object.keys(entries) as K[]) {
    out[key] = (root?.getPropertyValue(entries[key]).trim() || fallback)
  }
  return out
}
