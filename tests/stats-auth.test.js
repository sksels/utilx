const test = require('node:test');
const assert = require('node:assert/strict');
const { isAuthorized } = require('../netlify/functions/stats.js');

// Security release: netlify/functions/stats.js previously had no authentication at all --
// it relied only on robots.txt/noindex keeping the dashboard URL out of search engines,
// which is not real access control. These tests lock in the fixed behavior: the endpoint
// must fail CLOSED (reject) whenever the token is missing, wrong, or unconfigured -- an
// admin forgetting to set STATS_ACCESS_TOKEN should never mean "public by default."

function withEnv(value, fn) {
  const original = process.env.STATS_ACCESS_TOKEN;
  if (value === undefined) delete process.env.STATS_ACCESS_TOKEN;
  else process.env.STATS_ACCESS_TOKEN = value;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.STATS_ACCESS_TOKEN;
    else process.env.STATS_ACCESS_TOKEN = original;
  }
}

test('isAuthorized: fails closed when STATS_ACCESS_TOKEN is not configured, even with a token supplied', () => {
  withEnv(undefined, () => {
    assert.equal(isAuthorized({ headers: { 'x-stats-token': 'anything' } }), false);
  });
});

test('isAuthorized: rejects a missing token header', () => {
  withEnv('correct-secret', () => {
    assert.equal(isAuthorized({ headers: {} }), false);
  });
});

test('isAuthorized: rejects an incorrect token', () => {
  withEnv('correct-secret', () => {
    assert.equal(isAuthorized({ headers: { 'x-stats-token': 'wrong-secret' } }), false);
  });
});

test('isAuthorized: rejects a token that only partially matches (prefix)', () => {
  withEnv('correct-secret', () => {
    assert.equal(isAuthorized({ headers: { 'x-stats-token': 'correct' } }), false);
  });
});

test('isAuthorized: accepts the exact correct token', () => {
  withEnv('correct-secret', () => {
    assert.equal(isAuthorized({ headers: { 'x-stats-token': 'correct-secret' } }), true);
  });
});

test('isAuthorized: header lookup is case-tolerant for the common casings used by fetch()', () => {
  withEnv('correct-secret', () => {
    assert.equal(isAuthorized({ headers: { 'X-Stats-Token': 'correct-secret' } }), true);
  });
});
