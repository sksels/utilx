// CR#7 (Live Interaction): shared debounce helper for "no-click auto-processing" -- several
// tools now run their main action automatically as the user types instead of waiting for an
// explicit button click (JSON Formatter, Regex Tester, Cron Builder). Running the real
// processing function on every single keystroke would be wasteful (and, for Regex Tester,
// spins up a fresh Web Worker request mid-typing) -- debounce delays the call until the user
// pauses for `wait` ms, coalescing a burst of keystrokes into one call.
//
// Pure factory function (not a class), same style as the rest of these UMD libs -- returns a
// new debounced wrapper around `fn` each call, so it's trivially unit-testable with fake
// timers and safe to use independently per input field.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebounceLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Returns a debounced wrapper: calling it resets a `wait`-ms timer, and only the last call
  // within any `wait`-ms window actually invokes `fn` (with that call's arguments). Exposes
  // `.cancel()` to clear a pending call outright (e.g. when a field is cleared and any
  // in-flight auto-run should be dropped rather than firing with stale args).
  function debounce(fn, wait) {
    var timer = null;
    function debounced() {
      var args = arguments;
      var self = this;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        fn.apply(self, args);
      }, wait);
    }
    debounced.cancel = function () {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
    return debounced;
  }

  return {
    debounce,
  };
});
