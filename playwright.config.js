// Playwright config for DOM/computed-style layout assertions -- NOT pixel screenshots.
// See STYLE_GUIDE.md and docs/web-dev-toolchain-2026.md for why: screenshot baselines
// false-positive across OS font rendering differences, while computed-style/bounding-rect
// assertions (toolbar centered on its field, all toolbar buttons share one color) are fast,
// have no baseline images to maintain, and catch exactly the bug class this project has
// actually hit (alignment drift, color-consistency drift).
//
// Cannot be run inside this project's Claude sandbox (Chromium download is blocked by the
// sandbox's network allowlist) -- runs in GitHub Actions CI instead, which has normal
// network access. See package.json's "test:e2e" script and .github/workflows/ci.yml.
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
