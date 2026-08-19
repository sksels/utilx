// UtilX service worker -- precaches the installable app shell (the 6 tools + launcher)
// and applies two caching strategies depending on request type:
//   - HTML documents (navigations): network-first, cache as fallback only. This is
//     deliberate -- every real visit should still hit the network so the AdSense script
//     and the analytics beacon fire exactly as they would in a normal browser tab. The
//     cached shell only serves when the network request genuinely fails.
//   - Static assets (CSS/JS/icons): stale-while-revalidate. Serve the cached copy
//     instantly for speed, and refresh the cache in the background regardless.
//
// Update strategy (revised -- see CR#7 note below): new installs call skipWaiting()
// immediately and take over via clients.claim() on activate, entirely in the background.
// This does NOT reload or otherwise disturb any currently-open tab/window -- an open tab
// keeps running the JS it already loaded into memory for the rest of that session (no
// forced reload is ever triggered, so live user input like a pasted JSON blob or a regex
// under test is never at risk). The new version simply takes effect the next time the app
// is genuinely reloaded or reopened (e.g. relaunched from an installed PWA's taskbar/home-
// screen icon), with no prompt, toast, or confirmation of any kind.
//
// CR#7 note: this replaces the original "ask before refresh" toast design. That design
// assumed a browser-tab context; once the site became installable (CR#4) and users started
// launching it from a taskbar/home-screen icon like a native app, an interactive "a new
// version is available, click Refresh" toast doesn't fit that mental model at all -- an
// installed app's icon is expected to just open the current version, silently, the way any
// other desktop/mobile app updates. See tests/pwa-lib.test.js and sw-register.js for the
// registration side of this.
//
// The pure decision logic (which caches are stale, which requests to intercept, etc.)
// lives in pwa-lib.js so it's unit-testable with plain node:test -- see tests/pwa-lib.test.js.
importScripts('/pwa-lib.js');

var CACHE_VERSION = '__CACHE_VERSION__'; // stamped with the deploy commit SHA at build time
var SHELL_CACHE = self.PwaLib.buildShellCacheName(CACHE_VERSION);

var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/theme.js',
  '/popup-nav.js',
  '/pwa-lib.js',
  '/sw-register.js',
  '/tile-order.js',
  '/output-toolbar.js',
  '/local-state.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/tools/json-formatter.html',
  '/tools/regex-tester.html',
  '/tools/cron-builder.html',
  '/tools/password-generator.html',
  '/tools/base64-tool.html',
  '/tools/color-converter.html',
  '/tools/lib/json-tools.js',
  '/tools/lib/regex-explain.js',
  '/tools/lib/cron.js',
  '/tools/lib/password.js',
  '/tools/lib/base64.js',
  '/tools/lib/color.js',
  '/tools/lib/shortcuts.js',
  '/tools/lib/url-state.js',
  '/tools/lib/html-escape.js',
  '/tools/lib/regex-run.js',
  '/tools/lib/regex-worker.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(
          names
            .filter(function (name) { return self.PwaLib.isStaleShellCache(name, SHELL_CACHE); })
            .map(function (name) { return caches.delete(name); })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  // Only handle same-origin GET requests. Everything else -- POSTs to
  // /.netlify/functions/*, cross-origin AdSense/Google requests -- passes straight
  // through untouched, exactly as if this service worker didn't exist.
  if (!self.PwaLib.shouldHandleFetch(request.method, url.origin, self.location.origin)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(SHELL_CACHE).then(function (cache) { cache.put(request, copy); });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  if (self.PwaLib.isPrecachedAsset(url.pathname, PRECACHE_URLS)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        var network = fetch(request)
          .then(function (response) {
            var copy = response.clone();
            caches.open(SHELL_CACHE).then(function (cache) { cache.put(request, copy); });
            return response;
          })
          .catch(function () { return cached; });
        return cached || network;
      })
    );
  }
});
