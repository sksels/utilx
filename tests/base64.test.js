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

test('decodeBase64ToUtf8: throws on invalid base64', () => {
  assert.throws(() => Base64Lib.decodeBase64ToUtf8('not valid base64!!'));
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
