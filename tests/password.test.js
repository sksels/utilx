const test = require('node:test');
const assert = require('node:assert/strict');
const PasswordLib = require('../tools/lib/password.js');

test('buildCharset: combines selected sets', () => {
  const cs = PasswordLib.buildCharset({ upper: true, lower: true, numbers: false, symbols: false });
  assert.match(cs, /^[A-Za-z]+$/);
  assert.ok(cs.includes('A') && cs.includes('a'));
});

test('buildCharset: empty when nothing selected', () => {
  assert.equal(PasswordLib.buildCharset({}), '');
});

test('buildCharset: excludeAmbiguous strips l1IO0', () => {
  const cs = PasswordLib.buildCharset({ upper: true, lower: true, numbers: true, excludeAmbiguous: true });
  for (const ch of ['l', '1', 'I', 'O', '0']) {
    assert.ok(!cs.includes(ch), `expected charset to exclude "${ch}"`);
  }
});

test('pickFromCharset: deterministic given fixed randomValues', () => {
  const charset = 'ABC';
  const randomValues = [0, 1, 2, 3]; // 0%3=A, 1%3=B, 2%3=C, 3%3=A
  assert.equal(PasswordLib.pickFromCharset(charset, 4, randomValues), 'ABCA');
});

test('pickFromCharset: throws instead of producing "undefined" repeated for an empty charset (regression)', () => {
  // charset[x % 0] evaluates to charset[NaN], i.e. undefined -- previously this silently
  // produced a "password" that was literally the text "undefined" repeated `length` times.
  assert.throws(() => PasswordLib.pickFromCharset('', 8, [1, 2, 3, 4, 5, 6, 7, 8]), /empty character set/);
});

test('pickFromCharset: throws instead of silently degrading into "undefined" when randomValues runs short (regression)', () => {
  // Same underlying failure as the empty-charset case, triggered once the loop reads past
  // the end of a randomValues array shorter than the requested length.
  assert.throws(() => PasswordLib.pickFromCharset('ABC', 8, [0, 1]), /Not enough random values/);
});

test('pickFromCharset: throws on a non-positive or non-integer length', () => {
  assert.throws(() => PasswordLib.pickFromCharset('ABC', 0, []), /positive integer/);
  assert.throws(() => PasswordLib.pickFromCharset('ABC', -5, []), /positive integer/);
  assert.throws(() => PasswordLib.pickFromCharset('ABC', 2.5, [1, 2]), /positive integer/);
});

test('buildCharset: does not throw when called with no options object', () => {
  assert.equal(PasswordLib.buildCharset(), '');
  assert.equal(PasswordLib.buildCharset(undefined), '');
});

test('computeEntropy + strengthLabel bands', () => {
  assert.equal(PasswordLib.strengthLabel(PasswordLib.computeEntropy(2, 200)), 'Very strong'); // way over 80
  assert.equal(PasswordLib.strengthLabel(10), 'Weak');
  assert.equal(PasswordLib.strengthLabel(45), 'Moderate');
  assert.equal(PasswordLib.strengthLabel(65), 'Strong');
  assert.equal(PasswordLib.strengthLabel(85), 'Very strong');
});

test('generateUuidV7: matches UUID v7 shape (version+variant nibbles)', () => {
  const rand = [0,0,0,0,0,0,0,0,0,0];
  const uuid = PasswordLib.generateUuidV7(Date.now(), rand);
  assert.match(uuid, PasswordLib.UUID_V7_RE);
});

test('generateUuidV7: embeds the timestamp in the first 48 bits, sorts chronologically', () => {
  const rand = new Array(10).fill(0);
  const early = PasswordLib.generateUuidV7(1700000000000, rand);
  const later = PasswordLib.generateUuidV7(1800000000000, rand);
  assert.ok(early < later, 'later timestamp should sort after earlier timestamp lexicographically');
});

test('generateUuidV7: is deterministic for identical inputs', () => {
  const rand = [1,2,3,4,5,6,7,8,9,10];
  const a = PasswordLib.generateUuidV7(1234567890123, rand);
  const b = PasswordLib.generateUuidV7(1234567890123, rand);
  assert.equal(a, b);
});

test('generateUuidV7: throws instead of silently zero-filling missing random bytes (regression)', () => {
  // Uint8Array coerces non-numeric (e.g. undefined) writes to 0 rather than throwing, so
  // under-supplying random bytes previously produced a validly-shaped but partly
  // zero-filled, less-random UUID with no indication anything was wrong -- a real weakened-
  // randomness bug, just not one that "looks broken" the way undefined-in-a-string does.
  assert.throws(() => PasswordLib.generateUuidV7(Date.now(), [1, 2, 3]), /requires at least 10 random bytes/);
  assert.throws(() => PasswordLib.generateUuidV7(Date.now(), []), /requires at least 10 random bytes/);
});
