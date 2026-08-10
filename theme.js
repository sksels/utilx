// Shared light/dark theme logic for every public page. Loaded synchronously as the very
// first thing in <head> (before the stylesheet) so the correct data-theme attribute is set
// before anything paints -- no flash of the wrong theme. See tests/theme.test.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var lib = factory();
    root.ThemeLib = lib;
    root.toggleTheme = lib.toggleTheme;
    lib.applyInitialTheme();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  var STORAGE_KEY = 'utilx-theme';

  // Pure: given whatever was in localStorage (or null) and whether the OS/browser
  // prefers light mode, decide which theme should apply.
  function resolveInitialTheme(storedValue, prefersLight) {
    if (storedValue === 'light' || storedValue === 'dark') return storedValue;
    return prefersLight ? 'light' : 'dark';
  }

  // Pure: flips a theme value.
  function nextTheme(current) {
    return current === 'light' ? 'dark' : 'light';
  }

  // Impure: touches localStorage/window/document. Runs once, immediately, in the browser.
  function applyInitialTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      var theme = resolveInitialTheme(stored, prefersLight);
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) { /* localStorage/matchMedia unavailable -- fall back to default dark CSS */ }
  }

  // Impure: called by the toggle button's onclick.
  function toggleTheme() {
    try {
      var current = document.documentElement.getAttribute('data-theme');
      var next = nextTheme(current);
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) { /* storage unavailable -- theme still flips for this page view */ }
  }

  return { STORAGE_KEY, resolveInitialTheme, nextTheme, applyInitialTheme, toggleTheme };
});
