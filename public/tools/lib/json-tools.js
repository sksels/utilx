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
  // CR#7 (Live Interaction, backlog #37): `options.includeUnchanged` is an opt-in addition
  // for the collapsible-diff-view feature -- default behavior (the 4-arg call every existing
  // caller and test uses) is completely unchanged. When true, a leaf whose value is
  // identical on both sides gets a `type: 'unchanged'` entry instead of being silently
  // skipped, so the UI can render it as (by default, collapsed) context, git-diff-style,
  // instead of just omitting it.
  //
  // This still only fires the `a === b` fast path for reference/primitive equality, same as
  // the default mode -- which, note, means it essentially never short-circuits a *whole
  // nested object/array* as one unit: two independently-parsed JSON documents never share
  // object references, even when deeply identical, so `a === b` is false for every nested
  // object/array pair and traversal always continues down into their children regardless.
  // The practical effect is that includeUnchanged marks matching *leaves* (primitives),
  // recursing all the way down through unchanged branches rather than collapsing them --
  // which is exactly what's wanted here: full leaf-level context, like a real text diff
  // shows every unchanged line rather than hiding whole matching sections from the data
  // itself. Grouping/collapsing consecutive unchanged rows for display is a UI-layer concern
  // (json-formatter.astro), kept separate from this pure diffing logic.
  function deepDiff(a, b, path, results, options) {
    results = results || [];
    const includeUnchanged = !!(options && options.includeUnchanged);
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
      if (a === b) {
        if (includeUnchanged) {
          results.push({ path: p || '(root)', type: 'unchanged', from: a, to: b });
        }
        continue;
      }

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
