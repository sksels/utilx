// Pure JSON diff/formatting-helper logic shared by tools/json-formatter.html and
// tests/json-tools.test.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JsonToolsLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function shortVal(v) {
    if (v === undefined) return '(none)';
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
  }

  function deepDiff(a, b, path, results) {
    if (a === b) return results;

    const aIsObj = a !== null && typeof a === 'object';
    const bIsObj = b !== null && typeof b === 'object';

    if (!aIsObj || !bIsObj || Array.isArray(a) !== Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        results.push({ path: path || '(root)', type: 'changed', from: a, to: b });
      }
      return results;
    }

    if (Array.isArray(a)) {
      const maxLen = Math.max(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        const p = path + '[' + i + ']';
        if (i >= a.length) results.push({ path: p, type: 'added', from: undefined, to: b[i] });
        else if (i >= b.length) results.push({ path: p, type: 'removed', from: a[i], to: undefined });
        else deepDiff(a[i], b[i], p, results);
      }
      return results;
    }

    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
    for (const key of keys) {
      const p = path ? path + '.' + key : key;
      if (!(key in a)) results.push({ path: p, type: 'added', from: undefined, to: b[key] });
      else if (!(key in b)) results.push({ path: p, type: 'removed', from: a[key], to: undefined });
      else deepDiff(a[key], b[key], p, results);
    }
    return results;
  }

  return { shortVal, deepDiff };
});
