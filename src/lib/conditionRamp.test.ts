import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  AA_CONTRAST,
  CHASSIS_SURFACES,
  CLARITY_STEPS,
  FACE_SURFACES,
  MIN_STEP_SEPARATION,
  chroma,
  contrastRatio,
  relativeLuminance,
} from './conditionRamp'

// The water-clarity ramp is declared once, in CSS, and consumed by ~200
// `var(--sev-*)` references across 30-odd modules. That makes it cheap to
// retune and easy to break: any future edit that reaches for a more "obvious"
// red-to-green scale would be a one-line change with no visible failure, and
// the resulting ramp would be unreadable for red-green colour deficiency and
// unreadable for everyone in greyscale.
//
// So the CSS stays the single source of truth and this test reads it back,
// applying the desaturation test as an assertion rather than as advice. Same
// approach as cspSync.test.ts, which pins the CSP across its four copies.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const indexCss = readFileSync(resolve(repoRoot, 'src/index.css'), 'utf8')

/** Pull a custom property's literal hex value out of the stylesheet. */
function token(name: string): string {
  const match = indexCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))
  if (!match?.[1]) throw new Error(`--${name} is not declared as a literal hex in index.css`)
  return match[1]
}

const REGISTERS = [
  { label: 'chassis (--sev-*)', suffix: '', surfaces: CHASSIS_SURFACES },
  { label: 'face (--sev-*-face)', suffix: '-face', surfaces: FACE_SURFACES },
] as const

describe.each(REGISTERS)('water-clarity ramp — $label', ({ suffix, surfaces }) => {
  const ramp = CLARITY_STEPS.map(step => ({ step, hex: token(`sev-${step}${suffix}`) }))

  it('climbs monotonically in luminance from murkiest to clearest', () => {
    // The whole point: clarity is a magnitude, so it must be encoded in
    // lightness — not only in hue. Desaturate the ramp and it still reads
    // in order.
    const luminances = ramp.map(({ hex }) => relativeLuminance(hex))
    const sorted = [...luminances].sort((a, b) => a - b)
    expect(luminances).toEqual(sorted)
  })

  it('separates adjacent steps enough to survive desaturation', () => {
    for (let i = 1; i < ramp.length; i++) {
      const gap = relativeLuminance(ramp[i]!.hex) - relativeLuminance(ramp[i - 1]!.hex)
      expect(
        gap,
        `${ramp[i - 1]!.step} → ${ramp[i]!.step} differ by only ${gap.toFixed(3)} in luminance; ` +
          'they collapse into the same grey when desaturated',
      ).toBeGreaterThanOrEqual(MIN_STEP_SEPARATION)
    }
  })

  it('keeps every pair of steps distinguishable without hue', () => {
    // Monotonic + adjacent separation implies this, but asserting it pairwise
    // is what actually encodes the requirement: the failure mode being guarded
    // against is "poor" and "good" reading alike, and those are not adjacent.
    for (const a of ramp) {
      for (const b of ramp) {
        if (a.step === b.step) continue
        const gap = Math.abs(relativeLuminance(a.hex) - relativeLuminance(b.hex))
        expect(gap, `${a.step} and ${b.step} are the same grey`).toBeGreaterThanOrEqual(
          MIN_STEP_SEPARATION,
        )
      }
    }
  })

  it('clears WCAG AA as text on every surface in its register', () => {
    // These tokens colour numbers as small as 12px, and the app is used
    // outdoors in daylight. Large-text 3:1 is not the applicable bar.
    for (const { step, hex } of ramp) {
      for (const surface of surfaces) {
        const ratio = contrastRatio(hex, surface)
        expect(ratio, `${step} (${hex}) on ${surface}`).toBeGreaterThanOrEqual(AA_CONTRAST)
      }
    }
  })
})

describe('water-clarity ramp — the blocked state', () => {
  // DESIGN.md: "`blocked` remains neutral so it is not confused with poor
  // visibility." It grades safety, not clarity, so it sits outside the ramp's
  // ordering and carries its meaning in the "STAY ASHORE" label and alert
  // glyph that `getVerdict` always pairs with it.
  it.each(REGISTERS)('is neutral in the $label register', ({ suffix, surfaces }) => {
    const hex = token(`sev-blocked${suffix}`)
    expect(chroma(hex), `${hex} is too saturated to read as a neutral`).toBeLessThan(0.1)
    for (const surface of surfaces) {
      expect(contrastRatio(hex, surface), `blocked on ${surface}`).toBeGreaterThanOrEqual(
        AA_CONTRAST,
      )
    }
  })
})

