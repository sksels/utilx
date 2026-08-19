// Layout-assertion tests: no screenshots, no baseline images. These check computed
// geometry/style directly against the rules in STYLE_GUIDE.md, which is exactly the class
// of bug this project has actually hit twice -- a toolbar pinned to the top of its field
// instead of vertically centered (align-items: flex-start vs center), and inconsistent
// toolbar-button colors. A pixel-diff screenshot test would also catch these, but would
// also false-positive on font-rendering differences between machines; this doesn't.
const { test, expect } = require('@playwright/test');

const TOOL_PAGES = [
  '/tools/base64-tool.html',
  '/tools/color-converter.html',
  '/tools/cron-builder.html',
  '/tools/json-formatter.html',
  '/tools/password-generator.html',
  '/tools/regex-tester.html',
];

// Sub-pixel/rounding tolerance -- real browsers occasionally round flex-centered positions
// by a fraction of a pixel; anything beyond a couple of pixels is a real alignment bug, not
// rounding noise.
const CENTER_TOLERANCE_PX = 3;

for (const path of TOOL_PAGES) {
  test.describe(`${path} -- toolbar layout`, () => {
    test('every toolbar is vertically centered against its parent, not pinned to the top', async ({ page }) => {
      await page.goto(path);

      const toolbars = page.locator('.input-toolbar, .output-toolbar');
      const count = await toolbars.count();
      expect(count, `expected at least one toolbar on ${path}`).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const toolbar = toolbars.nth(i);
        const toolbarBox = await toolbar.boundingBox();
        const parentBox = await toolbar.locator('xpath=..').first().boundingBox();
        expect(toolbarBox, `toolbar #${i} on ${path} has no bounding box (hidden?)`).not.toBeNull();
        expect(parentBox, `toolbar #${i}'s parent on ${path} has no bounding box`).not.toBeNull();

        const toolbarCenterY = toolbarBox.y + toolbarBox.height / 2;
        const parentCenterY = parentBox.y + parentBox.height / 2;

        expect(
          Math.abs(toolbarCenterY - parentCenterY),
          `toolbar #${i} on ${path} is not vertically centered in its parent ` +
            `(toolbar center y=${toolbarCenterY}, parent center y=${parentCenterY}) -- ` +
            `check for a stray align-items that isn't "center" on the parent, per STYLE_GUIDE.md`
        ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
      }
    });

    test('every toolbar button shares the same background color (uniform accent, no primary/secondary split)', async ({ page }) => {
      await page.goto(path);

      const buttons = page.locator('.toolbar-btn:not(.copied)');
      const count = await buttons.count();
      expect(count, `expected at least one toolbar button on ${path}`).toBeGreaterThan(0);

      const colors = new Set();
      for (let i = 0; i < count; i++) {
        const color = await buttons.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
        colors.add(color);
      }

      expect(
        colors.size,
        `toolbar buttons on ${path} have inconsistent background colors: ${[...colors].join(', ')} -- ` +
          `every .toolbar-btn should share one accent color per STYLE_GUIDE.md`
      ).toBe(1);
    });
  });
}
