const test = require('node:test');
const assert = require('node:assert/strict');
const CronLib = require('../tools/lib/cron.js');

test('standard cron: numeric minute/hour', () => {
  const out = CronLib.explainStandardCron(['0', '9', '*', '*', '1-5']);
  assert.match(out, /at 09:00/);
  assert.match(out, /Monday through Friday/);
});

test('standard cron: every minute', () => {
  assert.match(CronLib.explainStandardCron(['*', '*', '*', '*', '*']), /Runs every minute\./);
});

test('standard cron: named single day (regression — bug fix)', () => {
  const out = CronLib.explainStandardCron(['0', '9', '*', '*', 'MON']);
  assert.match(out, /on Monday/);
});

test('standard cron: named day range', () => {
  const out = CronLib.explainStandardCron(['0', '9', '*', '*', 'MON-FRI']);
  assert.match(out, /Monday through Friday/);
});

test('standard cron: named day list', () => {
  const out = CronLib.explainStandardCron(['0', '9', '*', '*', 'MON,WED,FRI']);
  assert.match(out, /Monday, Wednesday, Friday/);
});

test('standard cron: named month', () => {
  const out = CronLib.explainStandardCron(['0', '0', '1', 'JAN', '*']);
  assert.match(out, /in January/);
});

test('quartz cron: numeric h/m/s', () => {
  const out = CronLib.explainQuartzCron(['0', '30', '9', '*', '*', '?']);
  assert.match(out, /at 09:30:00/);
});

test('quartz cron: named single day, correct offset (regression — off-by-one bug fix)', () => {
  // Quartz day-of-week: 1=Sunday ... 7=Saturday. MON => 2.
  const out = CronLib.explainQuartzCron(['0', '0', '9', '?', '*', 'MON']);
  assert.match(out, /on Monday/);
  assert.doesNotMatch(out, /on Tuesday/);
});

test('quartz cron: named day range spanning correct days', () => {
  const out = CronLib.explainQuartzCron(['0', '0', '9', '?', '*', 'MON-FRI']);
  assert.match(out, /Monday through Friday/);
});

test('quartz cron: with year field', () => {
  const out = CronLib.explainQuartzCron(['0', '0', '0', '1', 'JAN', '?', '2027']);
  assert.match(out, /in 2027/);
});

test('describeField: numeric step with base', () => {
  assert.equal(CronLib.describeField('5/15', 'minute'), 'every 15 minute starting at 5');
});

test('describeField: wildcard step', () => {
  assert.equal(CronLib.describeField('*/6', 'hour'), 'every 6 hours');
});

test('normalizeToken: passes through unknown tokens unchanged', () => {
  assert.equal(CronLib.normalizeToken('15', CronLib.DOW_ABBR), '15');
});

test('describeField: out-of-range numeric day-of-week falls back to raw value, not "undefined" (regression)', () => {
  // Day-of-week 15 is not a valid cron value (valid range is 0-6), but the decoder must
  // never silently produce "undefined" -- it should fall back to showing the raw number.
  assert.equal(CronLib.describeField('15', 'day', CronLib.DOW_NAMES, 0, CronLib.DOW_ABBR), 'day 15');
});

test('explainStandardCron: out-of-range day-of-week does not produce "undefined" (regression)', () => {
  const out = CronLib.explainStandardCron(['0', '9', '*', '*', '15']);
  assert.doesNotMatch(out, /undefined/);
  assert.match(out, /on day 15/);
});

test('describeField: out-of-range value in a range falls back to raw values on both ends', () => {
  const out = CronLib.describeField('10-15', 'day', CronLib.DOW_NAMES, 0, CronLib.DOW_ABBR);
  assert.doesNotMatch(out, /undefined/);
  assert.equal(out, 'day 10 through day 15');
});

test('describeField: out-of-range value in a list falls back to raw value for just that entry', () => {
  const out = CronLib.describeField('1,15', 'day', CronLib.DOW_NAMES, 0, CronLib.DOW_ABBR);
  assert.doesNotMatch(out, /undefined/);
  assert.equal(out, 'Monday, day 15');
});

test('buildCronExpression + buildK8sCronJobYaml', () => {
  const expr = CronLib.buildCronExpression('0', '9', '*', '*', '1-5');
  assert.equal(expr, '0 9 * * 1-5');
  const yaml = CronLib.buildK8sCronJobYaml(expr);
  assert.match(yaml, /schedule: "0 9 \* \* 1-5"/);
  assert.match(yaml, /kind: CronJob/);
});
