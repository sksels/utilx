// Pure keyboard-shortcut matching, shared across tool pages and tests/shortcuts.test.js.
// Kept separate from DOM wiring so the matching logic itself is fully unit-testable.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShortcutsLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac) triggers a tool's primary action.
  // Accepts a plain object (or a real KeyboardEvent, which has these same fields) so it's
  // trivially testable without a DOM.
  function isRunShortcut(event) {
    if (!event) return false;
    return event.key === 'Enter' && (event.ctrlKey === true || event.metaKey === true);
  }

  return { isRunShortcut };
});
