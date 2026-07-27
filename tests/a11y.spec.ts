import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Result } from 'axe-core'
import auditRoutes from './audit-routes.json' with { type: 'json' }
import a11yBaseline from './a11y-baseline.json' with { type: 'json' }

/**
 * WCAG 2.1 Level A and AA. Deliberately excludes axe's `best-practice` tag:
 * those rules are advisory, and mixing them in would make a build failure
 * ambiguous about whether an actual conformance target was missed.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * Leaflet renders map tiles into a canvas/img grid that axe can't reason about,
 * and the tile domains are unreachable in CI anyway. Nothing else is excluded —
 * add to this list only with a reason, never to silence a real violation.
 */
const EXCLUDED_SELECTORS = ['.leaflet-container']

/**
 * The API base baked into the build. Mirrors the default in src/lib/api.ts, so
 * an audit run with a non-default VITE_API_URL still intercepts the right URLs
 * instead of silently letting them through.
 */
const API_BASE = process.env.VITE_API_URL ?? '/api'

/** The only origin the audited page is allowed to talk to. */
const PREVIEW_ORIGIN = `http://localhost:${auditRoutes.previewPort}`

/** A glob matching any request to the API base, absolute or origin-relative. */
const API_GLOB = /^https?:\/\//.test(API_BASE)
  ? `${API_BASE.replace(/\/$/, '')}/**`
  : `**${API_BASE.startsWith('/') ? '' : '/'}${API_BASE.replace(/\/$/, '')}/**`

/**
 * CI has no backend (the API lives in a separate repo), so an un-stubbed page
 * would race between a 404 from the preview server's SPA fallback and a real
 * timeout. Pinning every API call to a 503 makes the resulting error state
 * deterministic — and error states are exactly where labelling and focus order
 * tend to regress, so they're worth auditing.
 *
 * Handlers are registered least-specific first: Playwright matches routes in
 * reverse registration order, so the specific stubs below win over the
 * catch-all.
 */
async function stubBackend(page: Page) {
  // Deny-all for anything off the preview origin. Belt-and-braces against the
  // case that actually bites: VITE_API_URL is baked in at build time, so a
  // developer with a real API host in their .env would otherwise point this
  // audit straight at production. Nothing here needs the network — every font
  // and asset is self-hosted — so refusing outright is both safer and more
  // deterministic than hoping the globs below cover every case. Map tiles get
  // blocked too, which is fine: .leaflet-container is excluded from axe anyway.
  await page.route(url => url.origin !== PREVIEW_ORIGIN, route => route.abort())

  await page.route(API_GLOB, route =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Backend stubbed for accessibility audit' }),
    }),
  )
  // Auth is the one thing that talks to Supabase directly. Nobody is signed in
  // during the audit, so this only catches a stray token-refresh attempt.
  await page.route('**/*.supabase.co/**', route =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  )
}

/**
 * Pre-existing violations this suite tolerates, as `project → route → rule →
 * max node count`. Fixing them means changing brand colours and shared chrome,
 * which is a design decision, not a test-infrastructure one — so the gate ships
 * green against today's reality and fails the moment anything gets worse.
 *
 * This file may only ever shrink. The suite enforces that: a rule that stops
 * firing fails until its allowance is deleted.
 */
const BASELINE: Record<string, Record<string, Record<string, number>>> = a11yBaseline

function baselineFor(project: string, route: string): Record<string, number> {
  return BASELINE[project]?.[route] ?? {}
}

/** Render a violation list into something a CI log reader can act on. */
function formatViolations(violations: Result[]): string {
  return violations
    .map(v => {
      const targets = v.nodes
        .slice(0, 5)
        .map(n => `      - ${n.target.join(' ')}`)
        .join('\n')
      const more = v.nodes.length > 5 ? `\n      …and ${v.nodes.length - 5} more` : ''
      return `  [${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${targets}${more}`
    })
    .join('\n\n')
}

/**
 * Wait until the DOM stops changing.
 *
 * Every route is lazy-loaded (`React.lazy`) behind a `null` Suspense fallback,
 * so the app shell paints first and the page content arrives a tick later.
 * `networkidle` fires before that — the route chunk is already cached, so there
 * is no in-flight request to wait on — which made violation counts vary with
 * machine load. Sampling the node count until it holds steady is the signal
 * that actually corresponds to "the page has finished rendering".
 */
