const test = require('node:test');
const assert = require('node:assert/strict');
const RegexExplainLib = require('../tools/lib/regex-explain.js');

test('explainRegex: character class', () => {
  const lines = RegexExplainLib.explainRegex('[A-Z]');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /any character from the set "A-Z"/);
});

test('explainRegex: negated character class', () => {
  const lines = RegexExplainLib.explainRegex('[^0-9]');
  assert.match(lines[0], /any character NOT in the set "0-9"/);
});

test('explainRegex: quantifiers (*, +, ?, {n,m})', () => {
  assert.match(RegexExplainLib.explainRegex('a*')[0], /zero or more of/);
  assert.match(RegexExplainLib.explainRegex('a+')[0], /one or more of/);
  assert.match(RegexExplainLib.explainRegex('a?')[0], /zero or one \(optional\) of/);
  assert.match(RegexExplainLib.explainRegex('a{2,4}')[0], /between 2 and 4 of/);
  assert.match(RegexExplainLib.explainRegex('a{3}')[0], /exactly 3 of/);
  assert.match(RegexExplainLib.explainRegex('a{2,}')[0], /2 or more of/);
});

test('explainRegex: escape sequences', () => {
  assert.match(RegexExplainLib.explainRegex('\\d')[0], /any digit/);
  assert.match(RegexExplainLib.explainRegex('\\w')[0], /word character/);
  assert.match(RegexExplainLib.explainRegex('\\b')[0], /word boundary/);
});

test('normalizeFlags: strips whitespace so "g i m s"-style input still works (regression)', () => {
  // The "Common flags" reference table lists flags space-separated ("g i m s"), which a
  // user could easily read as literal syntax for the flags field -- without stripping,
  // "g i" throws "Invalid flags supplied to RegExp constructor 'g i'" instead of the
  // combination working as intended.
  assert.equal(RegexExplainLib.normalizeFlags('g i'), 'gi');
  assert.equal(RegexExplainLib.normalizeFlags(' gim s '), 'gims');
  assert.equal(RegexExplainLib.normalizeFlags('gi'), 'gi');
});

test('validateFlags: accepts valid flag combinations', () => {
  assert.equal(RegexExplainLib.validateFlags('g'), null);
  assert.equal(RegexExplainLib.validateFlags('gi'), null);
  assert.equal(RegexExplainLib.validateFlags('gims'), null);
  assert.equal(RegexExplainLib.validateFlags(''), null);
});

test('validateFlags: rejects invalid flags with a message naming flags, not the pattern (regression)', () => {
  // Previously a flags mistake was folded into runRegex()'s single generic
  // "Invalid pattern: ..." message, misdirecting the user to the wrong field.
  assert.match(RegexExplainLib.validateFlags('gg'), /^Invalid flags:/); // duplicate flag
  assert.match(RegexExplainLib.validateFlags('zz'), /^Invalid flags:/); // unknown flag chars
  assert.match(RegexExplainLib.validateFlags('g i'), /^Invalid flags:/); // un-normalized whitespace
});

test('explainRegex: literal run splits quantifier onto last char only (regression)', () => {
  // "abc*" means "ab" literal followed by zero-or-more "c" — a known tricky case
  // that was fixed to split the run rather than misapply the quantifier to the whole run.
  const lines = RegexExplainLib.explainRegex('abc*');
  assert.match(lines[0], /the literal text "ab"/);
  assert.match(lines[1], /zero or more of: the literal character "c"/);
});

test('explainRegex: capture group and non-capturing group', () => {
  assert.match(RegexExplainLib.explainRegex('(abc)')[0], /a capture group containing:/);
  assert.match(RegexExplainLib.explainRegex('(?:abc)')[0], /a non-capturing group containing:/);
});

test('explainRegex: lookahead / lookbehind variants', () => {
  assert.match(RegexExplainLib.explainRegex('(?=abc)')[0], /a lookahead/);
  assert.match(RegexExplainLib.explainRegex('(?!abc)')[0], /a negative lookahead/);
  assert.match(RegexExplainLib.explainRegex('(?<=abc)')[0], /a lookbehind/);
  assert.match(RegexExplainLib.explainRegex('(?<!abc)')[0], /a negative lookbehind/);
});

test('explainRegex: alternation', () => {
  const lines = RegexExplainLib.explainRegex('a|b');
  assert.ok(lines.some(l => l.includes('OR (alternation)')));
});

test('explainRegex: anchors', () => {
  assert.match(RegexExplainLib.explainRegex('^')[0], /start of the string/);
  assert.match(RegexExplainLib.explainRegex('$')[0], /end of the string/);
});
