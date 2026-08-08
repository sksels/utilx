const test = require('node:test');
const assert = require('node:assert/strict');
const ColorLib = require('../tools/lib/color.js');

test('hexToRgb: 6-digit and 3-digit shorthand', () => {
  assert.deepEqual(ColorLib.hexToRgb('#5b8cff'), { r: 91, g: 140, b: 255 });
  assert.deepEqual(ColorLib.hexToRgb('#fff'), { r: 255, g: 255, b: 255 });
});

test('hexToRgb: rejects invalid input', () => {
  assert.equal(ColorLib.hexToRgb('not-a-color'), null);
});

test('rgbToHex round-trips with hexToRgb', () => {
  const rgb = ColorLib.hexToRgb('#5b8cff');
  assert.equal(ColorLib.rgbToHex(rgb.r, rgb.g, rgb.b), '#5b8cff');
});

test('rgbToHsl / hslToRgb round trip (within rounding tolerance)', () => {
  const rgb = { r: 91, g: 140, b: 255 };
  const hsl = ColorLib.rgbToHsl(rgb.r, rgb.g, rgb.b);
  const back = ColorLib.hslToRgb(hsl.h, hsl.s, hsl.l);
  for (const k of ['r', 'g', 'b']) {
    assert.ok(Math.abs(back[k] - rgb[k]) <= 2, `channel ${k}: expected ~${rgb[k]}, got ${back[k]}`);
  }
});

test('contrastRatio: black on white is 21:1', () => {
  const ratio = ColorLib.contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.ok(Math.abs(ratio - 21) < 0.01);
});

test('contrastRatio: identical colors is 1:1', () => {
  const ratio = ColorLib.contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 });
  assert.ok(Math.abs(ratio - 1) < 0.001);
});

test('parseAnyColor: accepts hex and rgb() strings', () => {
  assert.deepEqual(ColorLib.parseAnyColor('#5b8cff'), { r: 91, g: 140, b: 255 });
  assert.deepEqual(ColorLib.parseAnyColor('rgb(91, 140, 255)'), { r: 91, g: 140, b: 255 });
});

test('parseAnyColor: returns null for garbage', () => {
  assert.equal(ColorLib.parseAnyColor('banana'), null);
});
