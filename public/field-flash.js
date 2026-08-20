// CR#7 (Live Interaction, backlog #40): tiny shared DOM helper for "inline error-location
// mapping" -- flashing a field's border and/or jumping its text cursor to a specific
// character offset. Split out from error-location.js (which stays pure/DOM-free, consistent
// with the rest of tools/lib/*.js) because this half necessarily touches the DOM directly;
// this file is the one place that logic lives instead of being copy-pasted across JSON
// Formatter, Regex Tester, and Cron Builder.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FieldFlashLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var FLASH_CLASS = 'field-error-flash';
  var FLASH_DURATION_MS = 1000; // matches the fieldErrorFlash keyframe duration in style.css

  // Briefly flashes `el`'s border via the .field-error-flash CSS class (style.css). Restarts
  // cleanly even if called again mid-flash (e.g. the user keeps typing invalid JSON) by
  // removing the class and forcing a reflow before re-adding it -- without this, a second
  // call while the class is already present wouldn't restart the CSS animation at all.
  function flashError(el) {
    if (!el) return;
    el.classList.remove(FLASH_CLASS);
    // eslint-disable-next-line no-unused-expressions -- reading offsetWidth forces a reflow,
    // which is the actual point: it's what makes the browser "notice" the class was removed
    // before it gets added back, so the animation restarts instead of being a no-op.
    void el.offsetWidth;
    el.classList.add(FLASH_CLASS);
    setTimeout(function () {
      el.classList.remove(FLASH_CLASS);
    }, FLASH_DURATION_MS);
  }

  // Moves `el`'s (an <input> or <textarea>) text cursor/selection to the exact character
  // `index` (selecting one character so the position reads as a highlighted marker, not just
  // an invisible caret) and focuses it, which also scrolls that position into view in every
  // modern browser -- a real, native pointer to the exact error location, not a custom-built
  // overlay trying to reproduce the field's own font metrics (a fragile approach for
  // something a native API already does correctly).
  function jumpToPosition(el, index) {
    if (!el || typeof index !== 'number') return;
    var end = Math.min(index + 1, el.value.length);
    el.focus();
    el.setSelectionRange(index, end);
  }

  return {
    flashError,
    jumpToPosition,
  };
});
