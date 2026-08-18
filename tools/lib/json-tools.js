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

  // Tech debt fix: this used to recurse once per nesting level, which hit the JS engine's
  // call-stack limit (~5,000 levels deep) on realistic deeply-nested API responses/trees,
  // even though JSON.parse itself comfortably handles 100,000+ levels. Rewritten to use an
  // explicit stack instead of the call stack, so nesting depth is bounded only by available
  // memory, not by V8's recursion limit. The traversal order (and therefore the order of
  // entries in `results`) is preserved exactly: each stack "task" is either a trivial
  // added/removed leaf, or a 'diff' task that -- when popped -- pushes its own children back
  // onto the stack in reverse order. Because the stack is LIFO, a task's children are always
  // fully drained before its next sibling is touched, which reproduces the same depth-first,
  // left-to-right order the old recursive version produced.
  function deepDiff(a, b, path, results) {
    results = results || [];
    const stack = [{ kind: 'diff', a, b, path: path || '' }];

    while (stack.length) {
      const task = stack.pop();
      const p = task.path;

      if (task.kind === 'added') {
        results.push({ path: p, type: 'added', from: undefined, to: task.b });
        continue;
      }
      if (task.kind === 'removed') {
        results.push({ path: p, type: 'removed', from: task.a, to: undefined });
        continue;
      }

      const a = task.a, b = task.b;
      if (a === b) continue;

      const aIsObj = a !== null && typeof a === 'object';
      const bIsObj = b !== null && typeof b === 'object';

      if (!aIsObj || !bIsObj || Array.isArray(a) !== Array.isArray(b)) {
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          results.push({ path: p || '(root)', type: 'changed', from: a, to: b });
        }
        continue;
      }

      const children = [];
      if (Array.isArray(a)) {
        const maxLen = Math.max(a.length, b.length);
        for (let i = 0; i < maxLen; i++) {
          const cp = p + '[' + i + ']';
          if (i >= a.length) children.push({ kind: 'added', b: b[i], path: cp });
          else if (i >= b.length) children.push({ kind: 'removed', a: a[i], path: cp });
          else children.push({ kind: 'diff', a: a[i], b: b[i], path: cp });
        }
      } else {
        const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
        for (const key of keys) {
          const cp = p ? p + '.' + key : key;
          if (!(key in a)) children.push({ kind: 'added', b: b[key], path: cp });
          else if (!(key in b)) children.push({ kind: 'removed', a: a[key], path: cp });
          else children.push({ kind: 'diff', a: a[key], b: b[key], path: cp });
        }
      }
      // Push in reverse so the first child is on top of the stack and pops (processes) next.
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
    return results;
  }

  return { shortVal, deepDiff };
});
