const test = require('node:test');
const assert = require('node:assert/strict');
const Base64Lib = require('../tools/lib/base64.js');

test('encodeUtf8ToBase64 / decodeBase64ToUtf8 round trip (ASCII)', () => {
  const encoded = Base64Lib.encodeUtf8ToBase64('Hello, UtilX!');
  assert.equal(Base64Lib.decodeBase64ToUtf8(encoded), 'Hello, UtilX!');
});

test('encodeUtf8ToBase64 / decodeBase64ToUtf8 round trip (emoji + accents, UTF-8 correctness)', () => {
  const input = 'café 😀 über'; // "café 😀 über"
  const encoded = Base64Lib.encodeUtf8ToBase64(input);
  assert.equal(Base64Lib.decodeBase64ToUtf8(encoded), input);
});

test('decodeBase64ToUtf8: throws a clear error on invalid base64', () => {
  assert.throws(() => Base64Lib.decodeBase64ToUtf8('not valid base64!!'), /Not valid Base64 input/);
});

test('decodeBase64ToUtf8: throws a clear, distinct error for valid base64 that is not valid UTF-8 (regression)', () => {
  // Previously used the default non-fatal TextDecoder, which silently replaces invalid
  // byte sequences with U+FFFD instead of erroring -- so Base64-encoded binary data (e.g.
  // an image) decoded as "text" produced garbled replacement-character output with no
  // indication anything was wrong, rather than a clear error steering the user to the
  // existing "Download output as file" feature instead.
  const binaryAsBase64 = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString('base64');
  assert.throws(
    () => Base64Lib.decodeBase64ToUtf8(binaryAsBase64),
    /not valid UTF-8 text/
  );
});

test('decodeJwt: throws a clear error instead of a raw TypeError on non-string input (regression)', () => {
  // Previously input.trim() on null/undefined threw an uncaught native
  // "Cannot read properties of null (reading 'trim')" TypeError.
  assert.throws(() => Base64Lib.decodeJwt(null));
  assert.throws(() => Base64Lib.decodeJwt(undefined));
});

test('base64UrlDecode: handles - and _ substitutions and missing padding', () => {
  // "sub?123" base64url-ish round trip check via manual construction
  const original = '{"a":1}';
  const std = Buffer.from(original, 'utf-8').toString('base64');
  const urlSafe = std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.equal(Base64Lib.base64UrlDecode(urlSafe), original);
});

test('decodeJwt: decodes header and payload from a real-shaped JWT', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const { header, payload, signature } = Base64Lib.decodeJwt(jwt);
  assert.deepEqual(header, { alg: 'HS256', typ: 'JWT' });
  assert.deepEqual(payload, { sub: '1234567890' });
  assert.equal(signature, 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
});

test('decodeJwt: throws a clear error on malformed input', () => {
  assert.throws(() => Base64Lib.decodeJwt('not.a.valid.jwt.token'), /exactly 3 dot-separated parts/);
  assert.throws(() => Base64Lib.decodeJwt('only-one-part'), /exactly 3 dot-separated parts/);
});

test('decodeJwt: names the header specifically when it is not valid Base64url/JSON (regression)', () => {
  // Previously this surfaced a raw native error (e.g. "Unexpected token ... in JSON at
  // position 0") with no indication of which of the two parts -- header or payload --
  // was actually broken.
  const badHeaderJwt = 'not-valid-base64url!!.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig';
  assert.throws(() => Base64Lib.decodeJwt(badHeaderJwt), /JWT header is not valid/);
});

test('decodeJwt: names the payload specifically when it is not valid Base64url/JSON (regression)', () => {
  const badPayloadJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.not-valid-base64url!!.sig';
  assert.throws(() => Base64Lib.decodeJwt(badPayloadJwt), /JWT payload is not valid/);
});

test('decodeJwt: rejects a header/payload that decode to valid JSON but not a JSON object (regression)', () => {
  // A JWT header/payload that is technically valid JSON but not an object (e.g. just the
  // number 5) previously passed straight through with no complaint, even though no real
  // JWT header or payload is ever anything but an object.
  const numericHeader = Buffer.from('5', 'utf-8').toString('base64url');
  const validPayload = Buffer.from('{"sub":"123"}', 'utf-8').toString('base64url');
  assert.throws(() => Base64Lib.decodeJwt(numericHeader + '.' + validPayload + '.sig'), /JWT header must decode to a JSON object/);

  const validHeader = Buffer.from('{"alg":"HS256"}', 'utf-8').toString('base64url');
  const arrayPayload = Buffer.from('[1,2,3]', 'utf-8').toString('base64url');
  assert.throws(() => Base64Lib.decodeJwt(validHeader + '.' + arrayPayload + '.sig'), /JWT payload must decode to a JSON object/);
});
