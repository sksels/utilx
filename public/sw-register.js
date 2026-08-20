// Registers the UtilX service worker (which now updates silently in the background -- see
// service-worker.js's CR#7 note -- so there is no update toast/prompt here anymore), and
// shows a dismissible "Add to Home Screen" prompt when the browser reports the app is
// installable. That one decision (show install prompt) is pure and tested -- see the
// sibling pwa-lib.js and tests/pwa-lib.test.js.
(function () {
  var INSTALL_DISMISSED_KEY = 'utilx-install-dismissed';

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
    // CR#8 backlog #32: box/position CSS now lives on the shared .utilx-toast class (also
    // used by the clipboard-suggestion toast) -- see style.css.
    bar.className = 'utilx-toast';
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
    // Registration is fire-and-forget now -- the new worker calls skipWaiting() and
    // clients.claim() on its own (see service-worker.js), so there is nothing for this page
    // to do once it's registered. No 'controllerchange' reload listener either: letting a
    // background update silently take over future requests, without reloading the page the
    // user is actively using, is the whole point of the CR#7 change.
    navigator.serviceWorker.register('/service-worker.js').catch(function () {
      // Registration failing is non-fatal -- the site works exactly as it does today,
      // just without install/offline support for this visit.
    });
  });
})();
