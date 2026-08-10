const test = require('node:test');
const assert = require('node:assert/strict');
const UrlStateLib = require('../tools/lib/url-state.js');

test('encodeState / decodeState round trip (simple object)', () => {
  const state = { pattern: '\\d+', flags: 'g', text: 'abc123' };
  const encoded = UrlStateLib.encodeState(state);
  assert.deepEqual(UrlStateLib.decodeState(encoded), state);
});

test('encodeState / decodeState round trip (unicode -- emoji and accents)', () => {
  const state = { input: 'café 😀 über', note: 'unicode round trip' };
  const encoded = UrlStateLib.encodeState(state);
  assert.deepEqual(UrlStateLib.decodeState(encoded), state);
});

test('encodeState output is URL-safe (no +, /, or = characters)', () => {
  // Pick input likely to produce +, /, or = in standard base64.
  const encoded = UrlStateLib.encodeState({ text: 'a'.repeat(50) });
  assert.doesNotMatch(encoded, /[+/=]/);
});

test('decodeState accepts a full query string with a leading "?"', () => {
  const state = { hex: '#5b8cff' };
  const encoded = UrlStateLib.encodeState(state);
  assert.deepEqual(UrlStateLib.decodeState('?s=' + encoded), state);
});

test('decodeState accepts a query string without the leading "?"', () => {
  const state = { hex: '#5b8cff' };
  const encoded = UrlStateLib.encodeState(state);
  assert.deepEqual(UrlStateLib.decodeState('s=' + encoded), state);
});

test('decodeState returns null when the param is missing', () => {
  assert.equal(UrlStateLib.decodeState('?other=1'), null);
  assert.equal(UrlStateLib.decodeState(''), null);
});

test('decodeState returns null for malformed input instead of throwing', () => {
  assert.equal(UrlStateLib.decodeState('not-valid-base64url!!!'), null);
  assert.equal(UrlStateLib.decodeState(null), null);
  assert.equal(UrlStateLib.decodeState(undefined), null);
});

test('buildShareUrl assembles origin + pathname + encoded state', () => {
  const url = UrlStateLib.buildShareUrl('https://utilx.tools', '/tools/color-converter.html', { hex: '#5b8cff' });
  assert.ok(url.startsWith('https://utilx.tools/tools/color-converter.html?s='));
  const encoded = url.split('?s=')[1];
  assert.deepEqual(UrlStateLib.decodeState(encoded), { hex: '#5b8cff' });
});
