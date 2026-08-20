const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const DebounceLib = require('../public/debounce.js');

// Uses node:test's built-in fake timers (mock.timers) instead of real setTimeout delays --
// keeps this suite fast and deterministic rather than actually waiting on a wall clock.

test('debounce: does not call fn immediately', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let calls = 0;
    const debounced = DebounceLib.debounce(() => { calls++; }, 100);
    debounced();
    assert.equal(calls, 0);
  } finally {
    mock.timers.reset();
  }
});

test('debounce: calls fn once after the wait elapses', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let calls = 0;
    const debounced = DebounceLib.debounce(() => { calls++; }, 100);
    debounced();
    mock.timers.tick(100);
    assert.equal(calls, 1);
  } finally {
    mock.timers.reset();
  }
});

test('debounce: a burst of calls within the wait window only invokes fn once', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let calls = 0;
    const debounced = DebounceLib.debounce(() => { calls++; }, 100);
    debounced();
    mock.timers.tick(50);
    debounced();
    mock.timers.tick(50);
    debounced();
    mock.timers.tick(50);
    // Only 50ms has elapsed since the last call so far -- fn should not have fired yet.
    assert.equal(calls, 0);
    mock.timers.tick(50);
    assert.equal(calls, 1);
  } finally {
    mock.timers.reset();
  }
});

test('debounce: passes through the arguments of the last call in a burst', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const received = [];
    const debounced = DebounceLib.debounce((value) => { received.push(value); }, 100);
    debounced('first');
    debounced('second');
    debounced('third');
    mock.timers.tick(100);
    assert.deepEqual(received, ['third']);
  } finally {
    mock.timers.reset();
  }
});

test('debounce: calling twice with a full wait in between invokes fn twice', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let calls = 0;
    const debounced = DebounceLib.debounce(() => { calls++; }, 100);
    debounced();
    mock.timers.tick(100);
    debounced();
    mock.timers.tick(100);
    assert.equal(calls, 2);
  } finally {
    mock.timers.reset();
  }
});

test('debounce: cancel() drops a pending call so fn never fires for it', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let calls = 0;
    const debounced = DebounceLib.debounce(() => { calls++; }, 100);
    debounced();
    debounced.cancel();
    mock.timers.tick(100);
    assert.equal(calls, 0);
  } finally {
    mock.timers.reset();
  }
});

test('debounce: cancel() with no pending call is a safe no-op', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const debounced = DebounceLib.debounce(() => {}, 100);
    assert.doesNotThrow(() => debounced.cancel());
  } finally {
    mock.timers.reset();
  }
});

test('debounce: each call to the factory returns an independent debounced instance', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let callsA = 0;
    let callsB = 0;
    const debouncedA = DebounceLib.debounce(() => { callsA++; }, 100);
    const debouncedB = DebounceLib.debounce(() => { callsB++; }, 50);
    debouncedA();
    debouncedB();
    mock.timers.tick(50);
    assert.equal(callsA, 0);
    assert.equal(callsB, 1);
    mock.timers.tick(50);
    assert.equal(callsA, 1);
    assert.equal(callsB, 1);
  } finally {
    mock.timers.reset();
  }
});
