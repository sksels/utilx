const test = require('node:test');
const assert = require('node:assert/strict');
const ErrorLocationLib = require('../public/error-location.js');

// --- lineColumnAt ---

test('lineColumnAt: index 0 is line 1, column 1', () => {
  assert.deepEqual(ErrorLocationLib.lineColumnAt('abc', 0), { line: 1, column: 1 });
});

test('lineColumnAt: an index on the first line', () => {
  assert.deepEqual(ErrorLocationLib.lineColumnAt('abcdef', 3), { line: 1, column: 4 });
});

test('lineColumnAt: an index right after one newline starts line 2 at column 1', () => {
  assert.deepEqual(ErrorLocationLib.lineColumnAt('ab\ncd', 3), { line: 2, column: 1 });
});

test('lineColumnAt: an index partway through the second line', () => {
  assert.deepEqual(ErrorLocationLib.lineColumnAt('ab\ncdef', 6), { line: 2, column: 4 });
});

test('lineColumnAt: multiple newlines are all counted', () => {
  assert.deepEqual(ErrorLocationLib.lineColumnAt('a\nb\nc\nd', 6), { line: 4, column: 1 });
});

test('lineColumnAt: an index past the end of the text clamps to the text length', () => {
  assert.deepEqual(ErrorLocationLib.lineColumnAt('abc', 999), { line: 1, column: 4 });
});

test('lineColumnAt: a negative index clamps to 0', () => {
  assert.deepEqual(ErrorLocationLib.lineColumnAt('abc', -5), { line: 1, column: 1 });
});

// --- indexAt ---

test('indexAt: line 1 column 1 is index 0', () => {
  assert.equal(ErrorLocationLib.indexAt('abc', 1, 1), 0);
});

test('indexAt: line 1, some column further in', () => {
  assert.equal(ErrorLocationLib.indexAt('abcdef', 1, 4), 3);
});

test('indexAt: line 2 column 1 lands right after the newline', () => {
  assert.equal(ErrorLocationLib.indexAt('ab\ncd', 2, 1), 3);
});

test('indexAt: a column past the end of its line clamps to the text length', () => {
  assert.equal(ErrorLocationLib.indexAt('ab\ncd', 2, 999), 5);
});

test('indexAt: a line past the end of the text clamps to the text length', () => {
  assert.equal(ErrorLocationLib.indexAt('ab\ncd', 99, 1), 5);
});

test('indexAt and lineColumnAt round-trip for an arbitrary position', () => {
  const text = 'line one\nline two\nline three has more text';
  const index = 20;
  const loc = ErrorLocationLib.lineColumnAt(text, index);
  assert.equal(ErrorLocationLib.indexAt(text, loc.line, loc.column), index);
});

// --- locateJsonError ---

test('locateJsonError: extracts a V8-style "position N" and derives line/column', () => {
  const text = '{"a":1,\n"b":}';
  const result = ErrorLocationLib.locateJsonError('Unexpected token } in JSON at position 12', text);
  assert.deepEqual(result, { index: 12, ...ErrorLocationLib.lineColumnAt(text, 12) });
});

test('locateJsonError: extracts a SpiderMonkey-style "line L column C" directly', () => {
  const text = '{\n  "a": }';
  const result = ErrorLocationLib.locateJsonError('JSON.parse: unexpected character at line 2 column 9 of the JSON data', text);
  assert.deepEqual(result, { index: ErrorLocationLib.indexAt(text, 2, 9), line: 2, column: 9 });
});

test('locateJsonError: position takes precedence when a message somehow has both forms', () => {
  const text = 'abcdefghij';
  const result = ErrorLocationLib.locateJsonError('at position 3, also line 1 column 9', text);
  assert.equal(result.index, 3);
});

test('locateJsonError: falls back to the scanner when the message has no position info', () => {
  // "Unexpected end of JSON input" carries no position of its own -- this is exactly the
  // real-world gap findJsonSyntaxError exists to close. The scanner should still find that
  // an object was opened but never closed.
  const result = ErrorLocationLib.locateJsonError('Unexpected end of JSON input', '{');
  assert.deepEqual(result, { index: 1, line: 1, column: 2 });
});

test('locateJsonError: returns null when both the message and the scanner find nothing wrong', () => {
  // Contrived (locateJsonError is only ever called after JSON.parse already threw in real
  // use), but confirms the "nothing found" path stays null rather than throwing.
  assert.equal(ErrorLocationLib.locateJsonError(undefined, '{}'), null);
  assert.equal(ErrorLocationLib.locateJsonError(null, '{}'), null);
});

test('locateJsonError: returns null for a non-string text', () => {
  assert.equal(ErrorLocationLib.locateJsonError('at position 3', undefined), null);
});

test('locateJsonError: a position beyond the text length clamps rather than throwing', () => {
  const text = 'abc';
  const result = ErrorLocationLib.locateJsonError('at position 999', text);
  assert.equal(result.index, 3);
});

// --- findJsonSyntaxError: the scanner fallback, exercised directly against the real-world
// mistakes it exists to catch (V8's "Unexpected token 'x', "..." is not valid JSON" message
// format carries no position at all for any of these) ---

test('findJsonSyntaxError: a trailing comma in an object', () => {
  const text = '{"a":1,"b":2,}';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.index, 13); // the "}" right after the stray comma
});

test('findJsonSyntaxError: a trailing comma in an array', () => {
  const text = '[1,2,3,]';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.index, 7); // the "]" right after the stray comma
});

test('findJsonSyntaxError: an unquoted object key', () => {
  const text = '{a:1}';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.index, 1); // where a quote was expected
});

test('findJsonSyntaxError: a missing colon after a key', () => {
  const text = '{"a" 1}';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.index, 5); // where ":" was expected
});

test('findJsonSyntaxError: a missing comma between object entries', () => {
  const text = '{"a":1 "b":2}';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.index, 7); // where "," or "}" was expected
});

test('findJsonSyntaxError: an invalid literal (bare undefined, not valid JSON)', () => {
  const text = '{"a":undefined}';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.index, 5); // right where the value was expected to start
});

test('findJsonSyntaxError: an unterminated string reports the opening quote', () => {
  const text = '{"a":"unterminated}';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.index, 5);
});

test('findJsonSyntaxError: an unclosed object reports the position just after the last token', () => {
  const text = '{"a":1';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.index, 6);
});

test('findJsonSyntaxError: an unmatched closing bracket with no opener', () => {
  const text = '"a":1}';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  // parseValue() reads the leading string "a" as a complete, valid top-level value, then the
  // "trailing content after JSON value" check catches the rest starting at the colon.
  assert.equal(result.index, 3);
});

test('findJsonSyntaxError: valid JSON returns null (nothing to report)', () => {
  assert.equal(ErrorLocationLib.findJsonSyntaxError('{"a":[1,2,3],"b":{"c":true,"d":null}}'), null);
});

test('findJsonSyntaxError: an empty string reports position 0', () => {
  const result = ErrorLocationLib.findJsonSyntaxError('');
  assert.equal(result.index, 0);
});

test('findJsonSyntaxError: locates the error on a later line, not just a character offset', () => {
  const text = '{\n  "a": 1,\n  "b":\n}';
  const result = ErrorLocationLib.findJsonSyntaxError(text);
  assert.equal(result.line, 4);
});
