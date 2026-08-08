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

test('buildCronExpression + buildK8sCronJobYaml', () => {
  const expr = CronLib.buildCronExpression('0', '9', '*', '*', '1-5');
  assert.equal(expr, '0 9 * * 1-5');
  const yaml = CronLib.buildK8sCronJobYaml(expr);
  assert.match(yaml, /schedule: "0 9 \* \* 1-5"/);
  assert.match(yaml, /kind: CronJob/);
});
