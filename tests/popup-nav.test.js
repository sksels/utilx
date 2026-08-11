const test = require('node:test');
const assert = require('node:assert/strict');
const PopupNavLib = require('../popup-nav.js');

test('computeCenteredPosition: centers the popup on the screen', () => {
  const pos = PopupNavLib.computeCenteredPosition(1920, 1080, 1040, 800);
  assert.deepEqual(pos, { left: 440, top: 140 });
});

test('computeCenteredPosition: clamps to 0 instead of going negative on a small screen', () => {
  const pos = PopupNavLib.computeCenteredPosition(800, 600, 1040, 800);
  assert.deepEqual(pos, { left: 0, top: 0 });
});

test('buildFeaturesString: includes resizable and the given dimensions', () => {
  const features = PopupNavLib.buildFeaturesString(1040, 800, 440, 140);
  assert.match(features, /width=1040/);
  assert.match(features, /height=800/);
  assert.match(features, /left=440/);
  assert.match(features, /top=140/);
  assert.match(features, /resizable=yes/);
});

test('shouldIntercept: true for a plain left-click with no modifiers', () => {
  assert.equal(PopupNavLib.shouldIntercept({ button: 0 }), true);
  assert.equal(PopupNavLib.shouldIntercept({}), true);
});

test('shouldIntercept: false for middle-click (regression -- must not hijack "open in new tab")', () => {
  assert.equal(PopupNavLib.shouldIntercept({ button: 1 }), false);
});

test('shouldIntercept: false when a standard "new tab/window" modifier key is held', () => {
  assert.equal(PopupNavLib.shouldIntercept({ button: 0, ctrlKey: true }), false);
  assert.equal(PopupNavLib.shouldIntercept({ button: 0, metaKey: true }), false);
  assert.equal(PopupNavLib.shouldIntercept({ button: 0, shiftKey: true }), false);
  assert.equal(PopupNavLib.shouldIntercept({ button: 0, altKey: true }), false);
});

test('openToolPopup: falls back to normal navigation (returns true) when a modifier is held', () => {
  const result = PopupNavLib.openToolPopup({ button: 0, ctrlKey: true }, '/tools/json-formatter.html');
  assert.equal(result, true);
});
