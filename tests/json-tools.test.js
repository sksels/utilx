const test = require('node:test');
const assert = require('node:assert/strict');
const JsonToolsLib = require('../tools/lib/json-tools.js');

test('deepDiff: no differences on identical objects', () => {
  const diffs = JsonToolsLib.deepDiff({ a: 1 }, { a: 1 }, '', []);
  assert.equal(diffs.length, 0);
});

test('deepDiff: detects a changed scalar value', () => {
  const diffs = JsonToolsLib.deepDiff({ active: true }, { active: false }, '', []);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].type, 'changed');
  assert.equal(diffs[0].path, 'active');
});

test('deepDiff: detects an added key', () => {
  const diffs = JsonToolsLib.deepDiff({ a: 1 }, { a: 1, b: 2 }, '', []);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].type, 'added');
  assert.equal(diffs[0].path, 'b');
});

test('deepDiff: detects a removed key', () => {
  const diffs = JsonToolsLib.deepDiff({ a: 1, b: 2 }, { a: 1 }, '', []);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].type, 'removed');
  assert.equal(diffs[0].path, 'b');
});

test('deepDiff: nested paths use dot notation', () => {
  const diffs = JsonToolsLib.deepDiff({ user: { name: 'Ada' } }, { user: { name: 'Grace' } }, '', []);
  assert.equal(diffs[0].path, 'user.name');
});

test('deepDiff: array index paths and length changes', () => {
  const diffs = JsonToolsLib.deepDiff({ tags: ['a', 'b'] }, { tags: ['a', 'b', 'c'] }, '', []);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].path, 'tags[2]');
  assert.equal(diffs[0].type, 'added');
});

test('deepDiff: array vs object type change is a "changed" at root', () => {
  const diffs = JsonToolsLib.deepDiff([1, 2], { a: 1 }, '', []);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].path, '(root)');
  assert.equal(diffs[0].type, 'changed');
});

test('deepDiff: throws (rather than hanging or silently returning wrong results) on extremely deep nesting', () => {
  // Documents a real, confirmed boundary: JSON.parse itself comfortably handles 100,000+
  // levels of nesting, but deepDiff recurses once per nesting level and hits the call-stack
  // limit around ~5,000 levels -- a depth realistic for real-world deeply nested API
  // responses or tree structures. This is not fixed here (that would mean rewriting
  // deepDiff to use an explicit stack instead of recursion); the fix in json-formatter.html
  // is to catch this specific failure and show a clear "too deeply nested to compare"
  // message instead of the call silently doing nothing, which is what happened before.
  const depth = 5000;
  const a = JSON.parse('['.repeat(depth) + '1' + ']'.repeat(depth));
  const b = JSON.parse('['.repeat(depth) + '2' + ']'.repeat(depth));
  assert.throws(() => JsonToolsLib.deepDiff(a, b, '', []), /Maximum call stack/);
});

test('shortVal: truncates long values and labels undefined', () => {
  assert.equal(JsonToolsLib.shortVal(undefined), '(none)');
  const long = 'x'.repeat(100);
  const out = JsonToolsLib.shortVal(long);
  assert.ok(out.endsWith('...'));
  assert.ok(out.length <= 61);
});
