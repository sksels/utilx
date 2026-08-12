// UtilX service worker -- precaches the installable app shell (the 6 tools + launcher)
// and applies two caching strategies depending on request type:
//   - HTML documents (navigations): network-first, cache as fallback only. This is
//     deliberate -- every real visit should still hit the network so the AdSense script
//     and the analytics beacon fire exactly as they would in a normal browser tab. The
//     cached shell only serves when the network request genuinely fails.
//   - Static assets (CSS/JS/icons): stale-while-revalidate. Serve the cached copy
//     instantly for speed, and refresh the cache in the background regardless.
//
// Update strategy: new installs sit in the "waiting" state and do NOT auto-activate.
// The page shows an "update available" toast (see sw-register.js) and only calls
// skipWaiting() once the user clicks Refresh -- never a silent forced reload, since
// these tools all involve live user input that a surprise reload could throw away.
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
  '/manifest.json',
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
  '/tools/lib/html-escape.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // No self.skipWaiting() here on purpose -- see update-strategy note above.
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

// The page's toast sends this once the user clicks "Refresh".
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
