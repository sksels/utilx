// Playwright config for DOM/computed-style layout assertions -- NOT pixel screenshots.
// See STYLE_GUIDE.md and docs/web-dev-toolchain-2026.md for why: screenshot baselines
// false-positive across OS font rendering differences, while computed-style/bounding-rect
// assertions (toolbar centered on its field, all toolbar buttons share one color) are fast,
// have no baseline images to maintain, and catch exactly the bug class this project has
// actually hit (alignment drift, color-consistency drift).
//
// Whether this can run inside a Claude session's own sandbox depends on that sandbox: some
// block the Chromium download via their network allowlist (in that case, do not try to
// install or route around it -- fall back to describing the check instead of running it,
// same as any other blocked download); others (e.g. Anthropic's Cowork cloud environment,
// which ships Chromium pre-installed) can run `npx playwright test` directly, which is how
// the CR#10 popup-ceiling numbers in the backlog were verified. Either way, GitHub Actions
// CI is the one place these are guaranteed to run on every change -- see package.json's
// "test:e2e" script and .github/workflows/ci.yml.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Astro's own preview server, serving the already-built dist/ output -- npm's "pretest"
  // hook already runs "astro build" before this, so dist/ is current by the time this starts.
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
