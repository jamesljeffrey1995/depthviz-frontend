import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

// §6.3 / §12 / §13: the type scale is fixed and the smallest legal role is the
// 12px label (`--ds-text-label`). Sub-12px text is unreadable in bright sunlight
// with wet hands — §13 frames that as a safety defect, not a cosmetic one — and
// a raw px size can't be themed or contrast-audited. Issue #257 replaced 360+
// sub-12px declarations with tokens; this guard keeps them from creeping back.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const componentsDir = resolve(repoRoot, 'src/components')

/** Recursively collect every *.module.css under a directory. */
function collectModuleCss(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectModuleCss(full))
    else if (entry.name.endsWith('.module.css')) out.push(full)
  }
  return out
}

// Matches a font-size declaration below the 12px floor — any 1- or 2-digit px
// value under 12 (…7px, 8px, …, 11px). Anchored on the unit so 12px+ and
// 100px/110px etc. are not matched.
const SUB_12PX = /font-size:\s*(?:[0-9]|1[01])px\b/g

describe('component type scale never drops below the 12px readability floor', () => {
  const files = collectModuleCss(componentsDir)

  it('finds component CSS modules to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('has no sub-12px raw font-size in any component module (use --ds-text-* tokens)', () => {
    const offenders: string[] = []
    for (const file of files) {
      const raw = readFileSync(file, 'utf8')
      const matches = raw.match(SUB_12PX)
      if (matches) {
        offenders.push(`${relative(repoRoot, file)}: ${matches.join(', ')}`)
      }
    }
    expect(offenders, `sub-12px font-size found:\n${offenders.join('\n')}`).toEqual([])
  })
})
