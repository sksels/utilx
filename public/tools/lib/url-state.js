// Pure shareable-URL state encode/decode, shared across tool pages and tests/url-state.test.js.
// A tool's relevant fields get JSON-stringified, UTF-8-safe-base64url-encoded, and packed into
// a single "?s=" query param -- keeps every tool's sharing logic identical regardless of how
// many fields it has. Uses TextEncoder/TextDecoder so non-ASCII input (emoji, accents, etc.)
// round-trips correctly, same pattern as tools/lib/base64.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UrlStateLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function encodeState(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Accepts either a full query string (with or without leading "?") or just the encoded
  // value itself. Returns the decoded object, or null if absent/malformed -- never throws.
  function decodeState(search) {
    try {
      let encoded;
      if (typeof search === 'string' && (search.includes('=') || search.startsWith('?'))) {
        const params = new URLSearchParams(search);
        encoded = params.get('s');
      } else {
        encoded = search;
      }
      if (!encoded) return null;

      let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function buildShareUrl(origin, pathname, obj) {
    return origin + pathname + '?s=' + encodeState(obj);
  }

  return { encodeState, decodeState, buildShareUrl };
});
