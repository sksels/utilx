// Pure plain-English regex-pattern explainer shared by tools/regex-tester.html and
// tests/regex-explain.test.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RegexExplainLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function readQuantifier(pattern, i) {
    const n = pattern.length;
    if (i >= n) return [null, i];
    const c = pattern[i];
    if (c === '*') return ['zero or more of', i+1];
    if (c === '+') return ['one or more of', i+1];
    if (c === '?') return ['zero or one (optional) of', i+1];
    if (c === '{') {
      const close = pattern.indexOf('}', i);
      if (close !== -1) {
        const body = pattern.slice(i+1, close);
        const m = body.match(/^(\d+)(,(\d*))?$/);
        if (m) {
          if (m[2] === undefined) return ['exactly ' + m[1] + ' of', close+1];
          if (m[3] === '') return [m[1] + ' or more of', close+1];
          return ['between ' + m[1] + ' and ' + m[3] + ' of', close+1];
        }
      }
    }
    return [null, i];
  }

  function describeCharClass(body) {
    let negate = false;
    let content = body;
    if (content.startsWith('^')) { negate = true; content = content.slice(1); }
    return 'any character ' + (negate ? 'NOT in' : 'from') + ' the set "' + content + '"';
  }

  function pushWithQuantifier(lines, indent, pattern, i, desc) {
    const [quant, newI] = readQuantifier(pattern, i);
    if (quant) {
      lines.push(indent + '- ' + quant + ': ' + desc);
      return newI;
    }
    lines.push(indent + '- ' + desc);
    return i;
  }

  function explainRegex(pattern, depth) {
    depth = depth || 0;
    const lines = [];
    let i = 0;
    const n = pattern.length;
    const indent = '  '.repeat(depth);
    const specials = '^$.\\[](){}|*+?';

    while (i < n) {
      const c = pattern[i];

      if (c === '^') { i = pushWithQuantifier(lines, indent, pattern, i+1, 'start of the string (or line, with the m flag)'); continue; }
      if (c === '$') { i = pushWithQuantifier(lines, indent, pattern, i+1, 'end of the string (or line, with the m flag)'); continue; }
      if (c === '.') { i = pushWithQuantifier(lines, indent, pattern, i+1, 'any character except newline'); continue; }

      if (c === '\\') {
        const next = pattern[i+1];
        const map = { d: 'any digit (0-9)', D: 'any non-digit', w: 'a word character (letter, digit, or underscore)', W: 'a non-word character', s: 'whitespace', S: 'non-whitespace', b: 'a word boundary', B: 'a non-word-boundary' };
        let desc, after;
        if (next && map[next]) { desc = map[next]; after = i+2; }
        else if (next) { desc = 'the literal character "' + next + '"'; after = i+2; }
        else { desc = 'a trailing backslash'; after = i+1; }
        i = pushWithQuantifier(lines, indent, pattern, after, desc);
        continue;
      }

      if (c === '[') {
        const close = pattern.indexOf(']', i+1);
        if (close !== -1) {
          const desc = describeCharClass(pattern.slice(i+1, close));
          i = pushWithQuantifier(lines, indent, pattern, close+1, desc);
        } else {
          i = pushWithQuantifier(lines, indent, pattern, i+1, 'the literal character "["');
        }
        continue;
      }

      if (c === '(') {
        let close = -1, depth2 = 1, j = i+1;
        while (j < n && depth2 > 0) {
          if (pattern[j] === '\\') { j += 2; continue; }
          if (pattern[j] === '(') depth2++;
          else if (pattern[j] === ')') depth2--;
          if (depth2 === 0) { close = j; break; }
          j++;
        }
        if (close === -1) { i = pushWithQuantifier(lines, indent, pattern, i+1, 'the literal character "("'); continue; }

        const inner = pattern.slice(i+1, close);
        let label, innerPattern;
        if (inner.startsWith('?:')) { label = 'a non-capturing group containing'; innerPattern = inner.slice(2); }
        else if (inner.startsWith('?=')) { label = 'a lookahead (must be followed by, but not consumed)'; innerPattern = inner.slice(2); }
        else if (inner.startsWith('?!')) { label = 'a negative lookahead (must NOT be followed by)'; innerPattern = inner.slice(2); }
        else if (inner.startsWith('?<=')) { label = 'a lookbehind (must be preceded by)'; innerPattern = inner.slice(3); }
        else if (inner.startsWith('?<!')) { label = 'a negative lookbehind (must NOT be preceded by)'; innerPattern = inner.slice(3); }
        else { label = 'a capture group containing'; innerPattern = inner; }

        const [quant, newI] = readQuantifier(pattern, close+1);
        lines.push(indent + '- ' + (quant ? quant + ' [' + label + ']:' : label + ':'));
        lines.push(...explainRegex(innerPattern, depth+1));
        i = newI;
        continue;
      }

      if (c === '|') { lines.push(indent + '- OR (alternation) —'); i++; continue; }

      let start = i;
      while (i < n && !specials.includes(pattern[i])) i++;
      if (i === start) {
        i = pushWithQuantifier(lines, indent, pattern, i+1, 'the literal character "' + c + '"');
        continue;
      }
      const [quant, newI] = readQuantifier(pattern, i);
      if (quant && (i - start) > 1) {
        const runText = pattern.slice(start, i-1);
        const lastChar = pattern[i-1];
        lines.push(indent + '- the literal text "' + runText + '"');
        lines.push(indent + '- ' + quant + ': the literal character "' + lastChar + '"');
        i = newI;
      } else if (quant) {
        lines.push(indent + '- ' + quant + ': the literal text "' + pattern.slice(start, i) + '"');
        i = newI;
      } else {
        lines.push(indent + '- the literal text "' + pattern.slice(start, i) + '"');
      }
    }

    return lines;
  }

  return { readQuantifier, describeCharClass, pushWithQuantifier, explainRegex };
});
