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

      const allToolbars = page.locator('.input-toolbar, .output-toolbar');
      const totalCount = await allToolbars.count();
      expect(totalCount, `expected at least one toolbar on ${path}`).toBeGreaterThan(0);

      // Some toolbars belong to a section that's collapsed until the user triggers it (e.g.
      // Regex Tester's "Plain-English breakdown" box, display:none until Explain is clicked)
      // -- boundingBox() is legitimately null for those, and that's correct, not a layout
      // bug. Only visible toolbars are meaningful to check here.
      const toolbars = [];
      for (let i = 0; i < totalCount; i++) {
        const el = allToolbars.nth(i);
        if (await el.isVisible()) toolbars.push(el);
      }
      expect(toolbars.length, `expected at least one visible toolbar on ${path}`).toBeGreaterThan(0);

      for (let i = 0; i < toolbars.length; i++) {
        const toolbar = toolbars[i];
        const toolbarBox = await toolbar.boundingBox();
        const parentBox = await toolbar.locator('xpath=..').first().boundingBox();
        expect(toolbarBox, `toolbar #${i} on ${path} has no bounding box`).not.toBeNull();
        expect(parentBox, `toolbar #${i}'s parent on ${path} has no bounding box`).not.toBeNull();

        const toolbarCenterY = toolbarBox.y + toolbarBox.height / 2;
        const parentCenterY = parentBox.y + parentBox.height / 2;

        expect(
          Math.abs(toolbarCenterY - parentCenterY),
          `toolbar #${i} on ${path} is not vertically centered in its parent ` +
            `(toolbar center y=${toolbarCenterY}, parent center y=${parentCenterY}) -- ` +
            `check for a stray align-items that isn't "center" on the parent, per STYLE_GUIDE.md`
        ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);

        // The check above only proves the toolbar's own container box is centered -- it
        // doesn't prove the *visible buttons inside it* are. Real incident: every .toolbar-btn
        // silently inherited the base `button` rule's margin-top:16px/margin-right:8px (no
        // toolbar-btn rule ever reset margin), which inflates the toolbar's own box height
        // without adding any real gap on the trailing edge. align-items:center on the parent
        // still centered that inflated *container* correctly, so the check above kept passing,
        // while the buttons visibly rendered off-center within it. Comparing the buttons'
        // own combined bounding box (first button's top to last button's bottom) against the
        // parent catches that class of bug even when the container-level check can't.
        const buttons = toolbar.locator('.toolbar-btn');
        const buttonCount = await buttons.count();
        if (buttonCount > 0) {
          const firstBox = await buttons.first().boundingBox();
          const lastBox = await buttons.last().boundingBox();
          expect(firstBox, `toolbar #${i}'s first button on ${path} has no bounding box`).not.toBeNull();
          expect(lastBox, `toolbar #${i}'s last button on ${path} has no bounding box`).not.toBeNull();

          const buttonsCenterY = (firstBox.y + (lastBox.y + lastBox.height)) / 2;

          expect(
            Math.abs(buttonsCenterY - parentCenterY),
            `toolbar #${i} on ${path}: its container is centered, but the visible buttons ` +
              `inside it are not (buttons center y=${buttonsCenterY}, parent center y=${parentCenterY}) -- ` +
              `check for stray margin on .toolbar-btn (the base button rule's margin isn't reset)`
          ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
        }
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

// CR#8 backlog #53, re-fixed: the original fix for split-pane top alignment relied on margin
// *collapsing* between each pane and its first child, and turned out to be wrong for JSON
// Formatter/Regex Tester specifically (their left pane's first child is .field-header, a flex
// container, which blocks its own child's margin from collapsing the way a bare <label> does).
// Neither existing test above would have caught this -- the toolbar-centering test only compares
// a toolbar to *its own* immediate parent, never one pane's content to the other pane's. Base64
// Tool is included even though its left pane is a bare <label> (no .field-header), specifically
// so a future change can't "fix" one DOM shape and quietly break the other.
const SPLIT_PANE_PAGES = [
  '/tools/json-formatter.html',
  '/tools/regex-tester.html',
  '/tools/base64-tool.html',
];

for (const path of SPLIT_PANE_PAGES) {
  test(`${path} -- split-pane-left and split-pane-right content start at the same vertical offset`, async ({ page }) => {
    await page.goto(path);

    const leftFirstChild = page.locator('#mainSplitPane .split-pane-left > *:first-child');
    const rightFirstChild = page.locator('#mainSplitPane .split-pane-right > *:first-child');

    const leftBox = await leftFirstChild.boundingBox();
    const rightBox = await rightFirstChild.boundingBox();

    expect(leftBox, `${path}: split-pane-left's first child has no bounding box`).not.toBeNull();
    expect(rightBox, `${path}: split-pane-right's first child has no bounding box`).not.toBeNull();

    expect(
      Math.abs(leftBox.y - rightBox.y),
      `${path}: split-pane-left's first child starts at y=${leftBox.y}, split-pane-right's at ` +
        `y=${rightBox.y} -- they should match. Check for a stray, un-zeroed margin-top on ` +
        `either pane's first child (or its own first child), per STYLE_GUIDE.md's CR#8 #53 ` +
        `section -- this is deliberately padding-based, not margin-collapsing-based, to avoid ` +
        `the exact bug this test exists to catch.`
    ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  });
}

// CR#8 backlog #49, re-fixed: the 96px min-width never actually took effect because
// .input-box select is display:block, and a block-level box with width:auto fills its
// containing block's width by definition -- min-width only clamps a computed width that would
// otherwise be smaller, and here it never was. No existing test asserted select width at all
// (axe-core checks WCAG issues, not layout proportions), so this shipped unnoticed twice
// (CR#7's 140px attempt had the same bug).
test('JSON Formatter -- indent-size select shrinks to content, does not stretch to fill its panel', async ({ page }) => {
  await page.goto('/tools/json-formatter.html');

  const select = page.locator('#indent');
  const box = await select.boundingBox();
  expect(box, 'indent-size select has no bounding box').not.toBeNull();

  // min-width is 96px; 160px comfortably allows for cross-browser font/padding variance while
  // still ruling out "stretched to fill the ~300px+ panel", which is the actual regression this
  // guards against.
  expect(
    box.width,
    `indent-size select is ${box.width}px wide -- expected it to shrink to content (~96-140px). ` +
      `Check that .input-box .input-secondary select still has display:inline-block -- without ` +
      `it, width:auto on a block-level select fills the panel instead of shrinking, per ` +
      `STYLE_GUIDE.md's CR#8 #49 section.`
  ).toBeLessThan(160);
});
