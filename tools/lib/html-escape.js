// Shared HTML-escaping helper used by every tool page before inserting any text derived
// from an Error's .message (or similar "shouldn't be attacker-controlled, but let's not bet
// on it") into innerHTML.
//
// Why this exists (security release): JS engine error messages can embed raw, attacker-
// controllable input verbatim -- confirmed via `new RegExp("<img src=x onerror=alert(1)>(")`,
// whose .message contains the full, unescaped <img> tag. Several tool pages restore their
// state from a URL query string and auto-run on page load (see restoreFromUrl in each tool),
// which turns "user types something weird into a field" into "attacker crafts a link, victim
// clicks it, JS runs no interaction needed" -- a reflected XSS. Escaping before innerHTML
// closes that off regardless of what any given error message happens to contain today.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HtmlEscapeLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { escapeHtml };
});
