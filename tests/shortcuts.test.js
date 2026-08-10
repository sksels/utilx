const test = require('node:test');
const assert = require('node:assert/strict');
const ShortcutsLib = require('../tools/lib/shortcuts.js');

test('isRunShortcut: Ctrl+Enter matches', () => {
  assert.equal(ShortcutsLib.isRunShortcut({ key: 'Enter', ctrlKey: true, metaKey: false }), true);
});

test('isRunShortcut: Cmd+Enter (metaKey) matches', () => {
  assert.equal(ShortcutsLib.isRunShortcut({ key: 'Enter', ctrlKey: false, metaKey: true }), true);
});

test('isRunShortcut: plain Enter does not match', () => {
  assert.equal(ShortcutsLib.isRunShortcut({ key: 'Enter', ctrlKey: false, metaKey: false }), false);
});

test('isRunShortcut: Ctrl+other key does not match', () => {
  assert.equal(ShortcutsLib.isRunShortcut({ key: 'a', ctrlKey: true, metaKey: false }), false);
});

test('isRunShortcut: extra modifiers (Shift) alongside Ctrl+Enter still match', () => {
  assert.equal(ShortcutsLib.isRunShortcut({ key: 'Enter', ctrlKey: true, metaKey: false, shiftKey: true }), true);
});

test('isRunShortcut: handles missing/undefined event gracefully', () => {
  assert.equal(ShortcutsLib.isRunShortcut(undefined), false);
  assert.equal(ShortcutsLib.isRunShortcut(null), false);
  assert.equal(ShortcutsLib.isRunShortcut({}), false);
});
