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

  // Decodes Base64 to text. Two distinct failure modes, each with its own clear error:
  // (1) the input isn't valid Base64 at all, or (2) it's valid Base64 but the decoded
  // bytes aren't valid UTF-8 -- e.g. an image or other binary file that was Base64-encoded
  // elsewhere. Previously (2) used the default non-fatal TextDecoder, which silently
  // replaces invalid byte sequences with the U+FFFD replacement character ("(REPLACEMENT
  // CHARACTER)") instead of erroring -- so decoding binary data as text produced garbled
  // output with zero indication anything was wrong.
  function decodeBase64ToUtf8(input) {
    const str = String(input).trim();
    let bytes;
    try {
      const binary = atob(str);
      bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    } catch (e) {
      throw new Error('Not valid Base64 input.');
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      throw new Error('Decoded successfully, but the result is not valid UTF-8 text -- this is likely binary data (e.g. an image or file), not text. Try "Download output as file" instead.');
    }
  }

  function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) { base64 += '='; }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function isJsonObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  // Returns { header, payload, signature } with header/payload as parsed objects,
  // or throws if the input isn't a well-formed 3-part JWT with valid JSON object parts.
  // Header and payload are decoded/parsed independently with their own try/catch so the
  // error names which part is broken and why -- previously a broken header or payload
  // surfaced whatever cryptic native error atob()/JSON.parse() happened to throw
  // ("Unexpected token ... in JSON at position 0"), with no indication of which of the
  // two parts was the problem.
  function decodeJwt(input) {
    const parts = String(input).trim().split('.');
    if (parts.length !== 3) {
      throw new Error('A JWT needs exactly 3 dot-separated parts: header.payload.signature.');
    }

    let header;
    try {
      header = JSON.parse(base64UrlDecode(parts[0]));
    } catch (e) {
      throw new Error('JWT header is not valid Base64url-encoded JSON.');
    }
    if (!isJsonObject(header)) {
      throw new Error('JWT header must decode to a JSON object.');
    }

    let payload;
    try {
      payload = JSON.parse(base64UrlDecode(parts[1]));
    } catch (e) {
      throw new Error('JWT payload is not valid Base64url-encoded JSON.');
    }
    if (!isJsonObject(payload)) {
      throw new Error('JWT payload must decode to a JSON object.');
    }

    return { header, payload, signature: parts[2] };
  }

  return { encodeUtf8ToBase64, decodeBase64ToUtf8, base64UrlDecode, decodeJwt };
});
