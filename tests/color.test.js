const test = require('node:test');
const assert = require('node:assert/strict');
const ColorLib = require('../public/tools/lib/color.js');

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

test('parseRgbString: accepts in-range values with or without "rgb()" wrapper', () => {
  assert.deepEqual(ColorLib.parseRgbString('91, 140, 255'), { r: 91, g: 140, b: 255 });
  assert.deepEqual(ColorLib.parseRgbString('rgb(0, 0, 0)'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(ColorLib.parseRgbString('rgb(255, 255, 255)'), { r: 255, g: 255, b: 255 });
});

test('parseRgbString: rejects out-of-range channels instead of returning invalid data (regression)', () => {
  // Previously this matched the loose \d+ regex with no upper-bound check, producing
  // { r: 999, g: 999, b: 999 } which downstream broke rgbToHex (#3e73e73e7, a 9-char
  // string) and rgbToHsl (391% lightness). Must be rejected outright instead.
  assert.equal(ColorLib.parseRgbString('999, 999, 999'), null);
  // Exact boundary: 255 is valid, 256 is the first invalid value -- pins the cutoff
  // precisely rather than only proving "very large numbers get rejected".
  assert.deepEqual(ColorLib.parseRgbString('255, 255, 255'), { r: 255, g: 255, b: 255 });
  assert.equal(ColorLib.parseRgbString('rgb(256, 0, 0)'), null);
});

test('parseRgbString: returns null for malformed input', () => {
  assert.equal(ColorLib.parseRgbString('banana'), null);
  assert.equal(ColorLib.parseRgbString(''), null);
});

test('parseRgbString: rejects negative numbers instead of silently dropping the sign (regression)', () => {
  // The un-anchored regex used to find "5, 100, 100" inside "-5, 100, 100", silently
  // treating a negative channel as if the minus sign wasn't there.
  assert.equal(ColorLib.parseRgbString('-5, 100, 100'), null);
});

test('parseRgbString: rejects decimals instead of silently truncating (regression)', () => {
  // The un-anchored regex used to skip past "91." and match "5, 140, 255" out of
  // "91.5, 140, 255", silently truncating the first channel.
  assert.equal(ColorLib.parseRgbString('91.5, 140, 255'), null);
});

test('parseRgbString: rejects a valid-looking substring embedded in other text (regression)', () => {
  // The un-anchored regex would match "91, 140, 255" inside "foo91, 140, 255bar" --
  // the whole (unwrapped) string must now be exactly three numbers, nothing else.
  assert.equal(ColorLib.parseRgbString('foo91, 140, 255bar'), null);
});

test('parseRgbString: accepts a valid alpha component as a 4th value (feature)', () => {
  // Alpha support was added deliberately after the Tech Debt hardening pass -- this
  // supersedes the old "reject any 4th component" regression test now that a 4th
  // component can legitimately be a validated alpha value.
  assert.deepEqual(ColorLib.parseRgbString('91, 140, 255, 0.5'), { r: 91, g: 140, b: 255, a: 0.5 });
  assert.deepEqual(ColorLib.parseRgbString('rgba(91, 140, 255, 0.5)'), { r: 91, g: 140, b: 255, a: 0.5 });
  assert.deepEqual(ColorLib.parseRgbString('rgba(0, 0, 0, 1)'), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(ColorLib.parseRgbString('rgba(0, 0, 0, 0)'), { r: 0, g: 0, b: 0, a: 0 });
});

test('parseRgbString: rejects an out-of-range or malformed alpha', () => {
  assert.equal(ColorLib.parseRgbString('rgba(91, 140, 255, 1.5)'), null);
  assert.equal(ColorLib.parseRgbString('rgba(91, 140, 255, -0.2)'), null);
  assert.equal(ColorLib.parseRgbString('rgba(91, 140, 255, banana)'), null);
});

test('parseHslString: accepts in-range values with or without "hsl()" wrapper and % signs', () => {
  assert.deepEqual(ColorLib.parseHslString('222, 100%, 68%'), { h: 222, s: 100, l: 68 });
  assert.deepEqual(ColorLib.parseHslString('hsl(0, 0%, 0%)'), { h: 0, s: 0, l: 0 });
  assert.deepEqual(ColorLib.parseHslString('360, 100, 100'), { h: 360, s: 100, l: 100 });
});

test('parseHslString: rejects out-of-range hue/saturation/lightness (regression)', () => {
  // hslToRgb has no internal bounds checking, so an out-of-range hue/saturation/lightness
  // previously flowed straight through and could produce negative or >255 RGB channels.
  assert.equal(ColorLib.parseHslString('999, 100%, 68%'), null);
  assert.equal(ColorLib.parseHslString('222, 500%, 68%'), null);
  assert.equal(ColorLib.parseHslString('222, 100%, 999%'), null);
  // Exact boundaries: 360/100/100 are valid, one past each is the first invalid value.
  assert.deepEqual(ColorLib.parseHslString('360, 100%, 100%'), { h: 360, s: 100, l: 100 });
  assert.equal(ColorLib.parseHslString('361, 100%, 100%'), null);
  assert.equal(ColorLib.parseHslString('360, 101%, 100%'), null);
  assert.equal(ColorLib.parseHslString('360, 100%, 101%'), null);
});

test('parseHslString: returns null for malformed input', () => {
  assert.equal(ColorLib.parseHslString('banana'), null);
  assert.equal(ColorLib.parseHslString(''), null);
});

test('parseHslString: rejects negative hue instead of silently dropping the sign (regression)', () => {
  assert.equal(ColorLib.parseHslString('-10, 100%, 50%'), null);
});

test('parseHslString: rejects a valid-looking substring embedded in other text (regression)', () => {
  assert.equal(ColorLib.parseHslString('hue is 222, 100%, 68% roughly'), null);
});

test('parseHslString: accepts a valid alpha component as a 4th value (feature)', () => {
  assert.deepEqual(ColorLib.parseHslString('222, 100%, 68%, 0.5'), { h: 222, s: 100, l: 68, a: 0.5 });
  assert.deepEqual(ColorLib.parseHslString('hsla(222, 100%, 68%, 0.5)'), { h: 222, s: 100, l: 68, a: 0.5 });
  assert.deepEqual(ColorLib.parseHslString('hsla(0, 0%, 0%, 1)'), { h: 0, s: 0, l: 0, a: 1 });
  assert.deepEqual(ColorLib.parseHslString('hsla(0, 0%, 0%, 0)'), { h: 0, s: 0, l: 0, a: 0 });
});

test('parseHslString: rejects an out-of-range or malformed alpha', () => {
  assert.equal(ColorLib.parseHslString('hsla(222, 100%, 68%, 1.5)'), null);
  assert.equal(ColorLib.parseHslString('hsla(222, 100%, 68%, -0.2)'), null);
  assert.equal(ColorLib.parseHslString('hsla(222, 100%, 68%, banana)'), null);
});

test('parseAnyColor: rejects out-of-range rgb triplets (regression, feeds the contrast checker)', () => {
  assert.equal(ColorLib.parseAnyColor('999, 999, 999'), null);
});

test('hexToRgb: 4-digit and 8-digit forms carry alpha', () => {
  assert.deepEqual(ColorLib.hexToRgb('#5b8cff80'), { r: 91, g: 140, b: 255, a: 0.5 });
  assert.deepEqual(ColorLib.hexToRgb('#5b8cffff'), { r: 91, g: 140, b: 255, a: 1 });
  assert.deepEqual(ColorLib.hexToRgb('#5b8cff00'), { r: 91, g: 140, b: 255, a: 0 });
  // 4-digit shorthand #rgba, each nibble doubled
  assert.deepEqual(ColorLib.hexToRgb('#f008'), { r: 255, g: 0, b: 0, a: 0.53 });
});

test('hexToRgb: 6-digit and 3-digit forms still return no alpha key (regression)', () => {
  const six = ColorLib.hexToRgb('#5b8cff');
  const three = ColorLib.hexToRgb('#fff');
  assert.equal('a' in six, false);
  assert.equal('a' in three, false);
});

test('hexToRgb: rejects malformed 4/8-digit hex', () => {
  assert.equal(ColorLib.hexToRgb('#5b8cffg0'), null);
  assert.equal(ColorLib.hexToRgb('#gggg'), null);
});

test('rgbToHex: optional alpha argument appends a 2-digit alpha byte', () => {
  assert.equal(ColorLib.rgbToHex(91, 140, 255), '#5b8cff');
  assert.equal(ColorLib.rgbToHex(91, 140, 255, 0.5), '#5b8cff80');
  assert.equal(ColorLib.rgbToHex(91, 140, 255, 1), '#5b8cffff');
  assert.equal(ColorLib.rgbToHex(91, 140, 255, 0), '#5b8cff00');
});

test('compositeOverWhite: opaque and alpha-less colors pass through unchanged', () => {
  assert.deepEqual(ColorLib.compositeOverWhite({ r: 91, g: 140, b: 255 }), { r: 91, g: 140, b: 255 });
  assert.deepEqual(ColorLib.compositeOverWhite({ r: 91, g: 140, b: 255, a: 1 }), { r: 91, g: 140, b: 255 });
});

test('compositeOverWhite: blends translucent colors toward white by alpha', () => {
  assert.deepEqual(ColorLib.compositeOverWhite({ r: 0, g: 0, b: 0, a: 0.5 }), { r: 128, g: 128, b: 128 });
  assert.deepEqual(ColorLib.compositeOverWhite({ r: 0, g: 0, b: 0, a: 0 }), { r: 255, g: 255, b: 255 });
});
