// Registers the UtilX service worker, shows a small "update available" toast once a new
// version has installed and is waiting to activate, and shows a dismissible "Add to Home
// Screen" prompt when the browser reports the app is installable. Both decisions (show
// update toast / show install prompt) are pure and tested -- see tools/lib's sibling
// pwa-lib.js and tests/pwa-lib.test.js. Refresh is always user-confirmed via the toast
// button, never a silent/automatic reload -- these tools all hold live user input (pasted
// JSON, a regex under test, etc.) that a surprise reload would throw away.
(function () {
  var INSTALL_DISMISSED_KEY = 'utilx-install-dismissed';

  function showUpdateToast(registration) {
    if (document.getElementById('utilx-update-toast')) return;

    var toast = document.createElement('div');
    toast.id = 'utilx-update-toast';
    toast.setAttribute('role', 'status');

    var label = document.createElement('span');
    label.className = 'utilx-toast-label';
    label.textContent = 'A new version of UtilX is available.';

    var refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', function () {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing…';
    });

    var dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'utilx-toast-dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.innerHTML = '&times;';
    dismissBtn.addEventListener('click', function () { toast.remove(); });

    toast.appendChild(label);
    toast.appendChild(refreshBtn);
    toast.appendChild(dismissBtn);
    document.body.appendChild(toast);
  }

  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch (e) {
      return false;
    }
  }

  function isInstallDismissed() {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function showInstallPrompt(deferredEvent) {
    if (document.getElementById('utilx-install-prompt')) return;

    var bar = document.createElement('div');
    bar.id = 'utilx-install-prompt';
    bar.setAttribute('role', 'status');

    var label = document.createElement('span');
    label.className = 'utilx-toast-label';
    label.textContent = 'Install UtilX for quicker access to your tools.';

    var installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.textContent = 'Add to Home Screen';
    installBtn.addEventListener('click', function () {
      bar.remove();
      deferredEvent.prompt();
      // No follow-up action needed on the user's choice (accepted/dismissed) --
      // the browser's own install UI handles that; we just don't ask again this
      // session either way, since deferredEvent can only be used once.
    });

    var dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'utilx-toast-dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.innerHTML = '&times;';
    dismissBtn.addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem(INSTALL_DISMISSED_KEY, '1'); } catch (e) { /* fine, just re-prompts next visit */ }
    });

    bar.appendChild(label);
    bar.appendChild(installBtn);
    bar.appendChild(dismissBtn);
    document.body.appendChild(bar);
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault(); // suppress the browser's default mini-infobar; we show our own
    if (window.PwaLib && window.PwaLib.shouldShowInstallPrompt(true, isStandalone(), isInstallDismissed())) {
      showInstallPrompt(event);
    }
  });

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js').then(function (registration) {
      // A worker was already waiting when this page loaded (installed via another tab).
      if (window.PwaLib.shouldShowUpdateToast(!!registration.waiting, !!navigator.serviceWorker.controller)) {
        showUpdateToast(registration);
      }

      registration.addEventListener('updatefound', function () {
        var newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function () {
          var hasController = !!navigator.serviceWorker.controller;
          if (newWorker.state === 'installed' && window.PwaLib.shouldShowUpdateToast(true, hasController)) {
            showUpdateToast(registration);
          }
        });
      });
    }).catch(function () {
      // Registration failing is non-fatal -- the site works exactly as it does today,
      // just without install/offline support for this visit.
    });

    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
})();
