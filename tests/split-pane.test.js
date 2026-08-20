const test = require('node:test');
const assert = require('node:assert/strict');
const SplitPaneLib = require('../public/split-pane.js');

// --- clamp ---

test('clamp: a value inside the range passes through unchanged', () => {
  assert.equal(SplitPaneLib.clamp(50, 20, 80), 50);
});

test('clamp: a value below the minimum clamps to the minimum', () => {
  assert.equal(SplitPaneLib.clamp(5, 20, 80), 20);
});

test('clamp: a value above the maximum clamps to the maximum', () => {
  assert.equal(SplitPaneLib.clamp(95, 20, 80), 80);
});

test('clamp: a value exactly at the minimum stays there', () => {
  assert.equal(SplitPaneLib.clamp(20, 20, 80), 20);
});

test('clamp: a value exactly at the maximum stays there', () => {
  assert.equal(SplitPaneLib.clamp(80, 20, 80), 80);
});

test('clamp: NaN falls back to the minimum rather than propagating', () => {
  assert.equal(SplitPaneLib.clamp(NaN, 20, 80), 20);
});

test('clamp: a non-number falls back to the minimum rather than throwing', () => {
  assert.equal(SplitPaneLib.clamp(undefined, 20, 80), 20);
  assert.equal(SplitPaneLib.clamp('50', 20, 80), 20);
});

// --- ratioFromPointerX ---

test('ratioFromPointerX: pointer at the container\'s left edge is 0%', () => {
  assert.equal(SplitPaneLib.ratioFromPointerX(100, 400, 100), 0);
});

test('ratioFromPointerX: pointer at the container\'s right edge is 100%', () => {
  assert.equal(SplitPaneLib.ratioFromPointerX(100, 400, 500), 100);
});

test('ratioFromPointerX: pointer at the container\'s midpoint is 50%', () => {
  assert.equal(SplitPaneLib.ratioFromPointerX(100, 400, 300), 50);
});

test('ratioFromPointerX: a pointer left of the container returns a negative percentage (caller clamps)', () => {
  assert.equal(SplitPaneLib.ratioFromPointerX(100, 400, 0), -25);
});

test('ratioFromPointerX: a pointer right of the container returns a percentage over 100 (caller clamps)', () => {
  assert.equal(SplitPaneLib.ratioFromPointerX(100, 400, 900), 200);
});

test('ratioFromPointerX: a zero-width container returns the default ratio rather than dividing by zero', () => {
  assert.equal(SplitPaneLib.ratioFromPointerX(100, 0, 150), SplitPaneLib.DEFAULT_RATIO);
});

// --- parseSavedRatio ---
// Regression coverage for a real bug caught before shipping: LocalStateLib.loadPref()
// returns null (not undefined) when nothing is saved yet, and Number(null) is 0, not NaN --
// so a naive `Number(loadPref(...))` would treat "nothing saved" as a valid 0% ratio
// (clamping to MIN_RATIO, a lopsided 20/80 split) instead of falling back to DEFAULT_RATIO.

test('parseSavedRatio: null (nothing saved yet) falls back to the default, not MIN_RATIO', () => {
  assert.equal(SplitPaneLib.parseSavedRatio(null), SplitPaneLib.DEFAULT_RATIO);
});

test('parseSavedRatio: undefined also falls back to the default', () => {
  assert.equal(SplitPaneLib.parseSavedRatio(undefined), SplitPaneLib.DEFAULT_RATIO);
});

test('parseSavedRatio: an empty string falls back to the default', () => {
  assert.equal(SplitPaneLib.parseSavedRatio(''), SplitPaneLib.DEFAULT_RATIO);
});

test('parseSavedRatio: a valid saved ratio (as the string localStorage would return) is used as-is', () => {
  assert.equal(SplitPaneLib.parseSavedRatio('65'), 65);
});

test('parseSavedRatio: a saved ratio outside the min/max range clamps', () => {
  assert.equal(SplitPaneLib.parseSavedRatio('5'), SplitPaneLib.MIN_RATIO);
  assert.equal(SplitPaneLib.parseSavedRatio('95'), SplitPaneLib.MAX_RATIO);
});

test('parseSavedRatio: garbage (non-numeric) saved data falls back to the default rather than clamping to MIN_RATIO', () => {
  assert.equal(SplitPaneLib.parseSavedRatio('not-a-number'), SplitPaneLib.DEFAULT_RATIO);
});

// --- exported constants sanity ---

test('exported MIN/MAX/DEFAULT ratios are sane and consistent with each other', () => {
  assert.ok(SplitPaneLib.MIN_RATIO < SplitPaneLib.DEFAULT_RATIO);
  assert.ok(SplitPaneLib.DEFAULT_RATIO < SplitPaneLib.MAX_RATIO);
  assert.equal(SplitPaneLib.DEFAULT_RATIO, 50);
});

// --- init: defensive no-op on missing elements (the one init() behavior testable without a DOM) ---

test('init: does nothing and does not throw when any required element is missing', () => {
  assert.doesNotThrow(() => SplitPaneLib.init(null, {}, {}, {}, 'key'));
  assert.doesNotThrow(() => SplitPaneLib.init({}, null, {}, {}, 'key'));
  assert.doesNotThrow(() => SplitPaneLib.init({}, {}, null, {}, 'key'));
  assert.doesNotThrow(() => SplitPaneLib.init({}, {}, {}, null, 'key'));
});
