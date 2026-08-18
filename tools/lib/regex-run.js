// Pure regex-match-and-highlight logic, shared by tools/lib/regex-worker.js (runs it off
// the main thread) and tests/regex-run.test.js. Kept dependency-free (just needs an
// escapeHtml function passed in) so it works identically in a Worker, in Node for tests,
// or inline in the page as a fallback -- see tools/regex-tester.html for how all three are
// wired together as part of the ReDoS-protection fix (tech debt item: run matching in a
// Web Worker with a timeout, since a catastrophic-backtracking pattern can otherwise run
// for an effectively unbounded amount of time and there is no way to interrupt a
// synchronous RegExp#exec() call from the outside).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RegexRunLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Runs `new RegExp(pattern, flags)` against `text`, escaping every fragment of text with
  // `escapeHtml` before it's assembled into `html` (never trust match/groups content as
  // safe to insert into innerHTML -- see tools/lib/html-escape.js). Returns
  // { ok: true, html, results, count } on success, or { ok: false, message } if the
  // pattern/flags fail to compile. This function itself can still run for an unbounded
  // amount of time on a catastrophic-backtracking pattern -- that risk is NOT mitigated
  // here (a pure function can't interrupt itself); the caller is responsible for running
  // this somewhere that can be forcibly terminated (a Web Worker) with a timeout.
  function runMatch(pattern, flags, text, escapeHtml) {
    let re;
    try {
      re = new RegExp(pattern, flags);
    } catch (err) {
      return { ok: false, message: err.message };
    }

    let match;
    let lastIndex = 0;
    let html = '';
    const results = [];
    let count = 0;
    const safeRe = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');

    while ((match = safeRe.exec(text)) !== null) {
      count++;
      html += escapeHtml(text.slice(lastIndex, match.index));
      html += '<mark style="background:#5b8cff;color:#0a0c12;border-radius:3px;padding:0 2px;">' + escapeHtml(match[0]) + '</mark>';
      lastIndex = match.index + match[0].length;
      results.push(
        'Match ' + count + ': "' + match[0] + '" at index ' + match.index +
        (match.length > 1 ? '\n  Groups: ' + JSON.stringify(match.slice(1)) : '')
      );
      if (match[0] === '') { safeRe.lastIndex++; }
      if (count > 500) break;
    }
    html += escapeHtml(text.slice(lastIndex));

    return { ok: true, html, results, count };
  }

  return { runMatch };
});
