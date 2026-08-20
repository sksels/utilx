// CR#8 backlog #32: smart clipboard injection -- on the homepage, checks whether the
// clipboard already contains content that looks like JSON, a cron expression, a hex color,
// a JWT, or a Base64 token (see public/tools/lib/clipboard-detect.js for the pure matching
// logic), and if so shows a small dismissible suggestion toast ("Your clipboard looks like
// JSON -- open it in JSON Formatter?"). Confirmed choice: never auto-navigates -- opening a
// tool always requires an explicit click on "Open", exactly like the existing PWA
// install-prompt toast this reuses styling from.
//
// Real, deliberate limitation, not an oversight: navigator.clipboard.readText() is gated
// behind the 'clipboard-read' permission in every browser implementing the Async Clipboard
// API, and calling it without that permission already granted triggers the browser's own
// native "Allow [site] to see text and images copied to the clipboard?" prompt. Popping that
// dialog unprompted, the instant someone lands on the homepage, before they've asked this
// site for anything, is exactly the kind of intrusive behavior this feature exists to avoid
// (the same reasoning behind showing a dismissible toast instead of auto-navigating). So this
// only ever calls readText() when navigator.permissions reports the permission is ALREADY
// 'granted' -- it never itself requests permission, and does nothing otherwise. In practice:
// on a browser that supports querying the 'clipboard-read' permission and where the user has
// separately/previously granted clipboard access to this origin, the feature works;
// everywhere else (a fresh visit in any browser, or a browser like Firefox that doesn't
// support querying this permission at all) it's a silent no-op. That's the intended
// conservative trade-off, not a bug to "fix" by requesting permission anyway.
(function () {
  if (!('clipboard' in navigator) || typeof navigator.clipboard.readText !== 'function') return;
  if (!window.ClipboardDetectLib) return;

  var DISMISSED_KEY = 'utilx-clipboard-suggest-dismissed';
  var lastCheckedText = null;

  var TOOL_NAMES = {
    'json-formatter': 'JSON Formatter',
    'cron-builder': 'Cron Builder',
    'color-converter': 'Color Converter',
    'base64-tool': 'Base64 Tool',
  };

  function toolDisplayName(toolId) {
    return TOOL_NAMES[toolId] || toolId;
  }

  function isDismissedForThisText(text) {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === text;
    } catch (e) {
      return false;
    }
  }

  function rememberDismissed(text) {
    try { sessionStorage.setItem(DISMISSED_KEY, text); } catch (e) { /* fine, may re-show next check */ }
  }

  function showSuggestion(text, match) {
    // Never stack a second suggestion on top of one already showing -- and if the install
    // prompt is *also* showing (both anchored via .utilx-toast, but at opposite viewport
    // edges -- see style.css), this one still renders independently without colliding.
    if (document.getElementById('utilx-clipboard-toast')) return;

    var bar = document.createElement('div');
    bar.id = 'utilx-clipboard-toast';
    bar.className = 'utilx-toast';
    bar.setAttribute('role', 'status');

    var label = document.createElement('span');
    label.className = 'utilx-toast-label';
    label.textContent = 'Your clipboard looks like ' + match.label + ' — open it in ' + toolDisplayName(match.toolId) + '?';

    var openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', function () {
      window.location.href = match.url;
    });

    var dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'utilx-toast-dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss');
    dismissBtn.innerHTML = '&times;';
    dismissBtn.addEventListener('click', function () {
      bar.remove();
      rememberDismissed(text);
    });

    bar.appendChild(label);
    bar.appendChild(openBtn);
    bar.appendChild(dismissBtn);
    document.body.appendChild(bar);
  }

  function checkClipboard() {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') return;
    navigator.permissions.query({ name: 'clipboard-read' }).then(function (status) {
      if (status.state !== 'granted') return null;
      return navigator.clipboard.readText();
    }).then(function (text) {
      if (!text || text === lastCheckedText) return;
      lastCheckedText = text;
      if (isDismissedForThisText(text)) return;
      var match = window.ClipboardDetectLib.detectToolForText(text);
      if (match) showSuggestion(text, match);
    }).catch(function () {
      // Permission query unsupported, permission not granted, readText() rejected, clipboard
      // empty/non-text -- all treated identically: a silent no-op, never surfaced as an
      // error to the user.
    });
  }

  // Checks on load and every time the tab becomes visible again (covers "copied something in
  // another app, then switched back to this already-open tab" -- the scenario the backlog
  // item's "detect clipboard content on page focus" wording describes) -- not on every
  // window `focus` event, which fires far more often (e.g. clicking back into the same tab
  // from a devtools panel) than the user's clipboard is likely to have actually changed.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkClipboard();
  });
  checkClipboard();
})();
