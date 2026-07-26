/**
 * Lighthouse CI configuration.
 *
 * CommonJS (`.cjs`) on purpose: package.json sets `"type": "module"`, and LHCI
 * loads its config with `require()`. A plain `.js` file here would be parsed as
 * ESM and fail.
 *
 * Only `staticRoutes` are audited — see tests/README.md. Lighthouse drives a
 * plain Chrome with no request interception, so it can't stub the backend the
 * way the Playwright/axe run does, and a score for a page stuck in an error
 * state measures nothing useful.
 */
const { previewPort, staticRoutes } = require('./tests/audit-routes.json')

const BASE_URL = `http://localhost:${previewPort}`

module.exports = {
  ci: {
    collect: {
      // Audit the production artefact, never the dev server — `preview` serves
      // the real CSP headers and the built service worker.
      startServerCommand: `npm run preview -- --port ${previewPort} --strictPort`,
      // Vite prints "➜  Local:   http://localhost:4173/" on boot; LHCI's default
      // pattern (/listen|ready/) never matches it and the collect step hangs.
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 120000,
      url: staticRoutes.map(route => `${BASE_URL}${route}`),
      // One run per URL. The categories asserted below (accessibility,
      // best-practices, SEO) are deterministic, so repeat runs would only buy
      // stability for performance — which is advisory here anyway.
      numberOfRuns: 1,
      settings: {
        // No `preset` key: Lighthouse's *default* is already mobile emulation
        // with 4G throttling, which is the right default for DepthViz — it's a
        // PWA people open on a boat. ("mobile" is not a valid preset value;
        // the presets are perf/experimental/desktop.)
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        // The SPA fallback serves index.html for unknown paths, so a 404 can't
        // be detected by status code — skip the redirect audit's noise instead.
        skipAudits: ['uses-http2', 'canonical'],
      },
    },

    assert: {
      assertions: {
        // ── Blocking ──────────────────────────────────────────────────────
        // Set at the level the app achieves today so the gate is green now and
        // fails on regression. Ratchet these upward in the same PR that earns
        // the improvement. Measured floors at time of writing: accessibility
        // 0.92 (/legal/accessibility) to 0.96, best-practices and SEO both 1.0.
        'categories:accessibility': ['error', { minScore: 0.92 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],

        // ── Advisory ──────────────────────────────────────────────────────
        // Performance under simulated throttling is the one genuinely noisy
        // signal on a shared CI runner. Reported in the log, never blocking —
        // promote to 'error' once the numbers are stable enough to trust.
        //
        // These are set at the recognised "good" targets, not at today's
        // numbers, so they read as goals. Currently warning: performance ~0.81
        // and CLS ~0.28, both driven by the shell painting before the
        // lazy-loaded route resolves behind its `null` Suspense fallback.
        'categories:performance': ['warn', { minScore: 0.85 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
        // Guards the manual-chunk / lazy-loading setup: @techstark/opencv-js is
        // ~10 MB and must never reach the main bundle (see vite.config.ts).
        'total-byte-weight': ['warn', { maxNumericValue: 1500000 }],
        'unused-javascript': 'warn',
      },
    },

    upload: {
      // Reports are kept as a CI artifact rather than pushed to a server, so
      // this needs no token and no third-party account.
      target: 'filesystem',
      outputDir: './.lighthouseci',
      reportFilenamePattern: '%%PATHNAME%%-report.%%EXTENSION%%',
    },
  },
}
