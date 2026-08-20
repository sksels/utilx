// Automated WCAG scan via axe-core (the engine behind Lighthouse's own accessibility audit
// and most other a11y tools). This is a floor, not a substitute for manual/screen-reader
// checks -- axe only catches roughly half of real WCAG issues -- but that floor is free and
// would have caught the light-theme dropdown contrast bug found earlier in this project
// automatically, on every push, instead of only when someone happened to switch themes and
// notice.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const PAGES = [
  '/index.html',
  '/tools/base64-tool.html',
  '/tools/color-converter.html',
  '/tools/cron-builder.html',
  '/tools/json-formatter.html',
  '/tools/password-generator.html',
  '/tools/regex-tester.html',
];

const THEMES = ['dark', 'light'];

for (const path of PAGES) {
  for (const theme of THEMES) {
    test(`${path} has no serious/critical WCAG violations (${theme} theme)`, async ({ page }) => {
      await page.goto(path);
      // Force the theme explicitly for BOTH cases, not just light. Playwright's default
      // emulated color-scheme is 'light', and theme.js (public/theme.js) resolves its
      // initial theme from prefers-color-scheme when nothing is in localStorage -- so
      // without this, the "dark theme" run was silently rendering light theme too (first
      // real run of this test caught it: identical violations reported under both theme
      // labels for the same pages). Matches theme.js's own storage key and toggle
      // mechanism (data-theme attribute + localStorage), not a UI click, so this stays
      // stable if the toggle button's markup ever changes.
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('utilx-theme', t);
      }, theme);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();

      const seriousOrWorse = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical'
      );

      expect(
        seriousOrWorse,
        seriousOrWorse
          .map((v) => `${v.id} (${v.impact}): ${v.description} -- ${v.nodes.length} node(s)`)
          .join('\n')
      ).toEqual([]);
    });
  }
}
