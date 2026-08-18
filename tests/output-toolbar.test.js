const test = require('node:test');
const assert = require('node:assert/strict');
const OutputToolbarLib = require('../public/output-toolbar.js');

// readTargetText is the one pure function in output-toolbar.js -- everything else
// (copyText, downloadText, flashCopied, init) touches the real DOM/clipboard/Blob APIs and
// isn't exercised here (no browser environment in node:test), consistent with how the other
// DOM-wiring libs (tile-order.js, popup-nav.js) are tested in this suite.

test('readTargetText: reads .value from a form-control-like element (input/textarea)', () => {
  assert.equal(OutputToolbarLib.readTargetText({ value: 'hello world' }), 'hello world');
});

test('readTargetText: reads .value even when it is an empty string', () => {
  assert.equal(OutputToolbarLib.readTargetText({ value: '' }), '');
});

test('readTargetText: falls back to .textContent for a plain display element (e.g. <pre>)', () => {
  assert.equal(OutputToolbarLib.readTargetText({ textContent: 'plain text block' }), 'plain text block');
});

test('readTargetText: returns empty string when textContent is null/undefined', () => {
  assert.equal(OutputToolbarLib.readTargetText({ textContent: null }), '');
  assert.equal(OutputToolbarLib.readTargetText({}), '');
});

test('readTargetText: returns empty string for a null/undefined element instead of throwing', () => {
  assert.equal(OutputToolbarLib.readTargetText(null), '');
  assert.equal(OutputToolbarLib.readTargetText(undefined), '');
});

test('readTargetText: prefers .value over .textContent when both are present', () => {
  // Real <textarea>/<input> elements have both properties in a browser; .value is the
  // correct one to read (.textContent on a textarea reflects its initial HTML, not the
  // live user-edited value).
  assert.equal(OutputToolbarLib.readTargetText({ value: 'live value', textContent: 'stale initial content' }), 'live value');
});
