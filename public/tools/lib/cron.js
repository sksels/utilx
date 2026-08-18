// Pure cron-parsing/decoding logic shared by tools/cron-builder.html and the regression
// test suite (tests/cron.test.js). No DOM access here — keep this file environment-agnostic
// so it works as a plain browser <script> global (window.CronLib) and as a Node module.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CronLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  // Quartz: 1=Sunday...7=Saturday, index matches value directly (index 0 unused).
  const QUARTZ_DOW_NAMES = [null, 'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTH_NAMES = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

  // Abbreviation lookups so named values (MON, JAN, etc.) work in ranges/lists, not just single values.
  const DOW_ABBR = { SUN:0, MON:1, TUE:2, WED:3, THU:4, FRI:5, SAT:6 };
  const QUARTZ_DOW_ABBR = { SUN:1, MON:2, TUE:3, WED:4, THU:5, FRI:6, SAT:7 };
  const MONTH_ABBR = { JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6, JUL:7, AUG:8, SEP:9, OCT:10, NOV:11, DEC:12 };

  function normalizeToken(token, abbrMap) {
    if (!abbrMap) return token;
    const upper = token.toUpperCase();
    return abbrMap.hasOwnProperty(upper) ? String(abbrMap[upper]) : token;
  }

  // Looks up a name by numeric index, falling back to "<unit> <number>" instead of
  // "undefined" when the value is out of range (e.g. a day-of-week of 15, which isn't a
  // valid cron value but shouldn't produce nonsense output either).
  function nameOrRaw(numStr, names, nameOffset, unit) {
    const idx = Number(numStr) - nameOffset;
    const name = names[idx];
    return name !== undefined ? name : unit + ' ' + numStr;
  }

  function describeField(field, unit, names, nameOffset, abbrMap) {
    nameOffset = nameOffset || 0;
    if (field === '*' || field === '?') return 'every ' + unit;
    if (field.includes('/')) {
      const [base, step] = field.split('/');
      return 'every ' + step + ' ' + unit + (base !== '*' ? ' starting at ' + normalizeToken(base, abbrMap) : 's');
    }
    if (field.includes('-')) {
      let [a, b] = field.split('-');
      a = normalizeToken(a, abbrMap);
      b = normalizeToken(b, abbrMap);
      if (names) return nameOrRaw(a, names, nameOffset, unit) + ' through ' + nameOrRaw(b, names, nameOffset, unit);
      return unit + ' ' + a + ' through ' + b;
    }
    if (field.includes(',')) {
      const parts = field.split(',').map(p => normalizeToken(p, abbrMap));
      if (names) return parts.map(p => nameOrRaw(p, names, nameOffset, unit)).join(', ');
      return unit + 's ' + parts.join(', ');
    }
    const norm = normalizeToken(field, abbrMap);
    if (names && /^\d+$/.test(norm)) return nameOrRaw(norm, names, nameOffset, unit);
    return unit + ' ' + norm;
  }

  function explainStandardCron(parts) {
    const [m, h, dom, mon, dow] = parts;
    const isPlainNumber = (f) => /^\d+$/.test(f);
    let time;
    if (m === '*' && h === '*') {
      time = 'every minute';
    } else if (h === '*') {
      time = isPlainNumber(m)
        ? 'at minute ' + m + ' of every hour'
        : describeField(m, 'minute') + ' of every hour';
    } else if (m === '*') {
      time = 'every minute during ' + describeField(h, 'hour');
    } else if (isPlainNumber(m) && isPlainNumber(h)) {
      time = 'at ' + h.padStart(2,'0') + ':' + m.padStart(2,'0');
    } else {
      time = describeField(m, 'minute') + ' past ' + describeField(h, 'hour');
    }

    let domPart = dom === '*' ? '' : ' on ' + describeField(dom, 'day of the month');
    let monPart = mon === '*' ? '' : ' in ' + describeField(mon, 'month', MONTH_NAMES, 0, MONTH_ABBR);
    let dowPart = dow === '*' ? '' : ' on ' + describeField(dow, 'day', DOW_NAMES, 0, DOW_ABBR);

    return 'Runs ' + time + domPart + monPart + dowPart + '.';
  }

  function explainQuartzCron(parts) {
    const hasYear = parts.length === 7;
    const [sec, m, h, dom, mon, dow] = parts;
    const year = hasYear ? parts[6] : null;
    const isPlainNumber = (f) => /^\d+$/.test(f);

    let time;
    if (isPlainNumber(sec) && isPlainNumber(m) && isPlainNumber(h)) {
      time = 'at ' + h.padStart(2,'0') + ':' + m.padStart(2,'0') + ':' + sec.padStart(2,'0');
    } else {
      time = describeField(sec, 'second') + ', ' + describeField(m, 'minute') + ', ' + describeField(h, 'hour');
    }

    let domPart = (dom === '*' || dom === '?') ? '' : ' on ' + describeField(dom, 'day of the month');
    let monPart = mon === '*' ? '' : ' in ' + describeField(mon, 'month', MONTH_NAMES, 0, MONTH_ABBR);
    let dowPart = (dow === '*' || dow === '?') ? '' : ' on ' + describeField(dow, 'day', QUARTZ_DOW_NAMES, 0, QUARTZ_DOW_ABBR);
    let yearPart = (year && year !== '*') ? ' in ' + year : '';

    return 'Runs ' + time + domPart + monPart + dowPart + yearPart +
      '. Note: Quartz requires exactly one of day-of-month/day-of-week to be "?" — this decoder shows both fields as given without enforcing that rule.';
  }

  // Checks a single normalized (post-abbreviation) token is an integer within [min, max].
  function inRange(token, min, max, abbrMap) {
    const norm = normalizeToken(token, abbrMap);
    if (!/^\d+$/.test(norm)) return false;
    const n = Number(norm);
    return n >= min && n <= max;
  }

  // Validates one cron field (e.g. "5", "*/15", "1-5", "MON-FRI", "1,15,30") against the
  // field's valid numeric range. Used both to block building an out-of-range expression
  // (minute 99, hour 25, day-of-month 45, month 13, day-of-week 9 were previously accepted
  // silently) and to flag semantically-invalid-but-syntactically-parseable decode input.
  function validateCronField(field, min, max, abbrMap) {
    if (field === '*' || field === '?') return true;
    if (field === '') return false;
    return field.split(',').every((part) => {
      let base = part;
      if (part.includes('/')) {
        const [b, step] = part.split('/');
        if (!/^\d+$/.test(step) || Number(step) < 1) return false;
        if (b === '*') return true;
        base = b;
      }
      if (base.includes('-')) {
        const [a, z] = base.split('-');
        return inRange(a, min, max, abbrMap) && inRange(z, min, max, abbrMap);
      }
      return inRange(base, min, max, abbrMap);
    });
  }

  // Validates all 5 standard-cron fields at once, returning a list of plain-English error
  // messages (empty array = valid). Shared by the Build card (blocks building an invalid
  // expression) and the Decode card (shown as a non-blocking warning alongside the
  // explanation, since decode still succeeds -- it just describes an expression that isn't
  // actually valid cron).
  function validateBuildFields(m, h, dom, mon, dow) {
    const errors = [];
    if (!validateCronField(m, 0, 59)) errors.push('Minute must be 0-59 (or *, a list, range, or step).');
    if (!validateCronField(h, 0, 23)) errors.push('Hour must be 0-23 (or *, a list, range, or step).');
    if (!validateCronField(dom, 1, 31)) errors.push('Day of month must be 1-31 (or *, a list, range, or step).');
    if (!validateCronField(mon, 1, 12, MONTH_ABBR)) errors.push('Month must be 1-12 or JAN-DEC (or *, a list, range, or step).');
    if (!validateCronField(dow, 0, 6, DOW_ABBR)) errors.push('Day of week must be 0-6 (Sun=0) or SUN-SAT (or *, a list, range, or step).');
    return errors;
  }

  function buildCronExpression(m, h, dom, mon, dow) {
    return [m || '*', h || '*', dom || '*', mon || '*', dow || '*'].join(' ');
  }

  function buildK8sCronJobYaml(expr) {
    return 'apiVersion: batch/v1\n' +
      'kind: CronJob\n' +
      'metadata:\n' +
      '  name: my-cronjob\n' +
      'spec:\n' +
      '  schedule: "' + expr + '"\n' +
      '  jobTemplate:\n' +
      '    spec:\n' +
      '      template:\n' +
      '        spec:\n' +
      '          containers:\n' +
      '          - name: my-job\n' +
      '            image: my-image\n' +
      '          restartPolicy: OnFailure';
  }

  return {
    DOW_NAMES, QUARTZ_DOW_NAMES, MONTH_NAMES,
    DOW_ABBR, QUARTZ_DOW_ABBR, MONTH_ABBR,
    normalizeToken, describeField,
    explainStandardCron, explainQuartzCron,
    buildCronExpression, buildK8sCronJobYaml,
    validateCronField, validateBuildFields,
  };
});
