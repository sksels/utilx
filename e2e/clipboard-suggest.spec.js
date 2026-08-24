// CR#8 backlog #32: smart clipboard injection. Real end-to-end coverage of the part that
// can't be unit-tested (permission gating, the toast DOM, dismiss-persistence) -- the pure
// matching logic itself is covered head-on in tests/clipboard-detect.test.js.
const { test, expect } = require('@playwright/test');

// Mocks navigator.clipboard.readText() via an init script instead of round-tripping through
// the real OS clipboard (context.grantPermissions + navigator.clipboard.writeText()). Real bug
// found by CI's first-ever run of this file on `development` (Aug 21 2026): the real-clipboard
// version was flaky under this CI runner's headless Linux/X11 setup -- writes from one test's
// browser context weren't reliably visible to a read in a different (even later) context before
// the read fired, so "does not show a toast for..." intermittently saw a PREVIOUS test's
// clipboard content instead of its own. Serializing the tests (first attempted fix) didn't
// solve it -- it turned the race from intermittent into a consistent failure, which is exactly
// what you'd expect if the real cross-context clipboard timing is the actual cause, not test
// ordering. Mocking readText() removes the real OS clipboard from the test entirely, which is
// the standard, deterministic way to test clipboard-dependent behavior in Playwright.
async function mockClipboard(page, text) {
  await page.addInitScript((clipboardText) => {
    navigator.clipboard.readText = () => Promise.resolve(clipboardText);
  }, text);
}

test.describe('clipboard suggestion toast', () => {
  test('shows the toast and navigates to the matching tool when clipboard-read is already granted', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read'], { origin: baseURL });
    await mockClipboard(page, '{"name":"Ada","active":true}');
    await page.goto('/');
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
    await context.grantPermissions(['clipboard-read'], { origin: baseURL });
    await mockClipboard(page, '*/15 9-17 * * MON-FRI');
    await page.goto('/');
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
    await mockClipboard(page, '{"name":"Ada","active":true}');
    await page.goto('/');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(300); // let any in-flight permission/clipboard promise settle
    await expect(page.locator('#utilx-clipboard-toast')).toHaveCount(0);
  });

  test('does not show a toast for clipboard content that matches no tool', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read'], { origin: baseURL });
    await mockClipboard(page, 'Just some ordinary sentence, nothing special here.');
    await page.goto('/');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(300);
    await expect(page.locator('#utilx-clipboard-toast')).toHaveCount(0);
  });
});
