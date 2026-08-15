# UX audits

Automated quality gates that run against a **production build** served by
`vite preview` — never the dev server, because `preview` is what serves the real
CSP headers and the built service worker.

| Command | What it does |
| --- | --- |
| `npm run test:a11y` | Playwright + axe-core: WCAG 2.1 A/AA scan of the routes listed in `audit-routes.json`, desktop and mobile viewports |
| `npm run test:lighthouse` | Lighthouse CI: performance, accessibility, best-practices and SEO, over `staticRoutes` only |
| `npm run test:a11y -- --ui` | Same axe run in Playwright's interactive UI mode |

Both are wired into the `ux-audit` job in `.github/workflows/ci.yml`.

Unit tests are *not* here — they live next to their module under `src/` and are
run by Vitest via `npm test`. Vitest's `include` is scoped to
`src/**/*.test.{ts,tsx}` (see `vite.config.ts`) precisely so it doesn't try to
collect the Playwright specs in this directory.

## Route coverage and the missing backend

`tests/audit-routes.json` is the single source of truth for which routes get
audited — it's JSON rather than TypeScript so both the Playwright specs and the
CommonJS `lighthouserc.cjs` can read the same list without drifting.

The backend REST API lives in a separate repo, so CI has nothing behind
`VITE_API_URL`. That splits the routes in two:

- **`staticRoutes`** render their real, fully-populated UI with no API call.
  Audited by both axe and Lighthouse.
- **`apiRoutes`** render an error/empty state without a backend. Playwright can
  intercept and stub the API so that state is deterministic, so axe still audits
  them. Lighthouse drives a plain Chrome with no request interception, so it
  skips them — a Lighthouse score for a page stuck in an error state measures
  nothing useful.

Auditing an error state is still worth doing: empty and error states are exactly
where labelling, focus order and colour contrast tend to regress. To promote a
route into `staticRoutes`, stand up a mock API for the audit job and point
`VITE_API_URL` at it.

The loaded forecast routes (`/forecast`, `/tides`) now live in
`forecastRoutes`: the Playwright suite seeds the last-selected location and
stubs both `/forecast` and `/tides`, so axe audits the real loaded state rather
than an error shell. The remaining forecast-dependent routes (`/report`,
`/history`, `/dispute`) still need extra state and are left out until that mock
is worth carrying.

## Stub environment

The audit build uses throwaway values for `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` — `src/lib/supabase.ts` throws at import time if
they're missing, which would leave every audited page blank. No real
credentials are involved and no request ever reaches Supabase: `getSession()`
resolves from `localStorage` with no network call when nobody is signed in.

## Thresholds and the accessibility baseline

Both tools are set at the level the app achieves *today*, so the job is green on
the commit that introduced it and fails the moment anything gets worse. Neither
number is a target — they're ratchets, and both should be tightened in whichever
PR earns the improvement.

**Lighthouse** (`lighthouserc.cjs`) blocks on accessibility ≥ 0.92,
best-practices = 1.0 and SEO = 1.0. Performance and the Core Web Vitals audits
are advisory (`warn`): they're the genuinely noisy signals on a shared CI runner,
and they're pinned to the recognised "good" values rather than today's numbers so
they read as goals. Currently warning: performance ~0.81 and CLS ~0.28.

**axe** (`a11y-baseline.json`) records the WCAG 2.1 A/AA violations that already
existed, as `project → route → rule → maximum node count`. The suite fails if:

- a rule fires that isn't in the baseline for that route;
- a baselined rule affects *more* nodes than recorded;
- a baselined rule stops firing entirely — that's a fix, and the stale allowance
  has to be deleted so it can't quietly cover a future regression.

Node counts rather than CSS selectors, because selectors carry CSS-module hashes
(`_authBtn_q1a22_451`) that change whenever the stylesheet does.

Everything in the baseline today is one of two issues, both in shared chrome:
white text on the `#25b8c2` teal accent (2.4:1, needs 4.5:1) on the header
sign-in button, the cookie banner's "Got it" button, the home CTA and the unit
toggles; plus inline links on the legal pages. Fixing them is a design-token
decision, which is why they were baselined rather than silently excluded.

After a deliberate fix, regenerate the affected numbers with:

```bash
A11Y_PRINT_BASELINE=1 npm run test:a11y
```

and hand-edit the file. It's deliberately not auto-written — the whole point is
that shrinking it is a decision someone makes, not a side effect of a rerun.

## Running against a specific browser

Both tools read `CHROME_PATH`, so one variable pins them to the same binary:

```bash
CHROME_PATH=/path/to/chrome npm run test:ux
```

CI sets it from Playwright's own Chromium download so that a GitHub runner-image
bump can't shift the Lighthouse scores underneath us.
