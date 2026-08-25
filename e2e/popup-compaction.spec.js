// CR#10 (backlog #61, #77): regression guard for the "POPUP COMPACTION SYSTEM" documented in
// style.css and BaseLayout.astro. That system's whole premise is that it's generic/selector-
// based rather than tool-specific, so a future change to shared CSS (.card, .output-box,
// textarea, etc.) or to any one tool page's markup could silently push a popup back over the
// screen ceiling without anyone noticing -- exactly the failure mode backlog #61/#77 went
// through multiple rounds of manual, human-eyeballed feedback to catch the first time. These
// tests check real rendered geometry and real script behavior, not screenshots (see
// playwright.config.js's header comment for why this project uses that style of test).
//
// Popup-mode only activates when `window.opener` is truthy (see BaseLayout.astro) -- these
// tests fake that with an init script before each navigation, the same technique used to
// produce the real numbers recorded in utilx-backlog.xlsx's CR#10 entry.
const { test, expect } = require('@playwright/test');

const TOOL_PAGES = [
  '/tools/json-formatter.html',
  '/tools/base64-tool.html',
  '/tools/color-converter.html',
  '/tools/regex-tester.html',
  '/tools/cron-builder.html',
  '/tools/password-generator.html',
];

// The real ceiling this system was built and measured against: screen.availHeight on a 1080p
// display minus the OS taskbar, from the same live measurement backlog #61/#77 used. This is a
// regression guard, not a promise that every possible screen is this tall or taller -- a
// genuinely smaller screen still falls back on popup-nav.js's scrollbars=yes. What this test
// guards against is a future change silently pushing any tool page back over the ceiling this
// system was actually built to fit under.
const CEILING_PX = 1032;

// Simulates a page having been opened via window.open() from another page -- the one signal
// BaseLayout.astro checks (`if (window.opener) ...`) to add the popup-mode class and run the
// popup-only scripts. Must be registered before goto() so it's in place before any page script
// runs.
async function gotoAsPopup(page, path) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'opener', { value: {}, configurable: true });
  });
  await page.goto(path);
  // DOMContentLoaded-timed popup scripts (ref-table wrapping, details collapse) run after the
  // navigation's own load event this helper already waits for via page.goto(), but give any
  // synchronous tool script that builds a table at runtime (color-converter's contrast table)
  // a moment to finish before the wrapping script's own listener fires.
  await page.waitForTimeout(150);
}

// Real page content height, robust to :root.popup-mode body's min-height:100vh (which floors
// document.documentElement.scrollHeight at the *viewport* height regardless of how tall the
// actual content is -- a trap that produced false "it fits" readings during CR#10's own
// development; see UtilX-Popup-Mockups/why-verification-changed.md). footer.site's own bottom
// edge is the real bottom of the page's content and can't be floored that way.
async function contentHeight(page) {
  return page.locator('footer.site').evaluate((el) => Math.ceil(el.getBoundingClientRect().bottom));
}

test.describe('popup compaction -- zero page-level scroll', () => {
  test('popup-mode actually activates under the window.opener simulation these tests rely on', async ({ page }) => {
    // Precondition check for every other test below: if this ever fails, it means the
    // simulation technique itself broke (e.g. BaseLayout.astro's check changed), which would
    // make every other test in this file pass for the wrong reason -- silently checking the
    // normal full-page layout instead of the popup one.
    await gotoAsPopup(page, TOOL_PAGES[0]);
    const isPopupMode = await page.evaluate(() => document.documentElement.classList.contains('popup-mode'));
    expect(
      isPopupMode,
      'window.opener simulation did not activate :root.popup-mode -- check BaseLayout.astro\'s ' +
        '`if (window.opener) document.documentElement.classList.add(\'popup-mode\')` script is ' +
        'still present and still keyed on window.opener'
    ).toBe(true);
  });

  for (const path of TOOL_PAGES) {
    test(`${path} -- real popup content height stays under the ${CEILING_PX}px screen ceiling`, async ({ page }) => {
      await gotoAsPopup(page, path);
      const height = await contentHeight(page);

      expect(
        height,
        `${path}'s popup content is ${height}px tall, over the ${CEILING_PX}px ceiling this ` +
          `system is built to fit under -- this tool (or a shared rule in style.css's "POPUP ` +
          `COMPACTION SYSTEM" block that now affects it) grew past its CR#10 budget. Re-run this ` +
          `tool through the same measurement this suite uses (see why-verification-changed.md) to ` +
          `find which section grew, then either trim it with an existing selector-based rule or, ` +
          `if it's a genuinely secondary section, wrap it in <details class="popup-collapsible"> ` +
          `-- never a one-off [data-tool-id="..."] override, which would break the "any future ` +
          `tool inherits this for free" guarantee.`
      ).toBeLessThanOrEqual(CEILING_PX);
    });
  }
});

