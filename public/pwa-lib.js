// Pure decision logic shared by service-worker.js and sw-register.js, extracted into its
// own UMD module so it's testable with plain node:test the same way theme.js/url-state.js
// are -- no ServiceWorkerGlobalScope, caches API, or DOM required to test any of this.
// service-worker.js pulls this in via importScripts('/pwa-lib.js'); sw-register.js runs in
// a normal page so it just uses the global PwaLib the browser factory branch sets.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PwaLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var SHELL_PREFIX = 'utilx-shell-';

  function buildShellCacheName(version) {
    return SHELL_PREFIX + version;
  }

  // True if `name` is one of our own shell caches but not the current version -- i.e. it's
  // safe (and correct) to delete during the activate step.
  function isStaleShellCache(name, currentCacheName) {
    return name.indexOf(SHELL_PREFIX) === 0 && name !== currentCacheName;
  }

  // Only same-origin GET requests get intercepted by the fetch handler. Everything else
  // (POSTs to /.netlify/functions/*, cross-origin AdSense/Google requests) must pass
  // straight through untouched.
  function shouldHandleFetch(method, requestOrigin, selfOrigin) {
    return method === 'GET' && requestOrigin === selfOrigin;
  }

  function isPrecachedAsset(pathname, precacheUrls) {
    return precacheUrls.indexOf(pathname) !== -1;
  }

  // The "update available" toast should only appear when there's a worker genuinely
  // waiting to take over AND this is an update to an already-running app (a controller
  // already exists) -- not the very first install, which has no old version to update from.
  function shouldShowUpdateToast(hasWaitingWorker, hasController) {
    return !!(hasWaitingWorker && hasController);
  }

  // The custom "Add to Home Screen" prompt should only appear when the browser actually
  // fired beforeinstallprompt (so it's genuinely installable), the app isn't already
  // running in standalone/installed mode, and the user hasn't already dismissed it before.
  function shouldShowInstallPrompt(hasDeferredPrompt, isStandalone, dismissed) {
    return !!(hasDeferredPrompt && !isStandalone && !dismissed);
  }

  return {
    buildShellCacheName,
    isStaleShellCache,
    shouldHandleFetch,
    isPrecachedAsset,
    shouldShowUpdateToast,
    shouldShowInstallPrompt
  };
});
