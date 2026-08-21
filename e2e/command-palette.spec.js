// CR#8 #35 (backlog #236): command palette. Covers the DOM/keyboard/navigation behavior that
// tests/command-palette.test.js can't (that file only unit-tests the pure buildEntries()
// export) -- opening via the trigger button and via Ctrl/Cmd+K, fuzzy search filtering,
// keyboard navigation + Enter-to-navigate, and both ways of closing (Escape, backdrop click).
const { test, expect } = require('@playwright/test');

test.describe('command palette', () => {
  test('trigger button opens the palette and lists all tools/guides by default', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();

    const dialog = page.locator('#utilx-palette');
    await expect(dialog).toBeVisible();
    // 6 tools + 4 guides -- see src/data/tools.json / guides.json.
    await expect(page.locator('.utilx-palette-row')).toHaveCount(10);
  });

  test('Ctrl/Cmd+K opens the palette from anywhere on the page, not just via the button', async ({ page }) => {
    await page.goto('/tools/regex-tester.html');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#utilx-palette')).toBeVisible();
  });

  test('typing filters results down to matching tools/guides', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    await page.locator('#utilx-palette-input').fill('cron');

    const rows = page.locator('.utilx-palette-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Cron Expression Builder');
  });

  test('a query matching nothing shows the empty state, not a stale result list', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    await page.locator('#utilx-palette-input').fill('zzzzzznomatch');

    await expect(page.locator('.utilx-palette-row')).toHaveCount(0);
    await expect(page.locator('.utilx-palette-empty')).toBeVisible();
  });

  test('Enter opens the selected tool result in a popup window, same as clicking a homepage tile', async ({ page, context }) => {
    // Site owner call: palette selection matches tile-click behavior (window.openToolPopup,
    // public/popup-nav.js) rather than navigating the current page -- so the main page's own
    // URL should NOT change; a separate popup page should open instead.
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    await page.locator('#utilx-palette-input').fill('base64');

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.keyboard.press('Enter'),
    ]);
    await popup.waitForLoadState();

    await expect(popup).toHaveURL(/\/tools\/base64-tool\.html$/);
    await expect(page).toHaveURL(/\/$/); // main page/tab did not navigate away
    await expect(page.locator('#utilx-palette-backdrop')).toBeHidden(); // palette closed itself
  });

  test('Enter on a guide result navigates the current page (guides are not popup-triggering, matching the homepage tile links)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    await page.locator('#utilx-palette-input').fill('JSON Basics');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/guides\/what-is-json\.html$/);
  });

  test('ArrowDown moves selection before Enter activates it', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    // Empty query lists json-formatter first (src/data/tools.json order) -- arrow down once
    // to land on regex-tester, then confirm that's genuinely where Enter goes.
    await page.keyboard.press('ArrowDown');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.keyboard.press('Enter'),
    ]);
    await popup.waitForLoadState();

    await expect(popup).toHaveURL(/\/tools\/regex-tester\.html$/);
  });

  test('Escape closes the palette', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    await expect(page.locator('#utilx-palette')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#utilx-palette-backdrop')).toBeHidden();
  });

  test('clicking the backdrop closes the palette', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    // Click near the top-left corner of the backdrop, well outside the centered dialog.
    await page.locator('#utilx-palette-backdrop').click({ position: { x: 5, y: 5 } });

    await expect(page.locator('#utilx-palette-backdrop')).toBeHidden();
  });

  test('the palette is draggable by its handle, not fixed in place', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();

    const dialog = page.locator('#utilx-palette');
    const before = await dialog.boundingBox();
    const handle = page.locator('#utilx-palette-drag-handle');
    const handleBox = await handle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 220, handleBox.y + 180, { steps: 10 });
    await page.mouse.up();

    const after = await dialog.boundingBox();
    expect(after.x).not.toBeCloseTo(before.x, 0);
    expect(after.y).not.toBeCloseTo(before.y, 0);
  });

  test('dragged position resets on re-open, not persisted', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open command palette' }).click();

    const dialog = page.locator('#utilx-palette');
    const original = await dialog.boundingBox();
    const handle = page.locator('#utilx-palette-drag-handle');
    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 220, handleBox.y + 180, { steps: 10 });
    await page.mouse.up();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open command palette' }).click();
    const reopened = await dialog.boundingBox();

    expect(reopened.x).toBeCloseTo(original.x, 0);
    expect(reopened.y).toBeCloseTo(original.y, 0);
  });

  test('the admin dashboard does not render a palette trigger', async ({ page, request, baseURL }) => {
    // admin/stats.astro passes header="minimal", which BaseLayout's includeCommandPalette
    // default (header === 'full') excludes -- confirms that default actually holds, not just
    // that the trigger button is absent for some unrelated reason (e.g. a 404).
    const res = await request.get(baseURL + '/admin/stats.html');
    expect(res.ok()).toBeTruthy();
    await page.goto('/admin/stats.html');
    await expect(page.locator('#utilx-palette-trigger')).toHaveCount(0);
  });
});
