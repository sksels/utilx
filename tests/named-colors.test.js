const test = require('node:test');
const assert = require('node:assert/strict');
const NamedColorsLib = require('../public/tools/lib/named-colors.js');

test('nameToHex: resolves a well-known name to its exact hex value', () => {
  assert.equal(NamedColorsLib.nameToHex('cornflowerblue'), '#6495ed');
  assert.equal(NamedColorsLib.nameToHex('red'), '#ff0000');
  assert.equal(NamedColorsLib.nameToHex('rebeccapurple'), '#663399');
});

test('nameToHex: case-insensitive and ignores internal whitespace', () => {
  assert.equal(NamedColorsLib.nameToHex('CornflowerBlue'), '#6495ed');
  assert.equal(NamedColorsLib.nameToHex('CORNFLOWER BLUE'), '#6495ed');
  assert.equal(NamedColorsLib.nameToHex('  red  '), '#ff0000');
});

test('nameToHex: returns null (not undefined) for an unrecognized name', () => {
  assert.equal(NamedColorsLib.nameToHex('notacolor'), null);
  assert.equal(NamedColorsLib.nameToHex(''), null);
});

test('nameToHex: does not resolve "transparent" -- deliberately excluded, see file comment', () => {
  assert.equal(NamedColorsLib.nameToHex('transparent'), null);
});

test('hexToName: exact reverse lookup for a known value', () => {
  assert.equal(NamedColorsLib.hexToName('#ff0000'), 'red');
  assert.equal(NamedColorsLib.hexToName('#6495ed'), 'cornflowerblue');
});

test('hexToName: case-insensitive on the hex string itself', () => {
  assert.equal(NamedColorsLib.hexToName('#FF0000'), 'red');
});

test('hexToName: returns null for a hex value with no matching named color', () => {
  assert.equal(NamedColorsLib.hexToName('#123456'), null);
});

test('hexToName: gray/grey spelling variants both resolve independently (not a single collapsed entry)', () => {
  assert.equal(NamedColorsLib.hexToName('#808080'), 'gray'); // first match wins for shared hex values
  assert.equal(NamedColorsLib.nameToHex('gray'), '#808080');
  assert.equal(NamedColorsLib.nameToHex('grey'), '#808080');
});

test('allNames: returns exactly 148 sorted, unique names (147 SVG1.1/CSS3 keywords + rebeccapurple)', () => {
  const names = NamedColorsLib.allNames();
  assert.equal(names.length, 148);
  assert.equal(new Set(names).size, 148);
  const sorted = [...names].sort();
  assert.deepEqual(names, sorted);
});

test('allNames: every value in NAMED_COLORS is a valid 6-digit lowercase hex string', () => {
  const values = Object.values(NamedColorsLib.NAMED_COLORS);
  for (const v of values) {
    assert.match(v, /^#[0-9a-f]{6}$/, `${v} is not a valid lowercase 6-digit hex`);
  }
});