async function waitForDomSettled(page: Page, timeout = 10_000) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __lastCount?: number; __stableTicks?: number }
      const count = document.querySelectorAll('*').length
      if (count === w.__lastCount) {
        w.__stableTicks = (w.__stableTicks ?? 0) + 1
      } else {
        w.__lastCount = count
        w.__stableTicks = 0
      }
      return (w.__stableTicks ?? 0) >= 3
    },
    undefined,
    { timeout, polling: 100 },
  )
}

async function scan(page: Page, route: string, project: string) {
  await stubBackend(page)
  await page.goto(route, { waitUntil: 'domcontentloaded' })

  await expect(page.locator('#root > *')).not.toHaveCount(0)
  await page.waitForLoadState('networkidle')
  await waitForDomSettled(page)
  // Web fonts change metrics, which changes what axe considers "large text"
  // (and therefore which contrast threshold applies).
  await page.evaluate(() => document.fonts.ready)

  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS)
  for (const selector of EXCLUDED_SELECTORS) builder = builder.exclude(selector)
  const results = await builder.analyze()

  // `A11Y_PRINT_BASELINE=1 npm run test:a11y` prints the lines needed to
  // rebuild tests/a11y-baseline.json by hand after a deliberate fix.
  if (process.env.A11Y_PRINT_BASELINE) {
    for (const v of results.violations) {
      console.log(`a11y-baseline ${project} ${route} ${v.id} ${v.nodes.length}`)
    }
  }

  const baselined = baselineFor(project, route)
  const regressions: string[] = []
  const regressedRules = new Set<string>()
  const known: string[] = []

  for (const v of results.violations) {
    const allowance = baselined[v.id]
    if (allowance === undefined) {
      regressions.push(`${v.id} (${v.impact}) ×${v.nodes.length} nodes — new rule`)
      regressedRules.add(v.id)
    } else if (v.nodes.length > allowance) {
      regressions.push(
        `${v.id} (${v.impact}) ×${v.nodes.length} nodes — baseline allows ${allowance}`,
      )
      regressedRules.add(v.id)
    } else {
      known.push(`${v.id} ×${v.nodes.length} (baseline ${allowance})`)
    }
  }

  // A baseline entry that no longer fires is a fix worth locking in — fail so
  // the stale allowance gets deleted instead of quietly protecting a rerun.
  const stillFiring = new Set(results.violations.map(v => v.id))
  for (const ruleId of Object.keys(baselined)) {
    if (!stillFiring.has(ruleId)) {
      regressions.push(
        `${ruleId} — baselined but no longer fires; remove it from tests/a11y-baseline.json`,
      )
    }
  }

  if (known.length) {
    console.log(`  ${project} ${route}: ${known.length} known issue(s) — ${known.join(', ')}`)
  }

  // Assert on a compact summary rather than the raw violation objects: axe
  // nodes are enormous, and a failing `toEqual` on them buries the actual rule
  // names under hundreds of lines of diff. The detail goes in the message.
  expect(
    regressions,
    regressions.length
      ? `${regressions.length} accessibility regression(s) on ${route} [${project}]:\n\n${formatViolations(
          results.violations.filter(v => regressedRules.has(v.id)),
        )}\n`
      : `no accessibility regressions on ${route}`,
  ).toEqual([])
}

test.describe('accessibility — WCAG 2.1 AA', () => {
  for (const route of auditRoutes.staticRoutes) {
    test(`${route} has no violations`, async ({ page }, testInfo) => {
      await scan(page, route, testInfo.project.name)
    })
  }

  // Backend-dependent routes, audited in the error state the stub produces.
  for (const route of auditRoutes.apiRoutes) {
    test(`${route} has no violations (error state)`, async ({ page }, testInfo) => {
      await scan(page, route, testInfo.project.name)
    })
  }
})

test.describe('accessibility — key interactions', () => {
  test('cookie banner is reachable and dismissible by keyboard', async ({ page }) => {
    await stubBackend(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const acknowledge = page.getByRole('button', { name: /got it/i })
    await expect(acknowledge).toBeVisible()

    // The banner is the first thing a screen-reader or keyboard user meets on a
    // first visit; it must be operable without a pointer.
    await acknowledge.focus()
    await expect(acknowledge).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(acknowledge).toBeHidden()
  })
})
