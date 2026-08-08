// Pure Base64 / Base64url / JWT decoding logic shared by tools/base64-tool.html and
// tests/base64.test.js. Uses only atob/btoa/TextEncoder/TextDecoder, which are available
// as globals in both modern browsers and Node.js (v18+).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Base64Lib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function encodeUtf8ToBase64(input) {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  function decodeBase64ToUtf8(input) {
    const binary = atob(input.trim());
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) { base64 += '='; }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Returns { header, payload, signature } with header/payload as parsed objects,
  // or throws if the input isn't a well-formed 3-part JWT with valid JSON parts.
  function decodeJwt(input) {
    const parts = input.trim().split('.');
    if (parts.length !== 3) {
      throw new Error('A JWT needs exactly 3 dot-separated parts: header.payload.signature.');
    }
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return { header, payload, signature: parts[2] };
  }

  return { encodeUtf8ToBase64, decodeBase64ToUtf8, base64UrlDecode, decodeJwt };
});