describe('water-clarity ramp — one ramp, several vocabularies', () => {
  // `--ds-q-*` (dive score, src/lib/diveScore.ts) and `--color-status-*` (the
  // design doc's public names) are aliases onto `--sev-*`. They were forked
  // once already, which put a "poor" day in dark slate on the dive score and
  // bright red on the forecast — same water, same day, two colours. Assert the
  // aliasing rather than the values, so a future retune of `--sev-*` carries
  // through instead of drifting.
  const tokensCss = readFileSync(resolve(repoRoot, 'src/styles/tokens.css'), 'utf8')

  /** The `var(--…)` a token defers to, or null if it declares its own value. */
  function aliasOf(name: string): string | null {
    const match = tokensCss.match(new RegExp(`--${name}:\\s*var\\(\\s*(--[\\w-]+)\\s*\\)`))
    return match?.[1] ?? null
  }

  const ALIASES: Array<[string, string]> = [
    ['ds-q-blown', '--sev-blocked'],
    ['ds-q-poor', '--sev-poor'],
    ['ds-q-marginal', '--sev-marginal'],
    ['ds-q-workable', '--sev-decent'],
    ['ds-q-good', '--sev-good'],
    ['ds-q-excellent', '--sev-excellent'],
    ['color-status-blown', '--ds-q-blown'],
    ['color-status-poor', '--ds-q-poor'],
    ['color-status-marginal', '--ds-q-marginal'],
    ['color-status-workable', '--ds-q-workable'],
    ['color-status-good', '--ds-q-good'],
    ['color-status-excellent', '--ds-q-excellent'],
  ]

  it.each(ALIASES)('--%s defers to %s', (name, target) => {
    expect(aliasOf(name), `--${name} should not declare its own colour`).toBe(target)
  })
})

describe('water-clarity ramp — separation from the alert ramp', () => {
  // severity.ts keeps risk (algae, turbidity, discharge) on the status ramp and
  // dive conditions on this one, precisely so "murky but safe" and "hazardous"
  // never read in the same language. That only holds if the two ramps don't
  // share colours.
  it('shares no colour with the status tokens', () => {
    const tokensCss = readFileSync(resolve(repoRoot, 'src/styles/tokens.css'), 'utf8')
    const statusHexes = ['ds-danger', 'ds-caution', 'ds-warn', 'ds-success'].map(name => {
      const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))
      if (!match?.[1]) throw new Error(`--${name} is not declared as a literal hex in tokens.css`)
      return match[1].toLowerCase()
    })
    for (const suffix of ['', '-face']) {
      for (const step of CLARITY_STEPS) {
        expect(statusHexes).not.toContain(token(`sev-${step}${suffix}`).toLowerCase())
      }
    }
  })
})

describe('light theme text colours', () => {
  const tokensCss = readFileSync(resolve(repoRoot, 'src/styles/tokens.css'), 'utf8')

  function finalToken(css: string, name: string): string {
    const matches = [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`, 'g'))]
    const value = matches.at(-1)?.[1]
    if (!value) throw new Error(`--${name} is not declared as a literal hex`)
    return value
  }

  it('keeps accent controls and secondary text at WCAG AA contrast', () => {
    const surfaces = ['#f7f4ee', '#f8faf9', '#edf2f3']
    const textTokens = [
      finalToken(indexCss, 'ink-faint'),
      finalToken(tokensCss, 'ds-text-muted'),
      finalToken(tokensCss, 'ds-text-faint'),
      finalToken(tokensCss, 'ds-accent'),
      finalToken(tokensCss, 'ds-interactive'),
    ]

    for (const text of textTokens) {
      for (const surface of surfaces) {
        expect(contrastRatio(text, surface), `${text} on ${surface}`).toBeGreaterThanOrEqual(
          AA_CONTRAST,
        )
      }
    }

    expect(
      contrastRatio(finalToken(tokensCss, 'ds-on-accent'), finalToken(tokensCss, 'ds-accent')),
      'accent button text',
    ).toBeGreaterThanOrEqual(AA_CONTRAST)
  })
})
