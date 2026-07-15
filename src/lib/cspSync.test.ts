import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// The Content-Security-Policy is duplicated across four artefacts that different
// hosting layers consume:
//   - vite.config.ts   (cspValue) — dev/preview server headers
//   - public/_headers  — Cloudflare/Netlify
//   - index.html       — inline <meta> fallback
//   - nginx.conf.example — self-hosted nginx
// Historically these drifted (issue #156), so satellite tiles were blocked on
// nginx while other hosts were over-permissive. This test pins them to a single
// canonical directive set so any future edit that touches only one copy fails.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Parse a CSP string into a map of directive -> sorted source list. */
function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const [name, ...sources] = tokens
    out[name] = sources.sort()
  }
  return out
}

/** Extract the CSP value from a file's raw contents. */
function extractCsp(file: string): string {
  const raw = readFileSync(resolve(repoRoot, file), 'utf8')

  if (file === 'vite.config.ts') {
    // cspValue is an array of directive strings joined with '; '
    const start = raw.indexOf('const cspValue = [')
    const end = raw.indexOf('].join', start)
    const block = raw.slice(start, end)
    // Only lines that are a lone quoted directive (skip // comment lines that
    // happen to contain double-quoted prose).
    const directives = block
      .split('\n')
      .map((l) => l.match(/^\s*"([^"]+)",?\s*$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1])
    return directives.join('; ')
  }

  if (file === 'public/_headers') {
    const line = raw.split('\n').find((l) => l.includes('Content-Security-Policy:'))
    return (line ?? '').split('Content-Security-Policy:')[1]?.trim() ?? ''
  }

  if (file === 'index.html') {
    const m = raw.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/)
    return m?.[1] ?? ''
  }

  if (file === 'nginx.conf.example') {
    // add_header Content-Security-Policy "...\ multi-line ..." always;
    const m = raw.match(/add_header\s+Content-Security-Policy\s+"([\s\S]*?)"\s*always;/)
    // strip nginx line-continuation backslashes and collapse whitespace
    return (m?.[1] ?? '').replace(/\\/g, ' ').replace(/\s+/g, ' ').trim()
  }

  throw new Error(`no extractor for ${file}`)
}

// index.html <meta> and (per convention) most hosts cannot express
// frame-ancestors via <meta>; ignore that one directive when comparing so the
// meta copy isn't forced to carry something it can't enforce.
function withoutFrameAncestors(d: Record<string, string[]>): Record<string, string[]> {
  const { 'frame-ancestors': _omit, ...rest } = d
  return rest
}

describe('Content-Security-Policy stays in sync across all copies', () => {
  const canonical = withoutFrameAncestors(parseCsp(extractCsp('vite.config.ts')))

  it('the canonical policy hardens object-src and base-uri', () => {
    expect(canonical['object-src']).toEqual(["'none'"])
    expect(canonical['base-uri']).toEqual(["'self'"])
  })

  for (const file of ['public/_headers', 'index.html', 'nginx.conf.example']) {
    it(`${file} matches the canonical CSP`, () => {
      expect(withoutFrameAncestors(parseCsp(extractCsp(file)))).toEqual(canonical)
    })
  }
})
