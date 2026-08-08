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
