// CR#8 backlog #32: smart clipboard injection. Real end-to-end coverage of the part that
// can't be unit-tested (permission gating, the toast DOM, dismiss-persistence) -- the pure
// matching logic itself is covered head-on in tests/clipboard-detect.test.js.
const { test, expect } = require('@playwright/test');

test.describe('clipboard suggestion toast', () => {
  // Serialized, not parallel (playwright.config.js sets fullyParallel: true site-wide): every
  // test here writes to navigator.clipboard, and on Linux CI runners the clipboard can behave
  // like a single shared OS resource across concurrent browser contexts rather than being
  // isolated per test. Real flake caught by CI's first-ever run of this file on `development`
  // (Aug 21 2026) -- "does not show a toast for clipboard content that matches no tool" failed
  // once (almost certainly reading another test's in-flight clipboard write) then passed on
  // retry (ran alone that time). Serializing removes the race instead of masking it with a
  // longer wait, which wouldn't fix concurrent writes landing in either order.
  test.describe.configure({ mode: 'serial' });

  test('shows the toast and navigates to the matching tool when clipboard-read is already granted', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    await page.goto('/');
    await page.evaluate(() => navigator.clipboard.writeText('{"name":"Ada","active":true}'));
    // Re-trigger the visibilitychange-driven check rather than reloading -- reloading would
    // also work, but this exercises the actual "switched back to an already-open tab" path
    // the feature targets, not just page-load.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    const toast = page.locator('#utilx-clipboard-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('JSON');
    await expect(toast).toContainText('JSON Formatter');

    await toast.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/tools\/json-formatter\.html$/);
  });

  test('dismiss hides the toast and it does not reappear for the same clipboard content', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    await page.goto('/');
    await page.evaluate(() => navigator.clipboard.writeText('*/15 9-17 * * MON-FRI'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    const toast = page.locator('#utilx-clipboard-toast');
    await expect(toast).toBeVisible();
    await toast.locator('.utilx-toast-dismiss').click();
    await expect(toast).toBeHidden();

    // Same clipboard content, checked again -- should stay dismissed, not reappear.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('#utilx-clipboard-toast')).toHaveCount(0);
  });

  test('never shows the toast when clipboard-read permission has not been granted', async ({ page, context, baseURL }) => {
    // Deliberately no grantPermissions call -- this is the default state for essentially every
    // real visitor, and the core design guarantee of this feature (see STYLE_GUIDE.md's CR#8
    // #32 section): it must never itself trigger the browser's native permission prompt, which
    // means it must also never surface a suggestion when permission isn't already granted,
    // clipboard content notwithstanding.
    await context.clearPermissions();
    await page.goto('/');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(300); // let any in-flight permission/clipboard promise settle
    await expect(page.locator('#utilx-clipboard-toast')).toHaveCount(0);
  });

  test('does not show a toast for clipboard content that matches no tool', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    await page.goto('/');
    await page.evaluate(() => navigator.clipboard.writeText('Just some ordinary sentence, nothing special here.'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(300);
    await expect(page.locator('#utilx-clipboard-toast')).toHaveCount(0);
  });
});
