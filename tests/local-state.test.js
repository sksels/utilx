const test = require('node:test');
const assert = require('node:assert/strict');
const LocalStateLib = require('../public/local-state.js');

// pushRecent is the pure function in local-state.js -- loadPref/savePref/loadRecent/
// saveRecent/recordRecent/populateRecentSelect all touch localStorage/the DOM directly and
// aren't exercised here (no browser environment in node:test), consistent with how
// tile-order.js's pure functions are tested vs. its DOM-wiring functions.

test('pushRecent: adds a new value to the front of an empty list', () => {
  assert.deepEqual(LocalStateLib.pushRecent([], 'first'), ['first']);
});

test('pushRecent: adds a new value to the front, keeping older ones after it', () => {
  assert.deepEqual(LocalStateLib.pushRecent(['b', 'a'], 'c'), ['c', 'b', 'a']);
});

test('pushRecent: moves an existing duplicate value to the front instead of repeating it', () => {
  assert.deepEqual(LocalStateLib.pushRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
});

test('pushRecent: caps the list at max entries (default 5), dropping the oldest', () => {
  const result = LocalStateLib.pushRecent(['e', 'd', 'c', 'b', 'a'], 'f');
  assert.deepEqual(result, ['f', 'e', 'd', 'c', 'b']);
  assert.equal(result.length, 5);
});

test('pushRecent: respects a custom max', () => {
  const result = LocalStateLib.pushRecent(['b', 'a'], 'c', 2);
  assert.deepEqual(result, ['c', 'b']);
});

test('pushRecent: ignores an empty or whitespace-only value, returns the list unchanged', () => {
  assert.deepEqual(LocalStateLib.pushRecent(['a'], ''), ['a']);
  assert.deepEqual(LocalStateLib.pushRecent(['a'], '   '), ['a']);
});

test('pushRecent: ignores a non-string value, returns the list unchanged', () => {
  assert.deepEqual(LocalStateLib.pushRecent(['a'], undefined), ['a']);
  assert.deepEqual(LocalStateLib.pushRecent(['a'], null), ['a']);
});

test('pushRecent: treats a non-array stored list as empty instead of throwing', () => {
  assert.deepEqual(LocalStateLib.pushRecent('not-an-array', 'x'), ['x']);
  assert.deepEqual(LocalStateLib.pushRecent(undefined, 'x'), ['x']);
});

test('pushRecent: returns a new array, does not mutate the input list', () => {
  const original = ['a', 'b'];
  const result = LocalStateLib.pushRecent(original, 'c');
  assert.deepEqual(original, ['a', 'b']);
  assert.notEqual(result, original);
});