test.describe('popup compaction -- reference tables scroll internally instead of forcing page scroll', () => {
  // Only the 4 tools that actually have a table.ref-table (regex-tester's flag reference,
  // cron-builder's schedule examples, color-converter's contrast-ratio result -- built at
  // runtime, json-formatter's diff table -- hidden until Compare is used) are relevant here.
  const REF_TABLE_PAGES = [
    '/tools/json-formatter.html',
    '/tools/color-converter.html',
    '/tools/regex-tester.html',
    '/tools/cron-builder.html',
  ];

  for (const path of REF_TABLE_PAGES) {
    test(`${path} -- every visible table.ref-table is capped by .ref-table-scroll, not left to grow the page`, async ({ page }) => {
      await gotoAsPopup(page, path);

      const tables = page.locator('table.ref-table');
      const count = await tables.count();
      expect(count, `expected at least one table.ref-table on ${path}`).toBeGreaterThan(0);

      // json-formatter's #diffTable and color-converter's contrast table are legitimately
      // hidden/empty until the user interacts with the page -- only visible tables need to be
      // capped right now; an invisible one can't be forcing scroll.
      for (let i = 0; i < count; i++) {
        const table = tables.nth(i);
        if (!(await table.isVisible())) continue;

        const wrapped = await table.evaluate((el) => el.closest('.ref-table-scroll') !== null);
        expect(
          wrapped,
          `table.ref-table #${i} on ${path} is not inside a .ref-table-scroll wrapper -- check ` +
            `BaseLayout.astro's popup-only script that wraps every table.ref-table on ` +
            `DOMContentLoaded still runs, and still runs after any tool script that builds this ` +
            `table at runtime (it must fire on DOMContentLoaded, not earlier)`
        ).toBe(true);

        const wrapperBox = await table.evaluate((el) => el.closest('.ref-table-scroll').getBoundingClientRect());
        // style.css caps .ref-table-scroll at max-height:90px plus a 1px border each side;
        // a generous tolerance here is intentional -- this test's job is to catch the wrapper
        // being removed or its cap being raised to something that defeats the point (e.g.
        // "max-height: none"), not to pin the exact pixel value.
        expect(
          wrapperBox.height,
          `table.ref-table #${i} on ${path}'s .ref-table-scroll wrapper rendered ${wrapperBox.height}px ` +
            `tall -- expected it capped near style.css's 90px max-height. Check that rule wasn't ` +
            `raised or removed from the "POPUP COMPACTION SYSTEM" block.`
        ).toBeLessThanOrEqual(120);
      }
    });
  }
});

test.describe('popup compaction -- secondary sections collapse in a popup, stay expanded on the full page', () => {
  // Only the 3 tools that actually use the <details class="popup-collapsible"> pattern.
  const COLLAPSIBLE_PAGES = [
    '/tools/base64-tool.html',
    '/tools/color-converter.html',
    '/tools/password-generator.html',
  ];

  for (const path of COLLAPSIBLE_PAGES) {
    test(`${path} -- details.popup-collapsible is closed in a popup`, async ({ page }) => {
      await gotoAsPopup(page, path);

      const details = page.locator('details.popup-collapsible');
      const count = await details.count();
      expect(count, `expected at least one details.popup-collapsible on ${path}`).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const isOpen = await details.nth(i).evaluate((el) => el.open);
        expect(
          isOpen,
          `details.popup-collapsible #${i} on ${path} is open inside a simulated popup -- check ` +
            `BaseLayout.astro's popup-only script still sets .open = false for every ` +
            `details.popup-collapsible on DOMContentLoaded`
        ).toBe(false);
      }
    });

    test(`${path} -- the same details.popup-collapsible stays open on the normal full page (no window.opener)`, async ({ page }) => {
      // Deliberately the plain page.goto() every other e2e test in this project uses --
      // window.opener is never simulated here, matching a normal in-tab site visit. This is
      // the guarantee the whole compaction system is built around: it must never change what
      // the full, non-popup site looks like.
      await page.goto(path);

      const details = page.locator('details.popup-collapsible');
      const count = await details.count();
      expect(count, `expected at least one details.popup-collapsible on ${path}`).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const isOpen = await details.nth(i).evaluate((el) => el.open);
        expect(
          isOpen,
          `details.popup-collapsible #${i} on ${path} is collapsed on the normal full-page site ` +
            `(no window.opener) -- this markup must always carry the \`open\` attribute so the ` +
            `full site is unaffected; only BaseLayout.astro's popup-only script (gated on ` +
            `window.opener) should ever close it`
        ).toBe(true);
      }
    });
  }
});
