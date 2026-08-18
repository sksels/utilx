const test = require('node:test');
const assert = require('node:assert/strict');
const TileOrderLib = require('../public/tile-order.js');

// Feature (backlog #6): user-customizable tile drag-and-drop layout. These tests cover the
// pure reconciliation/reorder logic; the actual drag-and-drop DOM wiring (initTileOrder) is
// a thin, directly-inspectable impure wrapper around these functions and isn't exercised
// here (no DOM/browser environment in node:test) -- see index.html for how it's wired up.

test('normalizeOrder: returns defaults unchanged when nothing is stored', () => {
  const result = TileOrderLib.normalizeOrder(['a', 'b', 'c'], null);
  assert.deepEqual(result, ['a', 'b', 'c']);
});

test('normalizeOrder: uses the stored order when it matches the default set exactly', () => {
  const result = TileOrderLib.normalizeOrder(['a', 'b', 'c'], ['c', 'a', 'b']);
  assert.deepEqual(result, ['c', 'a', 'b']);
});

test('normalizeOrder: ignores a non-array stored value (corrupted/old-format localStorage)', () => {
  assert.deepEqual(TileOrderLib.normalizeOrder(['a', 'b'], 'not-an-array'), ['a', 'b']);
  assert.deepEqual(TileOrderLib.normalizeOrder(['a', 'b'], { a: 1 }), ['a', 'b']);
  assert.deepEqual(TileOrderLib.normalizeOrder(['a', 'b'], undefined), ['a', 'b']);
});

test('normalizeOrder: appends tiles missing from the stored order (a new tool was added since)', () => {
  const result = TileOrderLib.normalizeOrder(['a', 'b', 'c', 'd'], ['c', 'a']);
  assert.deepEqual(result, ['c', 'a', 'b', 'd']);
});

test('normalizeOrder: drops stored ids that no longer exist (a tool was removed/renamed)', () => {
  const result = TileOrderLib.normalizeOrder(['a', 'b'], ['a', 'ghost-tool', 'b']);
  assert.deepEqual(result, ['a', 'b']);
});

test('normalizeOrder: de-duplicates a stored order that somehow has a repeated id', () => {
  const result = TileOrderLib.normalizeOrder(['a', 'b', 'c'], ['a', 'a', 'b']);
  assert.deepEqual(result, ['a', 'b', 'c']);
});

test('moveBefore: relocates the moved id to just before the target id', () => {
  const result = TileOrderLib.moveBefore(['a', 'b', 'c', 'd'], 'd', 'b');
  assert.deepEqual(result, ['a', 'd', 'b', 'c']);
});

test('moveBefore: moving forward past several items works the same as moving backward', () => {
  const result = TileOrderLib.moveBefore(['a', 'b', 'c', 'd'], 'a', 'd');
  assert.deepEqual(result, ['b', 'c', 'a', 'd']);
});

test('moveBefore: no-op (returns an equivalent copy) when moved and target are the same id', () => {
  const original = ['a', 'b', 'c'];
  const result = TileOrderLib.moveBefore(original, 'b', 'b');
  assert.deepEqual(result, original);
  assert.notEqual(result, original); // a copy, not the same reference
});

test('moveBefore: no-op when the target id does not exist in the order', () => {
  const result = TileOrderLib.moveBefore(['a', 'b', 'c'], 'a', 'nonexistent');
  assert.deepEqual(result, ['a', 'b', 'c']);
});

test('applyOrderToGrid: reorders DOM children to match the given order (using a minimal fake grid)', () => {
  // Minimal stand-in for a DOM element -- enough to exercise the real reordering logic
  // (querySelector + appendChild-moves-existing-node semantics) without needing jsdom.
  function makeCard(id) {
    return { dataset: { toolId: id } };
  }
  const cardA = makeCard('a');
  const cardB = makeCard('b');
  const cardC = makeCard('c');
  const children = [cardA, cardB, cardC];
  const fakeGrid = {
    querySelector(selector) {
      const id = selector.match(/data-tool-id="([^"]+)"/)[1];
      return children.find((c) => c.dataset.toolId === id) || null;
    },
    appendChild(card) {
      const idx = children.indexOf(card);
      if (idx !== -1) children.splice(idx, 1);
      children.push(card);
    },
  };

  TileOrderLib.applyOrderToGrid(fakeGrid, ['c', 'a', 'b']);
  assert.deepEqual(children.map((c) => c.dataset.toolId), ['c', 'a', 'b']);
});
