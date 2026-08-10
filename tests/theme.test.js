const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ThemeLib = require('../theme.js');

test('resolveInitialTheme: uses stored value when present, ignoring system preference', () => {
  assert.equal(ThemeLib.resolveInitialTheme('light', false), 'light');
  assert.equal(ThemeLib.resolveInitialTheme('dark', true), 'dark');
});

test('resolveInitialTheme: falls back to system preference when nothing stored', () => {
  assert.equal(ThemeLib.resolveInitialTheme(null, true), 'light');
  assert.equal(ThemeLib.resolveInitialTheme(null, false), 'dark');
});

test('resolveInitialTheme: ignores garbage stored values, falls back to system preference', () => {
  assert.equal(ThemeLib.resolveInitialTheme('banana', true), 'light');
  assert.equal(ThemeLib.resolveInitialTheme('', false), 'dark');
});

test('nextTheme: flips in both directions', () => {
  assert.equal(ThemeLib.nextTheme('dark'), 'light');
  assert.equal(ThemeLib.nextTheme('light'), 'dark');
});

test('nextTheme: treats anything not exactly "light" as dark-side, flips to light', () => {
  assert.equal(ThemeLib.nextTheme(null), 'light');
  assert.equal(ThemeLib.nextTheme(undefined), 'light');
});

// --- Cross-page consistency checks: every public page loads theme.js first, has the
// trust badge, and the toggle button carries the localStorage disclosure tooltip. ---

const PUBLIC_PAGES = [
  'index.html', 'about.html', 'contact.html', 'privacy.html',
  'guides/what-is-json.html', 'guides/regex-cheatsheet.html',
  'guides/cron-syntax-guide.html', 'guides/understanding-base64.html',
  'tools/json-formatter.html', 'tools/regex-tester.html',
  'tools/cron-builder.html', 'tools/password-generator.html',
  'tools/base64-tool.html', 'tools/color-converter.html',
];

function readPage(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf-8');
}

test('every public page loads /theme.js as the very first thing in <head>', () => {
  for (const page of PUBLIC_PAGES) {
    const html = readPage(page);
    assert.match(
      html,
      /<head>\n<script src="\/theme\.js"><\/script>/,
      `${page} does not load /theme.js first in <head>`
    );
  }
});

test('every public page shows the trust badge', () => {
  for (const page of PUBLIC_PAGES) {
    const html = readPage(page);
    assert.match(html, /class="trust-badge"/, `${page} is missing the trust badge`);
    assert.match(html, /0 cookies/, `${page} is missing the trust badge text`);
  }
});

test('every public page has a theme toggle with the localStorage disclosure tooltip', () => {
  for (const page of PUBLIC_PAGES) {
    const html = readPage(page);
    assert.match(html, /toggleTheme\(\)/, `${page} is missing the theme toggle button`);
    assert.match(
      html,
      /saved only in this browser \(localStorage\)/,
      `${page} is missing the toggle's disclosure tooltip`
    );
  }
});
