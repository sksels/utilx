const test = require('node:test');
const assert = require('node:assert/strict');
const CronLib = require('../public/tools/lib/cron.js');

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

test('validateCronField: accepts wildcard, single value, step, range, list within range', () => {
  assert.equal(CronLib.validateCronField('*', 0, 59), true);
  assert.equal(CronLib.validateCronField('30', 0, 59), true);
  assert.equal(CronLib.validateCronField('*/15', 0, 59), true);
  assert.equal(CronLib.validateCronField('1-5', 0, 59), true);
  assert.equal(CronLib.validateCronField('1,15,30', 0, 59), true);
  assert.equal(CronLib.validateCronField('10-20/5', 0, 59), true);
});

test('validateCronField: rejects out-of-range values in every position (regression)', () => {
  // buildCronExpression previously accepted these silently and produced an invalid
  // cron expression with no warning to the user.
  assert.equal(CronLib.validateCronField('99', 0, 59), false); // single value
  assert.equal(CronLib.validateCronField('1-99', 0, 59), false); // range end
  assert.equal(CronLib.validateCronField('99-1', 0, 59), false); // range start
  assert.equal(CronLib.validateCronField('1,99,30', 0, 59), false); // list member
  assert.equal(CronLib.validateCronField('*/0', 0, 59), false); // zero step is meaningless
  assert.equal(CronLib.validateCronField('abc', 0, 59), false); // non-numeric garbage
  assert.equal(CronLib.validateCronField('', 0, 59), false); // empty field
});

test('validateCronField: exact boundary values are valid, one past the boundary is not', () => {
  assert.equal(CronLib.validateCronField('59', 0, 59), true);
  assert.equal(CronLib.validateCronField('60', 0, 59), false);
  assert.equal(CronLib.validateCronField('0', 0, 59), true);
});

test('validateCronField: accepts named abbreviations within an abbreviation map', () => {
  assert.equal(CronLib.validateCronField('MON', 0, 6, CronLib.DOW_ABBR), true);
  assert.equal(CronLib.validateCronField('MON-FRI', 0, 6, CronLib.DOW_ABBR), true);
  assert.equal(CronLib.validateCronField('JAN,DEC', 1, 12, CronLib.MONTH_ABBR), true);
});

test('validateBuildFields: valid 5-field set returns no errors', () => {
  assert.deepEqual(CronLib.validateBuildFields('0', '9', '*', '*', '1-5'), []);
});

test('validateBuildFields: flags every out-of-range field with a distinct, specific message (regression)', () => {
  // This is exactly the scenario the Build card previously let through silently:
  // minute 99, hour 25, day-of-month 45, month 13, day-of-week 9 -- all invalid,
  // producing a cron expression no scheduler would actually accept.
  const errors = CronLib.validateBuildFields('99', '25', '45', '13', '9');
  assert.equal(errors.length, 5);
  assert.match(errors[0], /Minute must be 0-59/);
  assert.match(errors[1], /Hour must be 0-23/);
  assert.match(errors[2], /Day of month must be 1-31/);
  assert.match(errors[3], /Month must be 1-12/);
  assert.match(errors[4], /Day of week must be 0-6/);
});

test('buildCronExpression + buildK8sCronJobYaml', () => {
  const expr = CronLib.buildCronExpression('0', '9', '*', '*', '1-5');
  assert.equal(expr, '0 9 * * 1-5');
  const yaml = CronLib.buildK8sCronJobYaml(expr);
  assert.match(yaml, /schedule: "0 9 \* \* 1-5"/);
  assert.match(yaml, /kind: CronJob/);
});
