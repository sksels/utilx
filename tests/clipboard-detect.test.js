const test = require('node:test');
const assert = require('node:assert/strict');
const ClipboardDetectLib = require('../public/tools/lib/clipboard-detect.js');

test('detectToolForText: matches a JSON object', () => {
  const result = ClipboardDetectLib.detectToolForText('{"name":"Ada","active":true}');
  assert.deepEqual(result, { toolId: 'json-formatter', url: '/tools/json-formatter.html', label: 'JSON' });
});

test('detectToolForText: matches a JSON array', () => {
  const result = ClipboardDetectLib.detectToolForText('[1, 2, 3, "four"]');
  assert.equal(result.toolId, 'json-formatter');
});

test('detectToolForText: matches a standard 5-field cron expression', () => {
  const result = ClipboardDetectLib.detectToolForText('*/15 9-17 * * MON-FRI');
  assert.deepEqual(result, { toolId: 'cron-builder', url: '/tools/cron-builder.html', label: 'a cron expression' });
});

test('detectToolForText: does not match an invalid 5-field cron expression (out-of-range values)', () => {
  // 99 is not a valid minute -- five space-separated fields alone isn't enough, it also has
  // to be a *valid* cron per CronLib's own field-range rules (reused, not reimplemented here).
  assert.equal(ClipboardDetectLib.detectToolForText('99 99 99 99 99'), null);
});

test('detectToolForText: matches a hex color, only with a leading #', () => {
  assert.deepEqual(
    ClipboardDetectLib.detectToolForText('#5b8cff'),
    { toolId: 'color-converter', url: '/tools/color-converter.html', label: 'a hex color' }
  );
  assert.deepEqual(
    ClipboardDetectLib.detectToolForText('#fff'),
    { toolId: 'color-converter', url: '/tools/color-converter.html', label: 'a hex color' }
  );
});

test('detectToolForText: a bare 6-hex-digit string with no # does NOT match (git-SHA-safe)', () => {
  // Deliberate precision choice, see the file's own header comment -- "a1b2c3" alone is just
  // as likely to be a truncated git commit hash or a random ID as it is a color.
  assert.equal(ClipboardDetectLib.detectToolForText('5b8cffaa'), null);
});

test('detectToolForText: matches a JWT ahead of the generic base64 fallback', () => {
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSJ9.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
  const result = ClipboardDetectLib.detectToolForText(jwt);
  assert.deepEqual(result, { toolId: 'base64-tool', url: '/tools/base64-tool.html', label: 'a JWT' });
});

test('detectToolForText: matches a plain base64 token that is not JSON/cron/hex/JWT', () => {
  // "SGVsbG8sIFV0aWxYIHVzZXJzISBUaGlzIGlzIGEgdGVzdC4=" -- base64 of a plain sentence, no dots,
  // not a color, not JSON, not cron.
  const b64 = Buffer.from('Hello, UtilX users! This is a test.').toString('base64');
  const result = ClipboardDetectLib.detectToolForText(b64);
  assert.deepEqual(result, { toolId: 'base64-tool', url: '/tools/base64-tool.html', label: 'Base64' });
});

test('detectToolForText: does not match plain prose', () => {
  assert.equal(
    ClipboardDetectLib.detectToolForText('Just some ordinary sentence I copied from an email, nothing special.'),
    null
  );
});

test('detectToolForText: does not match base64-charset text containing whitespace (prose false-positive guard)', () => {
  // Individually base64-alphabet-safe words strung together with spaces should not match --
  // only a single unbroken base64 token does.
  assert.equal(ClipboardDetectLib.detectToolForText('cat dog fish bird ant bee'), null);
});

test('detectToolForText: rejects non-string, empty, whitespace-only, and too-short input', () => {
  assert.equal(ClipboardDetectLib.detectToolForText(null), null);
  assert.equal(ClipboardDetectLib.detectToolForText(undefined), null);
  assert.equal(ClipboardDetectLib.detectToolForText(42), null);
  assert.equal(ClipboardDetectLib.detectToolForText(''), null);
  assert.equal(ClipboardDetectLib.detectToolForText('   '), null);
  assert.equal(ClipboardDetectLib.detectToolForText('{}'), null); // valid JSON, but under MIN_LENGTH
});

test('detectToolForText: rejects oversized input rather than running every matcher against it', () => {
  const huge = '{"a":"' + 'x'.repeat(25000) + '"}';
  assert.equal(ClipboardDetectLib.detectToolForText(huge), null);
});
