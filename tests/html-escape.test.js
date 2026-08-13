const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml } = require('../tools/lib/html-escape.js');

test('escapeHtml: escapes &, <, >', () => {
  assert.equal(escapeHtml('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
});

test('escapeHtml: leaves plain text untouched', () => {
  assert.equal(escapeHtml('Invalid JSON: Unexpected end of input'), 'Invalid JSON: Unexpected end of input');
});

test('escapeHtml: coerces non-strings', () => {
  assert.equal(escapeHtml(404), '404');
});

// Regression test for the security-release XSS fix: RegExp constructor error messages embed
// raw, attacker-controllable pattern text verbatim (confirmed against Node's V8 engine, same
// engine as Chrome). Regex Tester's shareable-link feature restores `pattern` from the URL
// and auto-runs it on page load, so an unescaped innerHTML assignment turned this into a
// reflected XSS triggerable by just clicking a crafted link -- no typing required. This test
// locks in that the exact confirmed-exploitable payload is neutralized before being rendered.
test('escapeHtml: neutralizes a confirmed-exploitable RegExp-error XSS payload', () => {
  const maliciousPattern = '<img src=x onerror=alert(1)>(';
  let engineMessage;
  try {
    new RegExp(maliciousPattern, 'g');
    assert.fail('expected RegExp constructor to throw on an unterminated group');
  } catch (e) {
    engineMessage = e.message;
  }
  // Sanity-check the premise still holds: the raw engine message really does embed the tag.
  assert.match(engineMessage, /<img src=x onerror=alert\(1\)>/);

  const rendered = '<div class="error-msg">Invalid pattern: ' + escapeHtml(engineMessage) + '</div>';
  assert.doesNotMatch(rendered, /<img\b/, 'a live <img> tag must never reach innerHTML');
  assert.match(rendered, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('escapeHtml: neutralizes a confirmed-exploitable RegExp-flags XSS payload', () => {
  const maliciousFlags = '<svg onload=alert(1)>';
  let engineMessage;
  try {
    new RegExp('', maliciousFlags);
    assert.fail('expected RegExp constructor to throw on invalid flags');
  } catch (e) {
    engineMessage = e.message;
  }
  assert.match(engineMessage, /<svg onload=alert\(1\)>/);

  const rendered = '<div class="error-msg">' + escapeHtml(engineMessage) + '</div>';
  assert.doesNotMatch(rendered, /<svg\b/, 'a live <svg> tag must never reach innerHTML');
});
