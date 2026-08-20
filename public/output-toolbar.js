// Shared floating output toolbar (CR#6): one reusable copy/download control instead of a
// one-off "Copy"/"Download" button hand-wired per tool. A single toolbar instance is just
// declarative markup (see src/components/OutputToolbar.astro) -- a wrapping <div
// class="output-toolbar"> with one <button data-toolbar-action="copy|download"
// data-toolbar-target="<id of the element to read from>"> per action. This module wires
// every such button on the page via one delegated click listener, so any number of toolbar
// instances -- present now or added to a page later -- work with zero per-instance JS.
//
// Extensibility: adding a future action (zip the output, scramble the output, etc.) is just
// a new button with a new data-toolbar-action value plus one more `else if` branch below --
// no changes needed to the component, the CSS, or any tool page's wiring.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OutputToolbarLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Pure: reads the current text out of a toolbar's target element, whichever shape it is --
  // form controls (input/textarea, readonly or not) via .value, or a plain display element
  // (e.g. a <pre> block) via .textContent. Testable with a plain fake object, no real DOM
  // needed (see tests/output-toolbar.test.js).
  function readTargetText(el) {
    if (!el) return '';
    if ('value' in el) return el.value;
    return el.textContent || '';
  }

  // Impure: copies text to the clipboard via a temporary offscreen textarea + execCommand,
  // matching the copy mechanism already used sitewide (document.execCommand('copy') rather
  // than navigator.clipboard.writeText, which would require a permission prompt in some
  // browsers) -- kept consistent with every other copy button on the site.
  function copyText(text) {
    var temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
  }

  // Impure: triggers a browser download of `text` as a file named `filename`, same
  // Blob/createObjectURL pattern the Base64 tool's standalone download button already used.
  function downloadText(text, filename) {
    var blob = new Blob([text], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'output.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Impure: briefly flags a toolbar button as "copied" (color swap + tooltip swap) so the
  // user gets confirmation the click actually did something -- copy actions have no other
  // visible feedback otherwise. The actual color (--accent, a deliberate contrast against
  // .toolbar-btn's resting --toolbar-accent) lives in style.css, not here -- see
  // .toolbar-btn.copied and CR#8 backlog #51 in STYLE_GUIDE.md.
  function flashCopied(button) {
    if (!button) return;
    button.classList.add('copied');
    var original = button.getAttribute('title');
    button.setAttribute('title', 'Copied!');
    setTimeout(function () {
      button.classList.remove('copied');
      if (original) button.setAttribute('title', original);
    }, 1200);
  }

  // Impure: wires every toolbar button on the page via a single delegated click listener.
  // Must be called explicitly per page (not self-invoked at module load) -- this file is
  // require()'d directly in plain Node for tests/output-toolbar.test.js, where `document`
  // doesn't exist at all.
  function init() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-toolbar-action]') : null;
      if (!btn) return;
      var action = btn.getAttribute('data-toolbar-action');
      var targetId = btn.getAttribute('data-toolbar-target');
      var target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;

      if (action === 'copy') {
        copyText(readTargetText(target));
        flashCopied(btn);
      } else if (action === 'download') {
        var filename = btn.getAttribute('data-toolbar-filename') || 'output.txt';
        downloadText(readTargetText(target), filename);
      }
    });
  }

  return {
    readTargetText,
    copyText,
    downloadText,
    flashCopied,
    init,
  };
});
