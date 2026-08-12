const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PwaLib = require('../pwa-lib.js');

test('buildShellCacheName: prefixes the version with utilx-shell-', () => {
  assert.equal(PwaLib.buildShellCacheName('abc123'), 'utilx-shell-abc123');
  assert.equal(PwaLib.buildShellCacheName('__CACHE_VERSION__'), 'utilx-shell-__CACHE_VERSION__');
});

test('isStaleShellCache: flags our own caches from an older version', () => {
  assert.equal(PwaLib.isStaleShellCache('utilx-shell-old123', 'utilx-shell-new456'), true);
});

test('isStaleShellCache: does not flag the current version', () => {
  assert.equal(PwaLib.isStaleShellCache('utilx-shell-new456', 'utilx-shell-new456'), false);
});

test('isStaleShellCache: does not touch caches belonging to something else entirely', () => {
  assert.equal(PwaLib.isStaleShellCache('some-other-cache', 'utilx-shell-new456'), false);
  assert.equal(PwaLib.isStaleShellCache('workbox-precache-v2', 'utilx-shell-new456'), false);
});

test('shouldHandleFetch: intercepts only same-origin GET requests', () => {
  assert.equal(PwaLib.shouldHandleFetch('GET', 'https://utilx.tools', 'https://utilx.tools'), true);
});

test('shouldHandleFetch: never intercepts non-GET requests (e.g. the analytics POST)', () => {
  assert.equal(PwaLib.shouldHandleFetch('POST', 'https://utilx.tools', 'https://utilx.tools'), false);
});

test('shouldHandleFetch: never intercepts cross-origin requests (e.g. AdSense)', () => {
  assert.equal(
    PwaLib.shouldHandleFetch('GET', 'https://pagead2.googlesyndication.com', 'https://utilx.tools'),
    false
  );
});

test('isPrecachedAsset: true only for paths in the precache list', () => {
  const urls = ['/style.css', '/theme.js'];
  assert.equal(PwaLib.isPrecachedAsset('/style.css', urls), true);
  assert.equal(PwaLib.isPrecachedAsset('/not-cached.js', urls), false);
});

test('shouldShowUpdateToast: only when a worker is waiting AND this is an update, not first install', () => {
  assert.equal(PwaLib.shouldShowUpdateToast(true, true), true);
  assert.equal(PwaLib.shouldShowUpdateToast(true, false), false); // first-ever install: no controller yet
  assert.equal(PwaLib.shouldShowUpdateToast(false, true), false); // nothing waiting
  assert.equal(PwaLib.shouldShowUpdateToast(false, false), false);
});

test('shouldShowInstallPrompt: only when installable, not already installed, and not dismissed', () => {
  assert.equal(PwaLib.shouldShowInstallPrompt(true, false, false), true);
});

test('shouldShowInstallPrompt: hidden when the browser never offered install', () => {
  assert.equal(PwaLib.shouldShowInstallPrompt(false, false, false), false);
});

test('shouldShowInstallPrompt: hidden when already running standalone/installed', () => {
  assert.equal(PwaLib.shouldShowInstallPrompt(true, true, false), false);
});

test('shouldShowInstallPrompt: hidden once the user has dismissed it', () => {
  assert.equal(PwaLib.shouldShowInstallPrompt(true, false, true), false);
});

test('regression: PRECACHE_URLS in service-worker.js lists every file referenced in the <head> PWA tags across all 7 pages', () => {
  const swSource = fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8');
  const match = swSource.match(/var PRECACHE_URLS = \[([\s\S]*?)\];/);
  assert.ok(match, 'PRECACHE_URLS array not found in service-worker.js');
  const urls = match[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));

  const mustInclude = [
    '/', '/index.html', '/style.css', '/theme.js', '/popup-nav.js', '/pwa-lib.js',
    '/manifest.json', '/favicon.ico', '/favicon-16.png', '/favicon-32.png',
    '/apple-touch-icon.png', '/icon-192.png', '/utilx-icon-512.png',
    '/tools/json-formatter.html', '/tools/regex-tester.html', '/tools/cron-builder.html',
    '/tools/password-generator.html', '/tools/base64-tool.html', '/tools/color-converter.html'
  ];
  for (const url of mustInclude) {
    assert.ok(urls.includes(url), `PRECACHE_URLS is missing ${url}`);
  }
});

test('manifest.json: parses as valid JSON and has the required PWA fields', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'UtilX — Free Developer Tools');
  assert.equal(manifest.short_name, 'UtilX');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'expected at least 2 icon sizes');
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));
});
