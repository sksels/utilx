const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TOOL_PAGES = {
  'tools/json-formatter.html': '/tools/base64-tool.html',
  'tools/regex-tester.html': '/tools/json-formatter.html',
  'tools/cron-builder.html': '/tools/regex-tester.html',
  'tools/password-generator.html': '/tools/base64-tool.html',
  'tools/base64-tool.html': '/tools/json-formatter.html',
  'tools/color-converter.html': '/tools/base64-tool.html',
};

function readPage(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf-8');
}

test('every tool page links to its designated related tool', () => {
  for (const [page, relatedHref] of Object.entries(TOOL_PAGES)) {
    const html = readPage(page);
    assert.match(
      html,
      new RegExp('Related tool:.*href="' + relatedHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 's'),
      `${page} should link to ${relatedHref} under a "Related tool" line`
    );
  }
});

test('no tool page links to itself as its related tool', () => {
  for (const [page, relatedHref] of Object.entries(TOOL_PAGES)) {
    const selfHref = '/' + page;
    assert.notEqual(relatedHref, selfHref, `${page} should not link to itself`);
  }
});

// --- Keyboard shortcut / shareable-URL wiring sanity checks (these are integration checks
// on the shipped HTML, not unit tests of the underlying lib logic -- that's covered in
// shortcuts.test.js and url-state.test.js). ---

const SHORTCUT_PAGES = [
  'tools/json-formatter.html', 'tools/regex-tester.html', 'tools/cron-builder.html',
  'tools/password-generator.html', 'tools/base64-tool.html',
];
const URL_STATE_PAGES = [
  'tools/json-formatter.html', 'tools/regex-tester.html', 'tools/cron-builder.html',
  'tools/base64-tool.html', 'tools/color-converter.html',
];

test('every keyboard-shortcut tool page loads lib/shortcuts.js and wires a keydown listener', () => {
  for (const page of SHORTCUT_PAGES) {
    const html = readPage(page);
    assert.match(html, /<script src="lib\/shortcuts\.js">/, `${page} should load lib/shortcuts.js`);
    assert.match(html, /ShortcutsLib\.isRunShortcut/, `${page} should call ShortcutsLib.isRunShortcut`);
  }
});

test('every shareable-URL tool page loads lib/url-state.js and wires a share-link + restore flow', () => {
  for (const page of URL_STATE_PAGES) {
    const html = readPage(page);
    assert.match(html, /<script src="lib\/url-state\.js">/, `${page} should load lib/url-state.js`);
    assert.match(html, /UrlStateLib\.buildShareUrl/, `${page} should build a shareable link`);
    assert.match(html, /UrlStateLib\.decodeState/, `${page} should restore state from the URL on load`);
  }
});

test('color-converter has no keyboard shortcut wiring (no discrete run action)', () => {
  const html = readPage('tools/color-converter.html');
  assert.doesNotMatch(html, /ShortcutsLib/, 'color-converter should not reference ShortcutsLib');
});

test('password-generator has no shareable-URL wiring (no meaningful state to share)', () => {
  const html = readPage('tools/password-generator.html');
  assert.doesNotMatch(html, /UrlStateLib/, 'password-generator should not reference UrlStateLib');
});
