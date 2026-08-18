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

test('deepDiff: tech debt fix -- no longer throws on nesting deep enough to blow the old call stack', () => {
  // The old recursive implementation hit the JS engine's call-stack limit around ~5,000
  // levels deep (see git history / tests/json-tools.test.js prior to the iterative rewrite),
  // even though JSON.parse itself comfortably handles 100,000+ levels. This test uses the
  // exact depth that used to throw and asserts it now resolves correctly instead.
  const depth = 5000;
  const a = JSON.parse('['.repeat(depth) + '1' + ']'.repeat(depth));
  const b = JSON.parse('['.repeat(depth) + '2' + ']'.repeat(depth));
  const diffs = JsonToolsLib.deepDiff(a, b, '', []);
  assert.equal(diffs.length, 1);
  assert.equal(diffs[0].type, 'changed');
  assert.equal(diffs[0].from, 1);
  assert.equal(diffs[0].to, 2);
  // Sanity-check the path was built correctly all the way down: depth-1 "[0]" segments.
  assert.equal(diffs[0].path, '[0]'.repeat(depth));
});

test('deepDiff: handles nesting an order of magnitude beyond the old call-stack limit', () => {
  // 50,000 levels deep -- ten times the depth that broke the old recursive version.
  // Only bounded by available memory now, not by V8's recursion limit.
  const depth = 50000;
  const a = JSON.parse('['.repeat(depth) + '1' + ']'.repeat(depth));
  const b = JSON.parse('['.repeat(depth) + '1' + ']'.repeat(depth));
  const diffs = JsonToolsLib.deepDiff(a, b, '', []);
  assert.equal(diffs.length, 0);
});

test('deepDiff: preserves original depth-first, left-to-right ordering of results', () => {
  // Regression guard for the recursion -> explicit-stack rewrite: verifies sibling order
  // and that a changed sibling's full subtree is emitted before the next sibling's diffs,
  // matching what the old recursive version produced.
  const a = { a: { x: 1, y: 1 }, b: 1, c: { z: 1 } };
  const b = { a: { x: 2, y: 2 }, b: 2, c: { z: 2 } };
  const diffs = JsonToolsLib.deepDiff(a, b, '', []);
  assert.deepEqual(
    diffs.map((d) => d.path),
    ['a.x', 'a.y', 'b', 'c.z']
  );
});

test('shortVal: truncates long values and labels undefined', () => {
  assert.equal(JsonToolsLib.shortVal(undefined), '(none)');
  const long = 'x'.repeat(100);
  const out = JsonToolsLib.shortVal(long);
  assert.ok(out.endsWith('...'));
  assert.ok(out.length <= 61);
});
