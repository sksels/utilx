const test = require('node:test');
const assert = require('node:assert/strict');
const RegexRunLib = require('../public/tools/lib/regex-run.js');
const { escapeHtml } = require('../public/tools/lib/html-escape.js');

// Tech debt fix (ReDoS protection): this pure matching logic is what actually runs inside
// tools/lib/regex-worker.js (off the main thread, behind a timeout -- see
// runRegexInWorker() in tools/regex-tester.html). It's extracted here specifically so it's
// unit-testable without a browser/Worker environment. What these tests do NOT and cannot
// cover: the actual timeout+terminate() behavior, since that's inherently a browser Worker
// API with no Node equivalent. This function itself can still run unboundedly long on a
// catastrophic-backtracking pattern -- that's expected and by design; the worker+timeout is
// the mitigation, not this function.

test('runMatch: finds all matches with the global flag and reports the count', () => {
  const result = RegexRunLib.runMatch('\\d+', 'g', 'a1 b22 c333', escapeHtml);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3);
  assert.equal(result.results.length, 3);
});

test('runMatch: no matches still returns ok with count 0', () => {
  const result = RegexRunLib.runMatch('xyz', 'g', 'abc', escapeHtml);
  assert.equal(result.ok, true);
  assert.equal(result.count, 0);
  assert.equal(result.results.length, 0);
});

test('runMatch: reports groups when the pattern has capture groups', () => {
  const result = RegexRunLib.runMatch('(\\w+)@(\\w+)', 'g', 'user@host', escapeHtml);
  assert.equal(result.count, 1);
  assert.match(result.results[0], /Groups: \["user","host"\]/);
});

test('runMatch: invalid pattern returns ok:false with the engine message, not a thrown error', () => {
  const result = RegexRunLib.runMatch('(unterminated', 'g', 'text', escapeHtml);
  assert.equal(result.ok, false);
  assert.ok(typeof result.message === 'string' && result.message.length > 0);
});

test('runMatch: zero-width matches do not infinite-loop (lastIndex advances)', () => {
  const result = RegexRunLib.runMatch('a*', 'g', 'bbb', escapeHtml);
  assert.equal(result.ok, true);
  // Should terminate promptly rather than hang -- this is the existing zero-width guard,
  // unrelated to the Worker-based ReDoS protection but worth locking in since both live in
  // the same loop.
  assert.ok(result.count > 0 && result.count < 100);
});

test('runMatch: caps at 500 matches to bound output size on pathological "many tiny matches" input', () => {
  const text = 'a'.repeat(2000);
  const result = RegexRunLib.runMatch('a', 'g', text, escapeHtml);
  assert.ok(result.count <= 501); // loop breaks just after crossing 500
});

test('runMatch: escapes match content before it reaches the highlighted html (XSS safety)', () => {
  const result = RegexRunLib.runMatch('<[^>]*>', 'g', 'before <img src=x onerror=alert(1)> after', escapeHtml);
  assert.equal(result.ok, true);
  assert.doesNotMatch(result.html, /<img\b/);
  assert.match(result.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('runMatch: escapes surrounding (non-matched) text too, not just matches', () => {
  const result = RegexRunLib.runMatch('needle', 'g', '<script>alert(1)</script> needle', escapeHtml);
  assert.doesNotMatch(result.html, /<script>/);
});
