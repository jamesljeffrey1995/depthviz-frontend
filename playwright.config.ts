import { defineConfig, devices } from '@playwright/test'
// Import attribute is required: package.json is `"type": "module"`, so Node
// loads this config as ESM and refuses a bare JSON import without it.
import auditRoutes from './tests/audit-routes.json' with { type: 'json' }

const PORT = auditRoutes.previewPort
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // A stray `test.only` should fail CI rather than silently shrink the audit.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Honour CHROME_PATH when set, so a machine with a system Chrome (or a
    // pre-provisioned browser cache) doesn't need `playwright install`. This is
    // the same variable Lighthouse reads, so one override covers both audits.
    ...(process.env.CHROME_PATH
      ? { launchOptions: { executablePath: process.env.CHROME_PATH } }
      : {}),
  },
  // DepthViz is a mobile-first PWA, so a desktop-only sweep would miss the
  // layout most people actually use — audit both viewports.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // Audit the production artefact, never the dev server: `preview` is what
    // serves the real CSP headers and the built service worker (the SW is
    // disabled in `dev` — see devOptions in vite.config.ts).
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
